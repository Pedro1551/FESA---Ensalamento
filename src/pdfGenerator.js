// A partir da v0.2.4 o PDF é gerado pelo próprio diálogo de impressão do navegador.
// Mantemos este nome de arquivo temporariamente para preservar a compatibilidade com o restante do protótipo.

const DAY_ORDER = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LOGO_PATH = '/logo-salvador-arena.png';

const PRINT_TONES = [
  { bg: '#eef7ff', border: '#8bc8ff', accent: '#2f98ef' },
  { bg: '#edfff8', border: '#80e6c1', accent: '#24b987' },
  { bg: '#fff6eb', border: '#ffc88a', accent: '#ed9137' },
  { bg: '#f6f0ff', border: '#c6adff', accent: '#8e6ee8' },
  { bg: '#fffbea', border: '#ffe38b', accent: '#d4ae22' },
  { bg: '#ecfbff', border: '#8ae5f7', accent: '#36b8d8' },
  { bg: '#fff0f3', border: '#ffafbc', accent: '#e86780' },
  { bg: '#f0ffef', border: '#9ee99b', accent: '#54bd50' },
  { bg: '#fff0fe', border: '#f0a9e9', accent: '#d866ce' },
  { bg: '#fff1ed', border: '#ffb4a0', accent: '#e96d4e' },
];

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isEntryManual(entry) {
  return entry?.origin === 'manual';
}

function isEntryChanged(entry) {
  if (!entry || isEntryManual(entry) || entry.originalDay == null) return false;
  const room = entry.room || entry.local || entry.location || '';
  return entry.day !== entry.originalDay
    || entry.startSlot !== entry.originalStartSlot
    || entry.span !== entry.originalSpan
    || entry.subject !== entry.originalSubject
    || entry.professor !== entry.originalProfessor
    || room !== (entry.originalRoom || '');
}

function entryTone(entry) {
  if (isEntryChanged(entry)) {
    return { bg: '#fff9df', border: '#d5b552', accent: '#b48b19' };
  }

  let hash = 0;
  for (const char of normalizeKey(entry?.professor)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
  }

  return PRINT_TONES[Math.abs(hash) % PRINT_TONES.length];
}

function parseDateOnly(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(Date.UTC(2026, 9, 12));
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function mondayOfWeek(value) {
  const date = parseDateOnly(value);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function addDays(date, amount) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function formatDate(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}-${MONTHS_PT[date.getUTCMonth()]}-${String(date.getUTCFullYear()).slice(-2)}`;
}

function lessonNumberForSlot(slot, slotIndex) {
  const [hourText] = String(slot?.start ?? '').split(':');
  const hour = Number(hourText);

  if (Number.isFinite(hour)) {
    if (hour >= 18) return 11 + slotIndex;
    if (hour >= 12) return 7 + slotIndex;
  }

  return 1 + slotIndex;
}

function numericClassOrder(classItem) {
  const match = String(classItem?.name ?? '').match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function entryStartingAt(classItem, day, slotIndex) {
  return classItem.entries.find((entry) => entry.day === day && entry.startSlot === slotIndex) ?? null;
}

function entryCoveringSlot(classItem, day, slotIndex) {
  return classItem.entries.find((entry) => (
    entry.day === day
    && entry.startSlot < slotIndex
    && entry.startSlot + entry.span > slotIndex
  )) ?? null;
}

function renderEntry(entry) {
  if (!entry) return '';
  const tone = entryTone(entry);
  const room = entry.room || entry.local || entry.location || '';
  const stateLabel = isEntryManual(entry)
    ? '<div class="changed-label new-label">NOVA</div>'
    : (isEntryChanged(entry) ? '<div class="changed-label">ALTERADA</div>' : '');

  return `
    <div class="lesson-card" style="--lesson-bg:${tone.bg};--lesson-border:${tone.border};--lesson-accent:${tone.accent}">
      ${stateLabel}
      <div class="lesson-title">${escapeHtml(entry.subject || entry.discipline || 'Aula')}</div>
      <div class="lesson-professor">${escapeHtml(entry.professor || '')}</div>
      ${room ? `<div class="lesson-room">${escapeHtml(room)}</div>` : ''}
    </div>
  `;
}

function renderClassTable(classItem) {
  const days = DAY_ORDER;
  const slots = classItem.slots ?? [];
  const slotCount = slots.length;
  const rowHeight = slotCount <= 4 ? '15.2mm' : (slotCount <= 6 ? '10.4mm' : '8.8mm');

  const headers = [
    '<div class="grid-head number-head"></div>',
    '<div class="grid-head time-head">Hor.</div>',
    ...days.map((day) => `<div class="grid-head">${escapeHtml(day.replace('-feira', ''))}</div>`),
  ].join('');

  const baseCells = slots.map((slot, slotIndex) => {
    const row = slotIndex + 2;
    const lessonNumber = `<div class="lesson-number" style="grid-column:1;grid-row:${row}">${lessonNumberForSlot(slot, slotIndex)}ª</div>`;
    const lessonTime = `
      <div class="lesson-time" style="grid-column:2;grid-row:${row}">
        <strong>${escapeHtml(slot.start || '')}</strong>
        <span>${escapeHtml(slot.end || '')}</span>
      </div>
    `;
    const dayCells = days.map((_, dayIndex) => (
      `<div class="lesson-cell empty-cell" style="grid-column:${dayIndex + 3};grid-row:${row}"></div>`
    )).join('');
    return lessonNumber + lessonTime + dayCells;
  }).join('');

  const lessons = classItem.entries.filter((entry) => entry.status !== 'cancelled').map((entry) => {
    const dayIndex = days.indexOf(entry.day);
    if (dayIndex < 0) return '';

    const startSlot = Math.max(0, Number(entry.startSlot) || 0);
    if (startSlot >= slotCount) return '';

    const requestedSpan = Math.max(1, Number(entry.span) || 1);
    const span = Math.min(requestedSpan, slotCount - startSlot);
    const row = startSlot + 2;
    const column = dayIndex + 3;

    return `
      <div class="lesson-grid-item" style="grid-column:${column};grid-row:${row} / span ${span}">
        ${renderEntry(entry)}
      </div>
    `;
  }).join('');

  return `
    <section class="class-block">
      <div class="class-title">${escapeHtml(classItem.name)}</div>
      <div class="schedule-grid" style="grid-template-rows:5.5mm repeat(${slotCount}, ${rowHeight})">
        ${headers}
        ${baseCells}
        ${lessons}
      </div>
    </section>
  `;
}

function renderPageHeader({ weekStart, semesterLabel }) {
  return `
    <header class="print-header">
      <div class="print-brand">
        <img class="print-logo" src="${LOGO_PATH}" alt="Logo institucional" />
        <div class="print-brand-copy">
          <div class="print-title">Utilização de salas/laboratórios</div>
          <div class="semester">${escapeHtml(semesterLabel)}</div>
        </div>
      </div>
      <div class="week-dates">
        <span></span><span></span>
        ${DAY_ORDER.map((_, index) => `<strong>${formatDate(addDays(weekStart, index))}</strong>`).join('')}
      </div>
    </header>
  `;
}

function printStyles() {
  return `
    @page { size: 297mm 210mm; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #142033; font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-page { width: 281mm; min-height: 194mm; display: flex; flex-direction: column; break-after: page; page-break-after: always; overflow: hidden; }
    .print-page:last-child { break-after: auto; page-break-after: auto; }
    .print-header { margin-bottom: 4mm; }
    .print-brand { display: grid; grid-template-columns: 18mm 1fr 18mm; align-items: center; column-gap: 3mm; }
    .print-logo { width: 16mm; height: auto; justify-self: start; }
    .print-brand-copy { text-align: center; }
    .print-title { text-align: center; font-size: 15pt; line-height: 1.05; font-weight: 800; color: #111827; }
    .semester { text-align: center; margin-top: 0.8mm; font-size: 9.8pt; font-weight: 700; color: #425166; }
    .week-dates { display: grid; grid-template-columns: 10mm 16mm repeat(6, 1fr); column-gap: 1.1mm; align-items: end; margin-top: 3.2mm; font-size: 8pt; text-align: center; }
    .week-dates strong { display: flex; align-items: center; justify-content: center; min-height: 6.5mm; padding: 0.8mm 1mm; background: #f7fafc; border: 0.3mm solid #dbe4ee; border-radius: 1.8mm; font-weight: 800; color: #0d2847; }

    .class-block {
      margin-bottom: 4.8mm;
      border: 0.32mm solid #dbe4ee;
      border-radius: 3mm;
      background: #fff;
      padding: 3mm;
      break-inside: avoid;
      page-break-inside: avoid;
      box-shadow: 0 0 0 0 rgba(0,0,0,0);
    }
    .class-title {
      margin-bottom: 2.4mm;
      padding: 0 0.4mm;
      color: #182536;
      font-size: 11.5pt;
      font-weight: 800;
      line-height: 1.2;
    }

    .schedule-grid {
      display: grid;
      grid-template-columns: 10mm 16mm repeat(6, minmax(0, 1fr));
      width: 100%;
      gap: 1mm;
      overflow: visible;
      background: transparent;
    }
    .grid-head, .lesson-number, .lesson-time, .lesson-cell { min-width: 0; }
    .grid-head {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 8mm;
      padding: 0.7mm 1mm;
      background: #f7fafc;
      border: 0.3mm solid #dbe4ee;
      border-radius: 1.8mm;
      color: #111827;
      font-size: 8.2pt;
      font-weight: 800;
      text-align: center;
    }
    .number-head, .time-head { background: transparent; border-color: transparent; }
    .lesson-number {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      background: #f8fafc;
      border: 0.3mm solid #dbe4ee;
      border-radius: 1.6mm;
      text-align: center;
      font-size: 7.7pt;
      font-weight: 800;
      color: #203041;
    }
    .lesson-time {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      background: #fbfcfe;
      border: 0.3mm solid #dbe4ee;
      border-radius: 1.6mm;
      text-align: center;
      padding: 0.8mm 0.5mm;
      font-size: 7.2pt;
    }
    .lesson-time strong { display: block; font-size: 7.8pt; color: #162536; }
    .lesson-time span { display: block; margin-top: 0.4mm; color: #556474; font-size: 6.8pt; }
    .lesson-cell {
      min-height: 100%;
      background: #f8fafc;
      border: 0.3mm solid #e3eaf2;
      border-radius: 1.8mm;
    }
    .empty-cell { background: #fafcff; }
    .lesson-grid-item {
      z-index: 2;
      min-width: 0;
      min-height: 0;
      overflow: visible;
      background: transparent;
      border: 0;
      padding: 0;
    }
    .lesson-card {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
      background: var(--lesson-bg);
      border: 0.3mm solid var(--lesson-border);
      border-left: 1.2mm solid var(--lesson-accent);
      border-radius: 1.8mm;
      padding: 1.7mm 1.8mm 1.5mm 2.2mm;
      text-align: left;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      overflow: hidden;
    }
    .lesson-title { font-size: 8pt; line-height: 1.13; font-weight: 800; color: #111827; overflow-wrap: anywhere; }
    .lesson-professor { margin-top: 0.8mm; font-size: 7pt; line-height: 1.13; color: #405064; overflow-wrap: anywhere; }
    .lesson-room { margin-top: 1mm; font-size: 7pt; font-weight: 700; color: #182536; }
    .new-label { background: rgba(238, 242, 255, .97) !important; color: #4d5d96 !important; }
    .changed-label {
      position: absolute;
      right: 0.9mm;
      top: 0.8mm;
      padding: 0.15mm 0.6mm;
      border-radius: 999px;
      background: rgba(255, 245, 188, .95);
      font-size: 4.9pt;
      font-weight: 800;
      color: #8b6700;
    }
    .print-footer, footer.print-footer { display: none !important; }
    .screen-note { display: none; }
    @media print {
      html, body { width: 281mm; min-width: 281mm; }
      .print-page { width: 281mm; min-width: 281mm; }
    }
    @media screen {
      body { padding: 18px; background: #eef2f6; }
      .print-page { width: 1120px; min-height: 760px; margin: 0 auto 18px; padding: 28px; background: white; box-shadow: 0 1px 10px rgba(15, 23, 42, .12); }
      .screen-note { display: block; width: 1120px; margin: 0 auto 12px; padding: 10px 14px; border-radius: 8px; background: #fff7d6; color: #614f00; font-size: 13px; }
    }
  `;
}

function renderPrintableDocument({ title, pages }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${printStyles()}</style>
</head>
<body>
  <div class="screen-note">Na janela de impressão, selecione <strong>Salvar como PDF</strong>. O relatório foi preparado em <strong>A4 paisagem</strong>; se o navegador mostrar a folha em retrato, altere o layout para <strong>Paisagem</strong>.</div>
  ${pages}
  <script>
    window.addEventListener('load', () => {
      document.querySelectorAll('.print-footer, footer.print-footer').forEach((node) => node.remove());
      setTimeout(() => { window.focus(); window.print(); }, 180);
    });
    window.addEventListener('afterprint', () => window.close());
  <\/script>
</body>
</html>`;
}

function openPrintWindow(html) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');

  try { popup.opener = null; } catch {}
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

export function generateClassWeekPdf({
  course,
  classItem,
  weekDate,
  sourceName,
  semesterLabel = '2º Semestre/2026',
}) {
  if (!course || !classItem) throw new Error('Turma não selecionada para impressão.');

  const weekStart = mondayOfWeek(weekDate);
  const page = `
    <section class="print-page">
      ${renderPageHeader({ weekStart, semesterLabel })}
      ${renderClassTable(classItem)}
    </section>
  `;

  openPrintWindow(renderPrintableDocument({
    title: `${classItem.name} - semana ${formatDate(weekStart)}`,
    pages: page,
  }));

  return `${classItem.name} · semana ${formatDate(weekStart)}`;
}

export function generateCourseWeekPdf({
  course,
  weekDate,
  sourceName,
  semesterLabel = '2º Semestre/2026',
}) {
  if (!course?.classes?.length) throw new Error('Curso sem turmas para impressão semanal.');

  const classes = [...course.classes].sort((a, b) => {
    const numberDiff = numericClassOrder(a) - numericClassOrder(b);
    return numberDiff || String(a.name).localeCompare(String(b.name), 'pt-BR');
  });

  const weekStart = mondayOfWeek(weekDate);
  const maxSlots = Math.max(...classes.map((classItem) => classItem.slots.length));
  const classesPerPage = maxSlots <= 6 ? 2 : 1;
  const totalPages = Math.ceil(classes.length / classesPerPage);

  let pages = '';
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const pageClasses = classes.slice(pageIndex * classesPerPage, (pageIndex + 1) * classesPerPage);
    pages += `
      <section class="print-page">
        ${renderPageHeader({ weekStart, semesterLabel })}
        ${pageClasses.map(renderClassTable).join('')}
      </section>
    `;
  }

  openPrintWindow(renderPrintableDocument({
    title: `${course.name} - ensalamento semanal ${formatDate(weekStart)}`,
    pages,
  }));

  return `${course.name} · semana ${formatDate(weekStart)}`;
}
