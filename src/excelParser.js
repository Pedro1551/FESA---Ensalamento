import * as XLSX from 'xlsx';

const DAY_PATTERN = /(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)/i;
const TIME_PATTERN = /(\d{1,2})h(\d{2})\s*às\s*(\d{1,2})h(\d{2})/i;

const cleanText = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\r?\n/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeDay = (value) => {
  const text = cleanText(value);
  const key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (key.includes('segunda')) return 'Segunda-feira';
  if (key.includes('terca')) return 'Terça-feira';
  if (key.includes('quarta')) return 'Quarta-feira';
  if (key.includes('quinta')) return 'Quinta-feira';
  if (key.includes('sexta')) return 'Sexta-feira';
  if (key.includes('sabado')) return 'Sábado';
  return text;
};

const parseTimeRange = (value) => {
  const match = cleanText(value).match(TIME_PATTERN);
  if (!match) return null;
  return {
    start: `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`,
    end: `${String(Number(match[3])).padStart(2, '0')}:${match[4]}`,
  };
};

const splitLesson = (rawValue) => {
  const text = cleanText(rawValue);
  const matches = [...text.matchAll(/\s+-\s+/g)];
  if (!matches.length) {
    return { subject: text, professor: 'Professor não identificado' };
  }

  const divider = matches[matches.length - 1];
  return {
    subject: text.slice(0, divider.index).trim(),
    professor: text.slice(divider.index + divider[0].length).trim(),
  };
};

const cellText = (sheet, row, col) => {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[address];
  if (!cell) return '';
  return cleanText(cell.w ?? cell.v ?? '');
};

const getMergeAt = (sheet, row, col) => {
  const merges = sheet['!merges'] ?? [];
  return merges.find(({ s, e }) => row >= s.r && row <= e.r && col >= s.c && col <= e.c) ?? null;
};

const visibleSheetNames = (workbook) => {
  const metadata = workbook.Workbook?.Sheets ?? [];
  const metaMap = new Map(metadata.map((item) => [item.name ?? item.Name, item.Hidden ?? 0]));
  const visible = workbook.SheetNames.filter((name) => (metaMap.get(name) ?? 0) === 0);
  return visible.length ? visible : workbook.SheetNames;
};

function parseClass(sheetName, sheet, classAnchor, nextAnchorRow, range) {
  const { row: classRow, col: classCol, name: className } = classAnchor;
  let headerRow = null;
  let timeCol = null;
  const dayColumns = [];

  for (let row = classRow + 1; row <= Math.min(classRow + 6, nextAnchorRow - 1); row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      if (cellText(sheet, row, col).toLocaleLowerCase('pt-BR') === 'horário') {
        headerRow = row;
        timeCol = col;
        for (let dayCol = col + 1; dayCol <= range.e.c; dayCol += 1) {
          const day = cellText(sheet, row, dayCol);
          if (DAY_PATTERN.test(day)) {
            dayColumns.push({ col: dayCol, day: normalizeDay(day) });
          }
        }
        break;
      }
    }
    if (headerRow !== null) break;
  }

  if (headerRow === null || timeCol === null || !dayColumns.length) return null;

  const slots = [];
  for (let row = headerRow + 1; row < nextAnchorRow; row += 1) {
    const timeText = cellText(sheet, row, timeCol);
    const parsed = parseTimeRange(timeText);
    if (!parsed) continue;

    const merge = getMergeAt(sheet, row, timeCol);
    if (merge && (merge.s.r !== row || merge.s.c !== timeCol)) continue;

    slots.push({
      index: slots.length,
      anchorRow: row,
      endRow: merge?.e.r ?? row,
      label: timeText,
      start: parsed.start,
      end: parsed.end,
    });
  }

  if (!slots.length) return null;

  const entries = [];
  const notes = [];

  for (const { col, day } of dayColumns) {
    for (let row = headerRow + 1; row < nextAnchorRow; row += 1) {
      const raw = cellText(sheet, row, col);
      if (!raw) continue;

      const merge = getMergeAt(sheet, row, col);
      if (merge && (merge.s.r !== row || merge.s.c !== col)) continue;

      const startRow = merge?.s.r ?? row;
      const endRow = merge?.e.r ?? row;
      const coveredSlots = slots.filter((slot) => slot.anchorRow >= startRow && slot.anchorRow <= endRow);
      if (!coveredSlots.length) continue;

      if (raw.length > 240 || raw.toLocaleLowerCase('pt-BR').startsWith('cada aluno deverá')) {
        notes.push({ day, text: raw });
        continue;
      }

      const { subject, professor } = splitLesson(raw);
      const startSlot = coveredSlots[0].index;
      const span = coveredSlots.length;

      entries.push({
        id: `${sheetName}|${className}|${day}|${startRow}|${col}`,
        courseId: sheetName,
        classId: `${sheetName}|${className}`,
        className,
        day,
        startSlot,
        span,
        subject,
        professor,
        raw,
        originalDay: day,
        originalStartSlot: startSlot,
      });
    }
  }

  return {
    id: `${sheetName}|${className}`,
    name: className,
    days: dayColumns.map((item) => item.day),
    slots: slots.map(({ anchorRow, endRow, ...slot }) => slot),
    entries,
    notes,
  };
}

function parseSheet(sheetName, sheet) {
  const ref = sheet['!ref'];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);
  const anchors = [];

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const value = cellText(sheet, row, col);
      if (/^Turma\b/i.test(value)) {
        anchors.push({ row, col, name: value });
      }
    }
  }

  if (!anchors.length) return null;
  anchors.sort((a, b) => a.row - b.row || a.col - b.col);

  const classes = anchors
    .map((anchor, index) => parseClass(
      sheetName,
      sheet,
      anchor,
      anchors[index + 1]?.row ?? (range.e.r + 1),
      range,
    ))
    .filter(Boolean);

  if (!classes.length) return null;

  return {
    id: sheetName,
    name: sheetName,
    classes,
  };
}

export function parseScheduleWorkbook(arrayBuffer, sourceName = 'planilha.xls') {
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellFormula: true,
    cellStyles: false,
  });

  const courses = visibleSheetNames(workbook)
    .map((sheetName) => parseSheet(sheetName, workbook.Sheets[sheetName]))
    .filter(Boolean);

  if (!courses.length) {
    throw new Error('Nenhuma grade com células "Turma" e "Horário" foi encontrada na planilha.');
  }

  return {
    source: sourceName,
    courses,
  };
}
