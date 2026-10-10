import './styles.css';
import { parseScheduleWorkbook } from './excelParser.js';
import { generateClassWeekPdf, generateCourseWeekPdf } from './pdfGenerator.js';

const DEFAULT_FILE = '/data/Horario Azul - Faculdade - 2026.2.xls';
const FALLBACK_FILE = '/data/horario-fallback.json';
const APP_VERSION = '0.2.4';
const VIEW_CLASS_WEEK = 'class-week';
const VIEW_COURSE_DAY = 'course-day';
const VIEW_COURSE_WEEK = 'course-week';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="page-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">PROTÓTIPO ACADÊMICO · v${APP_VERSION}</p>
        <h1>Ensalamento 2026.2</h1>
        <p class="subtitle">Grade importada diretamente do Excel, com visualização diária/semanal, edição por arrastar e soltar e impressão semanal com opção de salvar em PDF.</p>
      </div>
      <label class="file-button">
        <span>Carregar outro Excel</span>
        <input id="fileInput" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </label>
    </header>

    <section class="toolbar panel">
      <label>
        <span>Curso / planilha</span>
        <select id="courseSelect"></select>
      </label>
      <label>
        <span>Turma</span>
        <select id="classSelect"></select>
      </label>
      <label>
        <span>Visualização</span>
        <select id="viewModeSelect">
          <option value="${VIEW_CLASS_WEEK}">Turma · semana</option>
          <option value="${VIEW_COURSE_DAY}">Todas as turmas · dia</option>
          <option value="${VIEW_COURSE_WEEK}">Todas as turmas · semana</option>
        </select>
      </label>
      <label id="dayFilterLabel" hidden>
        <span>Dia</span>
        <select id="daySelect"></select>
      </label>
      <label>
        <span>Semana da impressão</span>
        <input id="weekDateInput" class="date-input" type="date" />
      </label>
      <div class="toolbar-actions">
        <button id="coursePdfButton" class="button primary" type="button">Imprimir semana / PDF</button>
        <button id="pdfButton" class="button secondary" type="button">Imprimir turma / PDF</button>
        <button id="undoButton" class="button secondary" type="button" disabled>Desfazer</button>
        <button id="resetButton" class="button secondary" type="button">Restaurar turma</button>
      </div>
    </section>

    <section class="stats" aria-label="Resumo da planilha">
      <article class="stat"><span>Arquivo</span><strong id="statFile">—</strong></article>
      <article class="stat"><span>Turmas</span><strong id="statClasses">0</strong></article>
      <article class="stat"><span>Aulas</span><strong id="statLessons">0</strong></article>
      <article class="stat"><span>Alterações</span><strong id="statChanges">0</strong></article>
    </section>

    <section class="panel schedule-panel">
      <div class="section-heading">
        <div>
          <h2 id="scheduleTitle">Carregando grade…</h2>
          <p id="scheduleMeta">Aguarde a leitura da planilha.</p>
        </div>
        <div id="legend" class="legend">
          <span><i class="legend-dot tone-sample tone-1"></i>Cores por professor</span>
          <span><i class="legend-dot changed"></i>Alterada</span>
        </div>
      </div>
      <div id="scheduleScroll" class="schedule-scroll">
        <div id="scheduleGrid" class="schedule-grid" aria-live="polite"></div>
      </div>
      <div id="overviewContainer" class="overview-container" hidden></div>
      <div id="notesArea" class="notes-area" hidden></div>
    </section>

    <section class="bottom-grid">
      <article class="panel details-panel">
        <h2>Detalhes / movimentação</h2>
        <div id="lessonDetails" class="details-empty">Clique em uma aula para ver os detalhes.</div>
        <div id="manualMove" class="manual-move" hidden>
          <label><span>Dia de destino</span><select id="manualDay"></select></label>
          <label><span>Início</span><select id="manualSlot"></select></label>
          <button id="manualMoveButton" class="button secondary" type="button">Mover aula selecionada</button>
        </div>
      </article>
      <article class="panel activity-panel">
        <h2>Validação</h2>
        <div id="statusMessage" class="status-message info">Nenhuma alteração realizada.</div>
        <p class="hint">O arraste aceita áreas vazias e também cards ocupados. Ao trocar aulas, são validados duração, intervalo e conflito de professor em todas as turmas importadas.</p>
      </article>
    </section>
  </main>
`;

const els = {
  fileInput: document.querySelector('#fileInput'),
  courseSelect: document.querySelector('#courseSelect'),
  classSelect: document.querySelector('#classSelect'),
  viewModeSelect: document.querySelector('#viewModeSelect'),
  dayFilterLabel: document.querySelector('#dayFilterLabel'),
  daySelect: document.querySelector('#daySelect'),
  weekDateInput: document.querySelector('#weekDateInput'),
  coursePdfButton: document.querySelector('#coursePdfButton'),
  pdfButton: document.querySelector('#pdfButton'),
  undoButton: document.querySelector('#undoButton'),
  resetButton: document.querySelector('#resetButton'),
  statFile: document.querySelector('#statFile'),
  statClasses: document.querySelector('#statClasses'),
  statLessons: document.querySelector('#statLessons'),
  statChanges: document.querySelector('#statChanges'),
  scheduleTitle: document.querySelector('#scheduleTitle'),
  scheduleMeta: document.querySelector('#scheduleMeta'),
  legend: document.querySelector('#legend'),
  scheduleScroll: document.querySelector('#scheduleScroll'),
  scheduleGrid: document.querySelector('#scheduleGrid'),
  overviewContainer: document.querySelector('#overviewContainer'),
  notesArea: document.querySelector('#notesArea'),
  lessonDetails: document.querySelector('#lessonDetails'),
  manualMove: document.querySelector('#manualMove'),
  manualDay: document.querySelector('#manualDay'),
  manualSlot: document.querySelector('#manualSlot'),
  manualMoveButton: document.querySelector('#manualMoveButton'),
  statusMessage: document.querySelector('#statusMessage'),
};

let dataset = null;
let selectedCourseId = null;
let selectedClassId = null;
let selectedLessonId = null;
let selectedOverviewDay = 'Segunda-feira';
let viewMode = VIEW_CLASS_WEEK;
let dragLessonId = null;
let undoStack = [];

const normalizeKey = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const toMinutes = (hhmm) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  return (hour * 60) + minute;
};

function nextMondayIso() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utc.getUTCDay();
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
  utc.setUTCDate(utc.getUTCDate() + daysUntilMonday);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

function normalizeDataset(data) {
  data.courses.forEach((course) => {
    course.classes.forEach((classItem) => {
      classItem.entries.forEach((entry) => {
        entry.courseId = entry.courseId ?? course.id;
        entry.classId = entry.classId ?? classItem.id;
        entry.className = entry.className ?? classItem.name;
        entry.originalDay = entry.originalDay ?? entry.day;
        entry.originalStartSlot = entry.originalStartSlot ?? entry.startSlot;
      });
      classItem.notes = classItem.notes ?? [];
    });
  });
  return data;
}

function professorKeys(value) {
  const normalized = normalizeKey(value);
  if (!normalized || normalized.includes('nao identificado')) return [];
  return normalized
    .split(/\s*\/\s*|\s+e\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function allClasses() {
  return dataset?.courses.flatMap((course) => course.classes) ?? [];
}

function allEntries() {
  return allClasses().flatMap((classItem) => classItem.entries);
}

function getCourse() {
  return dataset?.courses.find((course) => course.id === selectedCourseId) ?? null;
}

function getClass() {
  return getCourse()?.classes.find((classItem) => classItem.id === selectedClassId) ?? null;
}

function getClassById(classId) {
  return allClasses().find((classItem) => classItem.id === classId) ?? null;
}

function getEntry(entryId) {
  return allEntries().find((entry) => entry.id === entryId) ?? null;
}

function getEntryInterval(entry, day = entry.day, startSlot = entry.startSlot) {
  const classItem = getClassById(entry.classId);
  if (!classItem) return null;
  const first = classItem.slots[startSlot];
  const last = classItem.slots[startSlot + entry.span - 1];
  if (!first || !last) return null;
  return {
    day,
    start: toMinutes(first.start),
    end: toMinutes(last.end),
    label: `${first.start}–${last.end}`,
  };
}

function isContiguousSpan(classItem, startSlot, span) {
  if (startSlot < 0 || startSlot + span > classItem.slots.length) return false;
  for (let index = startSlot; index < startSlot + span - 1; index += 1) {
    if (classItem.slots[index].end !== classItem.slots[index + 1].start) return false;
  }
  return true;
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function findProfessorConflicts(entry, day, startSlot, excludedIds = []) {
  const proposed = getEntryInterval(entry, day, startSlot);
  if (!proposed) return [{ reason: 'Horário de destino inválido.' }];
  const sourceProfessors = professorKeys(entry.professor);
  if (!sourceProfessors.length) return [];
  const excluded = new Set([entry.id, ...excludedIds]);

  return allEntries().filter((other) => {
    if (excluded.has(other.id)) return false;
    const commonProfessor = professorKeys(other.professor).some((key) => sourceProfessors.includes(key));
    if (!commonProfessor || other.day !== day) return false;
    const otherInterval = getEntryInterval(other);
    return otherInterval && rangesOverlap(proposed, otherInterval);
  });
}

function setStatus(message, type = 'info') {
  els.statusMessage.className = `status-message ${type}`;
  els.statusMessage.textContent = message;
}

function countChanges() {
  return allEntries().filter((entry) => entry.day !== entry.originalDay || entry.startSlot !== entry.originalStartSlot).length;
}

function updateStats() {
  if (!dataset) return;
  els.statFile.textContent = dataset.source;
  els.statFile.title = dataset.source;
  els.statClasses.textContent = String(allClasses().length);
  els.statLessons.textContent = String(allEntries().length);
  els.statChanges.textContent = String(countChanges());
  els.undoButton.disabled = undoStack.length === 0;
}

function sortClasses(classes) {
  return [...classes].sort((a, b) => {
    const numberA = Number(a.name.match(/(\d+)/)?.[1] ?? 999);
    const numberB = Number(b.name.match(/(\d+)/)?.[1] ?? 999);
    return numberA - numberB || a.name.localeCompare(b.name, 'pt-BR');
  });
}

function populateSelectors(preferredCourse = null, preferredClass = null) {
  els.courseSelect.innerHTML = '';
  dataset.courses.forEach((course) => els.courseSelect.add(new Option(course.name, course.id)));

  const defaultCourse = preferredCourse
    ?? dataset.courses.find((course) => normalizeKey(course.name).includes('computacao'))?.id
    ?? dataset.courses[0].id;
  selectedCourseId = dataset.courses.some((course) => course.id === defaultCourse) ? defaultCourse : dataset.courses[0].id;
  els.courseSelect.value = selectedCourseId;

  populateClassSelector(preferredClass);
}

function populateClassSelector(preferredClass = null) {
  const course = getCourse();
  els.classSelect.innerHTML = '';
  const classes = sortClasses(course?.classes ?? []);
  classes.forEach((classItem) => els.classSelect.add(new Option(classItem.name, classItem.id)));

  const defaultClass = preferredClass
    ?? classes.find((classItem) => /\bEC\s*9\b/i.test(classItem.name))?.id
    ?? classes[0]?.id;
  selectedClassId = classes.some((classItem) => classItem.id === defaultClass) ? defaultClass : classes[0]?.id;
  els.classSelect.value = selectedClassId ?? '';
  selectedLessonId = null;
  populateDaySelector();
  render();
}

function populateDaySelector() {
  const course = getCourse();
  const days = [...new Set((course?.classes ?? []).flatMap((classItem) => classItem.days))];
  els.daySelect.innerHTML = '';
  days.forEach((day) => els.daySelect.add(new Option(day, day)));
  if (!days.includes(selectedOverviewDay)) selectedOverviewDay = days[0] ?? 'Segunda-feira';
  els.daySelect.value = selectedOverviewDay;
}

function cardColor(professor) {
  const colors = ['tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5', 'tone-6'];
  let hash = 0;
  for (const char of normalizeKey(professor)) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}

function isChanged(entry) {
  return entry.day !== entry.originalDay || entry.startSlot !== entry.originalStartSlot;
}

function entryAt(classItem, day, startSlot, span, ignoredId = null) {
  const endSlot = startSlot + span;
  return classItem.entries.filter((entry) => {
    if (entry.id === ignoredId || entry.day !== day) return false;
    const otherEnd = entry.startSlot + entry.span;
    return entry.startSlot < endSlot && startSlot < otherEnd;
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showLessonDetails(entry) {
  if (!entry) {
    els.lessonDetails.className = 'details-empty';
    els.lessonDetails.textContent = 'Clique em uma aula para ver os detalhes.';
    els.manualMove.hidden = true;
    return;
  }

  const interval = getEntryInterval(entry);
  els.lessonDetails.className = 'lesson-details';
  els.lessonDetails.innerHTML = `
    <dl>
      <div><dt>Disciplina</dt><dd>${escapeHtml(entry.subject)}</dd></div>
      <div><dt>Professor</dt><dd>${escapeHtml(entry.professor)}</dd></div>
      <div><dt>Turma</dt><dd>${escapeHtml(entry.className)}</dd></div>
      <div><dt>Dia</dt><dd>${escapeHtml(entry.day)}</dd></div>
      <div><dt>Horário</dt><dd>${escapeHtml(interval?.label ?? '—')}</dd></div>
      <div><dt>Estado</dt><dd>${isChanged(entry) ? 'Alterada nesta sessão' : 'Original da planilha'}</dd></div>
    </dl>
  `;

  const classItem = getClassById(entry.classId);
  els.manualDay.innerHTML = '';
  classItem.days.forEach((day) => els.manualDay.add(new Option(day, day)));
  els.manualDay.value = entry.day;
  els.manualSlot.innerHTML = '';
  classItem.slots.forEach((slot, index) => {
    if (isContiguousSpan(classItem, index, entry.span)) {
      const last = classItem.slots[index + entry.span - 1];
      els.manualSlot.add(new Option(`${slot.start}–${last.end}`, String(index)));
    }
  });
  els.manualSlot.value = String(entry.startSlot);
  els.manualMove.hidden = false;
}

function clearDragTargets() {
  document.querySelectorAll('.drop-cell.is-over, .lesson-card.is-drop-target').forEach((element) => {
    element.classList.remove('is-over', 'is-drop-target');
  });
}

function canDrop(entry, classItem, slotIndex) {
  return Boolean(entry && classItem && isContiguousSpan(classItem, slotIndex, entry.span));
}

function bindDropTarget(element, day, slotIndex, classItem) {
  element.addEventListener('dragover', (event) => {
    const entry = getEntry(dragLessonId);
    if (!canDrop(entry, classItem, slotIndex)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    clearDragTargets();
    element.classList.add(element.classList.contains('lesson-card') ? 'is-drop-target' : 'is-over');
  });

  element.addEventListener('drop', (event) => {
    const entry = getEntry(dragLessonId);
    if (!canDrop(entry, classItem, slotIndex)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragTargets();
    const entryId = event.dataTransfer.getData('text/plain') || dragLessonId;
    moveEntry(entryId, day, slotIndex);
  });
}

function createLessonCard(entry, dayIndex, classItem) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `lesson-card ${cardColor(entry.professor)}${isChanged(entry) ? ' is-changed' : ''}${selectedLessonId === entry.id ? ' is-selected' : ''}`;
  card.style.gridColumn = String(dayIndex + 2);
  card.style.gridRow = `${entry.startSlot + 2} / span ${entry.span}`;
  card.draggable = true;
  card.dataset.entryId = entry.id;
  card.innerHTML = `
    <span class="lesson-subject">${escapeHtml(entry.subject)}</span>
    <span class="lesson-professor">${escapeHtml(entry.professor)}</span>
  `;

  card.addEventListener('click', () => {
    if (dragLessonId) return;
    selectedLessonId = entry.id;
    renderSchedule();
    showLessonDetails(entry);
  });

  card.addEventListener('dragstart', (event) => {
    dragLessonId = entry.id;
    selectedLessonId = entry.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
    try { event.dataTransfer.setDragImage(card, Math.min(40, card.offsetWidth / 2), 24); } catch { /* navegador sem suporte */ }
    window.setTimeout(() => card.classList.add('is-dragging'), 0);
    showLessonDetails(entry);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    clearDragTargets();
    window.setTimeout(() => { dragLessonId = null; }, 0);
  });

  bindDropTarget(card, entry.day, entry.startSlot, classItem);
  return card;
}

function renderSchedule() {
  const classItem = getClass();
  if (!classItem) {
    els.scheduleGrid.innerHTML = '<p class="empty-state">Nenhuma turma encontrada.</p>';
    return;
  }

  const days = classItem.days;
  const slots = classItem.slots;
  els.scheduleTitle.textContent = `${getCourse().name} · ${classItem.name}`;
  els.scheduleMeta.textContent = `${slots.length} horários · ${classItem.entries.length} blocos · arraste para área vazia ou sobre outra aula para trocar`;

  els.scheduleGrid.innerHTML = '';
  els.scheduleGrid.style.setProperty('--day-count', String(days.length));
  els.scheduleGrid.style.setProperty('--slot-count', String(slots.length));

  const corner = document.createElement('div');
  corner.className = 'grid-corner';
  corner.textContent = 'Horário';
  corner.style.gridColumn = '1';
  corner.style.gridRow = '1';
  els.scheduleGrid.append(corner);

  days.forEach((day, dayIndex) => {
    const header = document.createElement('div');
    header.className = 'day-header';
    header.textContent = day.replace('-feira', '');
    header.style.gridColumn = String(dayIndex + 2);
    header.style.gridRow = '1';
    els.scheduleGrid.append(header);
  });

  slots.forEach((slot, slotIndex) => {
    const time = document.createElement('div');
    time.className = 'time-cell';
    time.innerHTML = `<strong>${escapeHtml(slot.start)}</strong><span>${escapeHtml(slot.end)}</span>`;
    time.style.gridColumn = '1';
    time.style.gridRow = String(slotIndex + 2);
    els.scheduleGrid.append(time);

    days.forEach((day, dayIndex) => {
      const cell = document.createElement('div');
      cell.className = 'drop-cell';
      cell.dataset.day = day;
      cell.dataset.slot = String(slotIndex);
      cell.style.gridColumn = String(dayIndex + 2);
      cell.style.gridRow = String(slotIndex + 2);
      bindDropTarget(cell, day, slotIndex, classItem);
      els.scheduleGrid.append(cell);
    });
  });

  classItem.entries.forEach((entry) => {
    const dayIndex = days.indexOf(entry.day);
    if (dayIndex >= 0) els.scheduleGrid.append(createLessonCard(entry, dayIndex, classItem));
  });

  if (classItem.notes.length) {
    els.notesArea.hidden = false;
    els.notesArea.innerHTML = `<strong>Observações da planilha</strong>${classItem.notes.map((note) => `<p><b>${escapeHtml(note.day)}:</b> ${escapeHtml(note.text)}</p>`).join('')}`;
  } else {
    els.notesArea.hidden = true;
    els.notesArea.innerHTML = '';
  }

  showLessonDetails(getEntry(selectedLessonId));
}

function createOverviewLesson(entry, classItem) {
  const interval = getEntryInterval(entry);
  const article = document.createElement('article');
  article.className = `overview-lesson ${cardColor(entry.professor)} ${isChanged(entry) ? 'is-changed' : ''}`;
  article.innerHTML = `
    <strong>${escapeHtml(interval?.label ?? '')}</strong>
    <span>${escapeHtml(entry.subject)}</span>
    <small>${escapeHtml(entry.professor)}</small>
  `;
  article.addEventListener('click', () => {
    selectedClassId = classItem.id;
    els.classSelect.value = classItem.id;
    selectedLessonId = entry.id;
    viewMode = VIEW_CLASS_WEEK;
    els.viewModeSelect.value = viewMode;
    updateViewControls();
    render();
  });
  return article;
}

function renderCourseDayOverview() {
  const course = getCourse();
  const classes = sortClasses(course?.classes ?? []);
  els.scheduleTitle.textContent = `${course.name} · ${selectedOverviewDay}`;
  const total = classes.reduce((count, classItem) => count + classItem.entries.filter((entry) => entry.day === selectedOverviewDay).length, 0);
  els.scheduleMeta.textContent = `${total} blocos de aula em ${classes.length} turmas · clique em uma aula para abrir a turma`;
  els.overviewContainer.innerHTML = '';

  classes.forEach((classItem) => {
    const lessons = classItem.entries
      .filter((entry) => entry.day === selectedOverviewDay)
      .sort((a, b) => a.startSlot - b.startSlot);
    const panel = document.createElement('section');
    panel.className = 'day-class-panel';
    const heading = document.createElement('div');
    heading.className = 'day-class-heading';
    heading.innerHTML = `<strong>${escapeHtml(classItem.name)}</strong><span>${lessons.length} bloco${lessons.length === 1 ? '' : 's'} no dia</span>`;
    panel.append(heading);
    const body = document.createElement('div');
    body.className = 'day-class-lessons';
    if (!lessons.length) {
      body.innerHTML = '<p class="overview-empty">Sem aulas neste dia.</p>';
    } else {
      lessons.forEach((entry) => body.append(createOverviewLesson(entry, classItem)));
    }
    panel.append(body);
    els.overviewContainer.append(panel);
  });
}

function renderMiniSchedule(classItem) {
  const wrapper = document.createElement('section');
  wrapper.className = 'mini-schedule-card';
  const top = document.createElement('div');
  top.className = 'mini-schedule-heading';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'mini-schedule-title';
  const title = document.createElement('strong');
  title.textContent = classItem.name;
  const meta = document.createElement('span');
  meta.textContent = `${classItem.entries.length} blocos de aula`;
  titleWrap.append(title, meta);
  const pdf = document.createElement('button');
  pdf.type = 'button';
  pdf.className = 'mini-pdf-button';
  pdf.textContent = 'Imprimir / PDF';
  pdf.addEventListener('click', () => generatePdfForClass(classItem));
  top.append(titleWrap, pdf);
  wrapper.append(top);

  const grid = document.createElement('div');
  grid.className = 'mini-schedule-grid';
  grid.style.setProperty('--mini-day-count', String(classItem.days.length));
  grid.style.setProperty('--mini-slot-count', String(classItem.slots.length));

  const corner = document.createElement('div');
  corner.className = 'mini-corner';
  corner.textContent = 'Hor.';
  grid.append(corner);
  classItem.days.forEach((day) => {
    const header = document.createElement('div');
    header.className = 'mini-day';
    header.textContent = day.replace('-feira', '');
    grid.append(header);
  });

  classItem.slots.forEach((slot, slotIndex) => {
    const time = document.createElement('div');
    time.className = 'mini-time';
    time.textContent = slot.start;
    time.style.gridColumn = '1';
    time.style.gridRow = String(slotIndex + 2);
    grid.append(time);
    classItem.days.forEach((day, dayIndex) => {
      const cell = document.createElement('div');
      cell.className = 'mini-cell';
      cell.style.gridColumn = String(dayIndex + 2);
      cell.style.gridRow = String(slotIndex + 2);
      grid.append(cell);
    });
  });

  classItem.entries.forEach((entry) => {
    const dayIndex = classItem.days.indexOf(entry.day);
    if (dayIndex < 0) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `mini-entry ${cardColor(entry.professor)} ${isChanged(entry) ? 'is-changed' : ''}`;
    card.style.gridColumn = String(dayIndex + 2);
    card.style.gridRow = `${entry.startSlot + 2} / span ${entry.span}`;
    card.innerHTML = `<strong>${escapeHtml(entry.subject)}</strong><span>${escapeHtml(entry.professor)}</span>`;
    card.addEventListener('click', () => {
      selectedClassId = classItem.id;
      els.classSelect.value = classItem.id;
      selectedLessonId = entry.id;
      viewMode = VIEW_CLASS_WEEK;
      els.viewModeSelect.value = viewMode;
      updateViewControls();
      render();
    });
    grid.append(card);
  });

  wrapper.append(grid);
  return wrapper;
}

function renderCourseWeekOverview() {
  const course = getCourse();
  const classes = sortClasses(course?.classes ?? []);
  els.scheduleTitle.textContent = `${course.name} · visão semanal de todas as turmas`;
  els.scheduleMeta.textContent = `${classes.length} turmas · uma turma por linha · use “Imprimir semana / PDF” para imprimir ou salvar todas em um único PDF`;
  els.overviewContainer.innerHTML = '';
  els.overviewContainer.className = 'overview-container week-overview';
  classes.forEach((classItem) => els.overviewContainer.append(renderMiniSchedule(classItem)));
}

function updateViewControls() {
  const isClassWeek = viewMode === VIEW_CLASS_WEEK;
  els.dayFilterLabel.hidden = viewMode !== VIEW_COURSE_DAY;
  els.scheduleScroll.hidden = !isClassWeek;
  els.overviewContainer.hidden = isClassWeek;
  els.legend.hidden = !isClassWeek;
  els.manualMove.hidden = !isClassWeek || !selectedLessonId;
  els.undoButton.disabled = !isClassWeek || undoStack.length === 0;
}

function moveEntry(entryId, newDay, newStartSlot) {
  const entry = getEntry(entryId);
  const classItem = getClassById(entry?.classId);
  if (!entry || !classItem) return;
  if (!isContiguousSpan(classItem, newStartSlot, entry.span)) {
    setStatus('Destino inválido: o bloco atravessaria um intervalo ou não cabe no final da grade.', 'error');
    return;
  }
  if (entry.day === newDay && entry.startSlot === newStartSlot) return;

  const occupied = entryAt(classItem, newDay, newStartSlot, entry.span, entry.id);
  let swapEntry = null;

  if (occupied.length) {
    if (occupied.length === 1 && occupied[0].startSlot === newStartSlot && occupied[0].span === entry.span) {
      swapEntry = occupied[0];
    } else {
      setStatus('Destino ocupado por um bloco com duração diferente. A troca só ocorre entre blocos equivalentes.', 'error');
      return;
    }
  }

  const excluded = swapEntry ? [swapEntry.id] : [];
  const conflicts = findProfessorConflicts(entry, newDay, newStartSlot, excluded);
  if (conflicts.length) {
    const conflict = conflicts[0];
    const interval = getEntryInterval(conflict);
    setStatus(`Conflito: ${entry.professor} já está em ${conflict.className} (${conflict.subject}) — ${conflict.day}, ${interval?.label ?? 'horário sobreposto'}.`, 'error');
    return;
  }

  const previous = { day: entry.day, startSlot: entry.startSlot };
  let swapPrevious = null;

  if (swapEntry) {
    if (!isContiguousSpan(classItem, previous.startSlot, swapEntry.span)) {
      setStatus('Troca bloqueada: o segundo bloco não cabe no horário de origem.', 'error');
      return;
    }
    const swapConflicts = findProfessorConflicts(swapEntry, previous.day, previous.startSlot, [entry.id]);
    if (swapConflicts.length) {
      const conflict = swapConflicts[0];
      const interval = getEntryInterval(conflict);
      setStatus(`Troca bloqueada: ${swapEntry.professor} teria conflito com ${conflict.className} (${conflict.subject}) — ${conflict.day}, ${interval?.label ?? 'horário sobreposto'}.`, 'error');
      return;
    }
    swapPrevious = { day: swapEntry.day, startSlot: swapEntry.startSlot };
  }

  undoStack.push({ entryId: entry.id, previous, swapEntryId: swapEntry?.id ?? null, swapPrevious });
  entry.day = newDay;
  entry.startSlot = newStartSlot;

  if (swapEntry) {
    swapEntry.day = previous.day;
    swapEntry.startSlot = previous.startSlot;
    setStatus(`Troca realizada: ${entry.subject} ↔ ${swapEntry.subject}.`, 'success');
  } else {
    const interval = getEntryInterval(entry);
    setStatus(`${entry.subject} movida para ${newDay}, ${interval?.label ?? ''}.`, 'success');
  }

  selectedLessonId = entry.id;
  render();
}

function undo() {
  const action = undoStack.pop();
  if (!action) return;
  const entry = getEntry(action.entryId);
  if (entry) Object.assign(entry, action.previous);
  if (action.swapEntryId && action.swapPrevious) {
    const swapEntry = getEntry(action.swapEntryId);
    if (swapEntry) Object.assign(swapEntry, action.swapPrevious);
  }
  setStatus('Última alteração desfeita.', 'info');
  render();
}

function resetCurrentClass() {
  const classItem = getClass();
  if (!classItem) return;
  classItem.entries.forEach((entry) => {
    entry.day = entry.originalDay;
    entry.startSlot = entry.originalStartSlot;
  });
  undoStack = undoStack.filter((action) => getEntry(action.entryId)?.classId !== classItem.id);
  selectedLessonId = null;
  setStatus(`${classItem.name} restaurada para a posição original da planilha.`, 'info');
  render();
}

function generatePdfForClass(classItem = getClass()) {
  const course = dataset?.courses.find((item) => item.classes.some((candidate) => candidate.id === classItem?.id)) ?? getCourse();
  if (!course || !classItem) return;
  try {
    const filename = generateClassWeekPdf({
      course,
      classItem,
      weekDate: els.weekDateInput.value,
      sourceName: dataset.source,
    });
    setStatus(`Janela de impressão aberta: ${filename}. Para PDF, escolha “Salvar como PDF”.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Não foi possível abrir a impressão: ${error.message}`, 'error');
  }
}


function generatePdfForCourse(course = getCourse()) {
  if (!course) return;
  try {
    const filename = generateCourseWeekPdf({
      course,
      weekDate: els.weekDateInput.value,
      sourceName: dataset.source,
    });
    setStatus(`Impressão semanal aberta: ${filename}. Para PDF, escolha “Salvar como PDF”.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Não foi possível abrir a impressão semanal: ${error.message}`, 'error');
  }
}

function render() {
  updateViewControls();
  els.overviewContainer.className = 'overview-container';
  if (viewMode === VIEW_CLASS_WEEK) {
    renderSchedule();
  } else if (viewMode === VIEW_COURSE_DAY) {
    els.notesArea.hidden = true;
    showLessonDetails(null);
    renderCourseDayOverview();
  } else {
    els.notesArea.hidden = true;
    showLessonDetails(null);
    renderCourseWeekOverview();
  }
  updateStats();
}

async function loadDefaultWorkbook() {
  try {
    setStatus('Lendo o Excel original…', 'info');
    const response = await fetch(DEFAULT_FILE);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    dataset = normalizeDataset(parseScheduleWorkbook(buffer, 'Horario Azul - Faculdade - 2026.2.xls'));
    setStatus('Excel carregado. As alterações ficam apenas nesta sessão.', 'success');
  } catch (error) {
    console.error('Falha ao ler XLS, usando fallback JSON:', error);
    const response = await fetch(FALLBACK_FILE);
    dataset = normalizeDataset(await response.json());
    setStatus('A planilha não pôde ser lida pelo navegador; dados normalizados de contingência foram carregados.', 'warning');
  }
  undoStack = [];
  populateSelectors();
}

async function loadUploadedWorkbook(file) {
  try {
    setStatus(`Lendo ${file.name}…`, 'info');
    const buffer = await file.arrayBuffer();
    const previousCourseName = getCourse()?.name;
    const previousClassName = getClass()?.name;
    dataset = normalizeDataset(parseScheduleWorkbook(buffer, file.name));
    undoStack = [];
    const matchingCourse = dataset.courses.find((course) => course.name === previousCourseName)?.id;
    const matchingClass = dataset.courses
      .flatMap((course) => course.classes)
      .find((classItem) => classItem.name === previousClassName)?.id;
    populateSelectors(matchingCourse, matchingClass);
    setStatus(`${file.name} importado com sucesso.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Não foi possível importar o arquivo: ${error.message}`, 'error');
  }
}

els.courseSelect.addEventListener('change', () => {
  selectedCourseId = els.courseSelect.value;
  populateClassSelector();
});

els.classSelect.addEventListener('change', () => {
  selectedClassId = els.classSelect.value;
  selectedLessonId = null;
  render();
});

els.viewModeSelect.addEventListener('change', () => {
  viewMode = els.viewModeSelect.value;
  selectedLessonId = null;
  updateViewControls();
  render();
});

els.daySelect.addEventListener('change', () => {
  selectedOverviewDay = els.daySelect.value;
  render();
});

els.fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files ?? [];
  if (file) loadUploadedWorkbook(file);
  event.target.value = '';
});

els.undoButton.addEventListener('click', undo);
els.resetButton.addEventListener('click', resetCurrentClass);
els.coursePdfButton.addEventListener('click', () => generatePdfForCourse());
els.pdfButton.addEventListener('click', () => generatePdfForClass());
els.manualMoveButton.addEventListener('click', () => {
  if (!selectedLessonId) return;
  moveEntry(selectedLessonId, els.manualDay.value, Number(els.manualSlot.value));
});

els.weekDateInput.value = nextMondayIso();
loadDefaultWorkbook();
