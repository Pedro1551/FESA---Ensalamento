import { jsPDF } from 'jspdf';

const DAY_ORDER = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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

function safeFilename(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function fitLines(doc, text, width, maxLines) {
  const lines = doc.splitTextToSize(String(text ?? ''), Math.max(4, width));
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  const last = String(clipped[maxLines - 1] ?? '');
  clipped[maxLines - 1] = `${last.replace(/[.…]+$/, '').slice(0, Math.max(1, last.length - 1))}…`;
  return clipped;
}

function drawCenteredLines(doc, lines, centerX, startY, lineHeight) {
  lines.forEach((line, index) => doc.text(String(line), centerX, startY + (index * lineHeight), { align: 'center' }));
}

function entryAt(classItem, day, slotIndex) {
  return classItem.entries.find((entry) => (
    entry.day === day
    && slotIndex >= entry.startSlot
    && slotIndex < entry.startSlot + entry.span
  )) ?? null;
}

export function generateClassWeekPdf({
  course,
  classItem,
  weekDate,
  sourceName,
  semesterLabel = '2º Semestre/2026',
}) {
  if (!course || !classItem) throw new Error('Turma não selecionada para gerar o PDF.');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const tableX = marginX;
  const tableWidth = pageWidth - (marginX * 2);
  const numberWidth = 9;
  const timeWidth = 15;
  const dayWidth = (tableWidth - numberWidth - timeWidth) / 6;
  const rowHeight = 18;
  const classBarHeight = 7;
  const headerHeight = 7;
  const tableTop = 47;
  const gridTop = tableTop + classBarHeight + headerHeight;
  const days = DAY_ORDER;
  const weekStart = mondayOfWeek(weekDate);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 32, 51);
  doc.setFontSize(19);
  doc.text('CEFSA', marginX, 19);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Centro Educacional da Fundação Salvador Arena', marginX, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Utilização de salas/laboratórios', pageWidth / 2, 17, { align: 'center' });
  doc.setFontSize(10);
  doc.text(semesterLabel, pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(8.5);
  doc.text('FACULDADE ENGENHEIRO', pageWidth - marginX, 17, { align: 'right' });
  doc.setFontSize(10.5);
  doc.text('SALVADOR ARENA', pageWidth - marginX, 22, { align: 'right' });

  const dayStartX = tableX + numberWidth + timeWidth;
  doc.setFontSize(9);
  for (let i = 0; i < 6; i += 1) {
    doc.text(formatDate(addDays(weekStart, i)), dayStartX + (i * dayWidth) + (dayWidth / 2), 35, { align: 'center' });
  }

  doc.setFillColor(8, 45, 94);
  doc.setDrawColor(0, 0, 0);
  doc.rect(tableX + numberWidth, tableTop, tableWidth - numberWidth, classBarHeight, 'FD');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(classItem.name, tableX + numberWidth + ((tableWidth - numberWidth) / 2), tableTop + 5, { align: 'center' });

  doc.setTextColor(17, 32, 51);
  doc.setFillColor(220, 229, 238);
  doc.setFontSize(8.5);
  doc.rect(tableX, tableTop + classBarHeight, numberWidth, headerHeight, 'FD');
  doc.rect(tableX + numberWidth, tableTop + classBarHeight, timeWidth, headerHeight, 'FD');
  doc.text('Hor.', tableX + numberWidth + (timeWidth / 2), tableTop + classBarHeight + 5, { align: 'center' });
  days.forEach((day, index) => {
    const x = dayStartX + (index * dayWidth);
    doc.rect(x, tableTop + classBarHeight, dayWidth, headerHeight, 'FD');
    doc.text(day, x + (dayWidth / 2), tableTop + classBarHeight + 5, { align: 'center' });
  });

  classItem.slots.forEach((slot, slotIndex) => {
    const y = gridTop + (slotIndex * rowHeight);
    doc.setFillColor(slotIndex % 2 === 0 ? 223 : 232, slotIndex % 2 === 0 ? 235 : 241, slotIndex % 2 === 0 ? 246 : 248);
    doc.rect(tableX, y, numberWidth, rowHeight, 'FD');
    doc.setFillColor(230, 235, 242);
    doc.rect(tableX + numberWidth, y, timeWidth, rowHeight, 'FD');

    doc.setTextColor(17, 32, 51);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`${11 + slotIndex}ª`, tableX + (numberWidth / 2), y + (rowHeight / 2) + 1, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(slot.start, tableX + numberWidth + (timeWidth / 2), y + (rowHeight / 2) + 1, { align: 'center' });

    for (let dayIndex = 0; dayIndex < 6; dayIndex += 1) {
      doc.setFillColor(255, 255, 255);
      doc.rect(dayStartX + (dayIndex * dayWidth), y, dayWidth, rowHeight, 'FD');
    }
  });

  classItem.entries.forEach((entry) => {
    const dayIndex = days.indexOf(entry.day);
    if (dayIndex < 0) return;
    const x = dayStartX + (dayIndex * dayWidth);
    const y = gridTop + (entry.startSlot * rowHeight);
    const height = entry.span * rowHeight;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.rect(x, y, dayWidth, height, 'FD');

    const innerWidth = dayWidth - 3;
    let cursorY = y + 5;
    const subjectSize = height >= 30 ? 7.7 : 6.8;
    const professorSize = height >= 30 ? 7.1 : 6.4;
    const maxSubjectLines = height >= 30 ? 4 : 2;

    doc.setTextColor(20, 25, 32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(subjectSize);
    const subjectLines = fitLines(doc, entry.subject, innerWidth, maxSubjectLines);
    drawCenteredLines(doc, subjectLines, x + (dayWidth / 2), cursorY, 3.25);
    cursorY += subjectLines.length * 3.25 + 1.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(professorSize);
    const professorLines = fitLines(doc, entry.professor, innerWidth, height >= 30 ? 2 : 1);
    drawCenteredLines(doc, professorLines, x + (dayWidth / 2), cursorY, 3.05);

    if (entry.room) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(String(entry.room), x + (dayWidth / 2), y + height - 2.2, { align: 'center' });
    }
  });

  (classItem.notes ?? []).forEach((note) => {
    const dayIndex = days.indexOf(note.day);
    if (dayIndex < 0) return;
    const hasEntry = classItem.entries.some((entry) => entry.day === note.day);
    if (hasEntry) return;
    const x = dayStartX + (dayIndex * dayWidth);
    const y = gridTop;
    const height = classItem.slots.length * rowHeight;
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, dayWidth, height, 'FD');
    doc.setTextColor(35, 42, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.7);
    const lines = fitLines(doc, note.text, dayWidth - 3, 18);
    doc.text(lines, x + 1.5, y + 4.5, { maxWidth: dayWidth - 3, lineHeightFactor: 1.12 });
  });

  const footerY = pageHeight - 9;
  doc.setTextColor(70, 78, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`${course.name} · Fonte: ${sourceName || 'planilha importada'}`, marginX, footerY);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth - marginX, footerY, { align: 'right' });

  const filename = `${safeFilename(classItem.name)} - semana ${formatDate(weekStart)}.pdf`;
  doc.save(filename);
  return filename;
}
