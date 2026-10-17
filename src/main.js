import './styles.css';
import { parseScheduleWorkbook } from './excelParser.js';
import { generateClassWeekPdf, generateCourseWeekPdf } from './pdfGenerator.js';

const DEFAULT_FILE = '/data/Horario Azul - Faculdade - 2026.2.xls';
const FALLBACK_FILE = '/data/horario-fallback.json';
const APP_VERSION = '0.3.0';
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
        <button id="newLessonButton" class="button primary" type="button">+ Nova aula</button>
        <button id="coursePdfButton" class="button secondary" type="button">Imprimir semana / PDF</button>
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
          <span><i class="legend-dot added"></i>Adicionada</span>
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
        <div id="lessonActions" class="lesson-actions" hidden>
          <button id="editLessonButton" class="button secondary" type="button">Editar aula</button>
          <button id="cancelLessonButton" class="button danger" type="button">Cancelar aula</button>
        </div>
      </article>
      <article class="panel activity-panel">
        <h2>Validação</h2>
        <div id="statusMessage" class="status-message info">Nenhuma alteração realizada.</div>
        <div id="activityLog" class="activity-log"><p class="activity-empty">As alterações desta sessão aparecerão aqui.</p></div>
        <p class="hint">O Excel é a grade-base. Alterações, novas aulas e cancelamentos são aplicados sobre esse estado nesta sessão e refletidos automaticamente nas visões e na impressão.</p>
      </article>
    </section>
  </main>

  <div id="lessonModal" class="modal-backdrop" hidden>
    <section class="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lessonModalTitle">
      <form id="lessonForm">
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow" id="lessonModalContext">Turma</p>
            <h2 id="lessonModalTitle">Nova aula</h2>
          </div>
          <button id="closeLessonModal" class="icon-button" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="lesson-form-grid">
          <label class="field field-wide"><span>Disciplina</span><input id="lessonSubject" type="text" required maxlength="160" /></label>
          <label class="field"><span>Professor</span><input id="lessonProfessor" type="text" required maxlength="120" /></label>
          <label class="field"><span>Sala / laboratório <small>(opcional)</small></span><input id="lessonRoom" type="text" maxlength="80" /></label>
          <label class="field"><span>Dia</span><select id="lessonDay" required></select></label>
          <label class="field"><span>Início</span><select id="lessonStart" required></select></label>
          <label class="field"><span>Fim</span><select id="lessonEnd" required></select></label>
        </div>
        <div id="lessonFormMessage" class="form-message" hidden></div>
        <div class="modal-actions">
          <button id="dismissLessonModal" class="button secondary" type="button">Cancelar</button>
          <button class="button primary" type="submit">Salvar aula</button>
        </div>
      </form>
    </section>
  </div>
`;

const els = {
  fileInput: document.querySelector('#fileInput'),
  courseSelect: document.querySelector('#courseSelect'),
  classSelect: document.querySelector('#classSelect'),
  viewModeSelect: document.querySelector('#viewModeSelect'),
  dayFilterLabel: document.querySelector('#dayFilterLabel'),
  daySelect: document.querySelector('#daySelect'),
  weekDateInput: document.querySelector('#weekDateInput'),
  newLessonButton: document.querySelector('#newLessonButton'),
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
  lessonActions: document.querySelector('#lessonActions'),
  editLessonButton: document.querySelector('#editLessonButton'),
  cancelLessonButton: document.querySelector('#cancelLessonButton'),
  statusMessage: document.querySelector('#statusMessage'),
  activityLog: document.querySelector('#activityLog'),
  lessonModal: document.querySelector('#lessonModal'),
  lessonForm: document.querySelector('#lessonForm'),
  lessonModalContext: document.querySelector('#lessonModalContext'),
  lessonModalTitle: document.querySelector('#lessonModalTitle'),
  closeLessonModal: document.querySelector('#closeLessonModal'),
  dismissLessonModal: document.querySelector('#dismissLessonModal'),
  lessonSubject: document.querySelector('#lessonSubject'),
  lessonProfessor: document.querySelector('#lessonProfessor'),
  lessonRoom: document.querySelector('#lessonRoom'),
  lessonDay: document.querySelector('#lessonDay'),
  lessonStart: document.querySelector('#lessonStart'),
  lessonEnd: document.querySelector('#lessonEnd'),
  lessonFormMessage: document.querySelector('#lessonFormMessage'),
};

let dataset = null;
let selectedCourseId = null;
let selectedClassId = null;
let selectedLessonId = null;
let selectedOverviewDay = 'Segunda-feira';
let viewMode = VIEW_CLASS_WEEK;
let dragLessonId = null;
let undoStack = [];
let activityLog = [];
let editingLessonId = null;
let manualEntrySequence = 0;

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
        entry.origin = entry.origin ?? 'imported';
        entry.status = entry.status ?? 'active';
        entry.originalDay = entry.originalDay ?? entry.day;
        entry.originalStartSlot = entry.originalStartSlot ?? entry.startSlot;
        entry.originalSpan = entry.originalSpan ?? entry.span;
        entry.originalSubject = entry.originalSubject ?? entry.subject;
        entry.originalProfessor = entry.originalProfessor ?? entry.professor;
        entry.originalRoom = entry.originalRoom ?? (entry.room || entry.local || entry.location || '');
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

function allEntries({ includeCancelled = true } = {}) {
  const entries = allClasses().flatMap((classItem) => classItem.entries);
  return includeCancelled ? entries : entries.filter((entry) => entry.status !== 'cancelled');
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

function isImportedEntryAtBaseline(entry, { day = entry.day, startSlot = entry.startSlot, span = entry.span, professor = entry.professor } = {}) {
  if (!entry || entry.origin === 'manual') return false;
  return day === entry.originalDay
    && startSlot === entry.originalStartSlot
    && span === entry.originalSpan
    && normalizeKey(professor) === normalizeKey(entry.originalProfessor);
}

function isBaselineApprovedProfessorOverlap(entry, day, startSlot, other) {
  if (!isImportedEntryAtBaseline(entry, { day, startSlot, span: entry.span, professor: entry.professor })) return false;
  if (!isImportedEntryAtBaseline(other)) return false;

  // Se as duas aulas estão exatamente nas posições importadas do Excel, o possível
  // compartilhamento de professor faz parte da grade-base e deve ser aceito. Isso é
  // importante para aulas compartilhadas entre turmas e também permite restaurar
  // manualmente uma aula ao seu horário original sem gerar um falso conflito.
  return true;
}

function findProfessorConflicts(entry, day, startSlot, excludedIds = []) {
  const proposed = getEntryInterval(entry, day, startSlot);
  if (!proposed) return [{ reason: 'Horário de destino inválido.' }];
  const sourceProfessors = professorKeys(entry.professor);
  if (!sourceProfessors.length) return [];
  const excluded = new Set([entry.id, ...excludedIds]);

  return allEntries({ includeCancelled: false }).filter((other) => {
    if (excluded.has(other.id)) return false;
    const commonProfessor = professorKeys(other.professor).some((key) => sourceProfessors.includes(key));
    if (!commonProfessor || other.day !== day) return false;
    const otherInterval = getEntryInterval(other);
    if (!otherInterval || !rangesOverlap(proposed, otherInterval)) return false;
    if (isBaselineApprovedProfessorOverlap(entry, day, startSlot, other)) return false;
    return true;
  });
}

function setStatus(message, type = 'info') {
  els.statusMessage.className = `status-message ${type}`;
  els.statusMessage.textContent = message;
}

function renderActivityLog() {
  if (!activityLog.length) {
    els.activityLog.innerHTML = '<p class="activity-empty">As alterações desta sessão aparecerão aqui.</p>';
    return;
  }

  els.activityLog.innerHTML = activityLog.slice(0, 8).map((item) => `
    <article class="activity-item">
      <span>${escapeHtml(item.time)}</span>
      <p>${escapeHtml(item.message)}</p>
    </article>
  `).join('');
}

function logActivity(message) {
  activityLog.unshift({
    message,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });
  renderActivityLog();
}

function snapshotEntry(entry) {
  return {
    subject: entry.subject,
    professor: entry.professor,
    room: entry.room || '',
    day: entry.day,
    startSlot: entry.startSlot,
    span: entry.span,
    status: entry.status,
  };
}

function isImportedModified(entry) {
  if (!entry || entry.origin === 'manual' || entry.status === 'cancelled') return false;
  const currentRoom = entry.room || entry.local || entry.location || '';
  return entry.day !== entry.originalDay
    || entry.startSlot !== entry.originalStartSlot
    || entry.span !== entry.originalSpan
    || entry.subject !== entry.originalSubject
    || entry.professor !== entry.originalProfessor
    || currentRoom !== entry.originalRoom;
}

function isChanged(entry) {
  return Boolean(entry && (entry.origin === 'manual' || entry.status === 'cancelled' || isImportedModified(entry)));
}

function entryStateClass(entry) {
  if (entry?.origin === 'manual') return 'is-new';
  if (isImportedModified(entry)) return 'is-changed';
  return '';
}

function countChanges() {
  return allEntries().filter(isChanged).length;
}

function updateStats() {
  if (!dataset) return;
  els.statFile.textContent = dataset.source;
  els.statFile.title = dataset.source;
  els.statClasses.textContent = String(allClasses().length);
  els.statLessons.textContent = String(allEntries({ includeCancelled: false }).length);
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
  const colors = ['tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5', 'tone-6', 'tone-7', 'tone-8', 'tone-9', 'tone-10'];
  let hash = 0;
  for (const char of normalizeKey(professor)) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}


function entryAt(classItem, day, startSlot, span, ignoredId = null) {
  const endSlot = startSlot + span;
  return classItem.entries.filter((entry) => {
    if (entry.status === 'cancelled' || entry.id === ignoredId || entry.day !== day) return false;
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
  if (!entry || entry.status === 'cancelled') {
    els.lessonDetails.className = 'details-empty';
    els.lessonDetails.textContent = 'Clique em uma aula para ver os detalhes.';
    els.manualMove.hidden = true;
    els.lessonActions.hidden = true;
    return;
  }

  const interval = getEntryInterval(entry);
  const stateLabel = entry.origin === 'manual'
    ? 'Adicionada nesta sessão'
    : (isImportedModified(entry) ? 'Alterada nesta sessão' : 'Original da planilha');
  const room = entry.room || entry.local || entry.location || '—';

  els.lessonDetails.className = 'lesson-details';
  els.lessonDetails.innerHTML = `
    <dl>
      <div><dt>Disciplina</dt><dd>${escapeHtml(entry.subject)}</dd></div>
      <div><dt>Professor</dt><dd>${escapeHtml(entry.professor)}</dd></div>
      <div><dt>Turma</dt><dd>${escapeHtml(entry.className)}</dd></div>
      <div><dt>Dia</dt><dd>${escapeHtml(entry.day)}</dd></div>
      <div><dt>Horário</dt><dd>${escapeHtml(interval?.label ?? '—')}</dd></div>
      <div><dt>Sala / laboratório</dt><dd>${escapeHtml(room)}</dd></div>
      <div><dt>Estado</dt><dd>${escapeHtml(stateLabel)}</dd></div>
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
  els.lessonActions.hidden = false;
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
  const stateClass = entryStateClass(entry);
  card.className = `lesson-card ${cardColor(entry.professor)}${stateClass ? ` ${stateClass}` : ''}${selectedLessonId === entry.id ? ' is-selected' : ''}`;
  card.style.gridColumn = String(dayIndex + 2);
  card.style.gridRow = `${entry.startSlot + 2} / span ${entry.span}`;
  card.draggable = true;
  card.dataset.entryId = entry.id;
  const room = entry.room || entry.local || entry.location || '';
  card.innerHTML = `
    ${entry.origin === 'manual' ? '<span class="lesson-badge">NOVA</span>' : ''}
    <span class="lesson-subject">${escapeHtml(entry.subject)}</span>
    <span class="lesson-professor">${escapeHtml(entry.professor)}</span>
    ${room ? `<span class="lesson-room-inline">${escapeHtml(room)}</span>` : ''}
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
  const activeEntries = classItem.entries.filter((entry) => entry.status !== 'cancelled');
  els.scheduleMeta.textContent = `${slots.length} horários · ${activeEntries.length} blocos ativos · arraste para área vazia ou sobre outra aula para trocar`; 

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

  activeEntries.forEach((entry) => {
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
  article.className = `overview-lesson ${cardColor(entry.professor)} ${entryStateClass(entry)}`;
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
  const total = classes.reduce((count, classItem) => count + classItem.entries.filter((entry) => entry.status !== 'cancelled' && entry.day === selectedOverviewDay).length, 0);
  els.scheduleMeta.textContent = `${total} blocos de aula em ${classes.length} turmas · clique em uma aula para abrir a turma`;
  els.overviewContainer.innerHTML = '';

  classes.forEach((classItem) => {
    const lessons = classItem.entries
      .filter((entry) => entry.status !== 'cancelled' && entry.day === selectedOverviewDay)
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
  meta.textContent = `${classItem.entries.filter((entry) => entry.status !== 'cancelled').length} blocos de aula`;
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

  classItem.entries.filter((entry) => entry.status !== 'cancelled').forEach((entry) => {
    const dayIndex = classItem.days.indexOf(entry.day);
    if (dayIndex < 0) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `mini-entry ${cardColor(entry.professor)} ${entryStateClass(entry)}`;
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
  els.lessonActions.hidden = !isClassWeek || !selectedLessonId;
  els.undoButton.disabled = undoStack.length === 0;
}

function setLessonFormMessage(message = '', type = 'error') {
  if (!message) {
    els.lessonFormMessage.hidden = true;
    els.lessonFormMessage.textContent = '';
    return;
  }
  els.lessonFormMessage.hidden = false;
  els.lessonFormMessage.className = `form-message ${type}`;
  els.lessonFormMessage.textContent = message;
}

function populateLessonEndOptions(preferredSpan = null) {
  const classItem = getClass();
  const startSlot = Number(els.lessonStart.value);
  els.lessonEnd.innerHTML = '';
  if (!classItem || !Number.isInteger(startSlot) || !classItem.slots[startSlot]) return;

  for (let endIndex = startSlot; endIndex < classItem.slots.length; endIndex += 1) {
    if (endIndex > startSlot && classItem.slots[endIndex - 1].end !== classItem.slots[endIndex].start) break;
    const span = endIndex - startSlot + 1;
    const label = `${classItem.slots[endIndex].end} · ${span} horário${span === 1 ? '' : 's'}`;
    els.lessonEnd.add(new Option(label, String(span)));
  }

  if (preferredSpan && [...els.lessonEnd.options].some((option) => Number(option.value) === preferredSpan)) {
    els.lessonEnd.value = String(preferredSpan);
  }
}

function openLessonModal(entry = null) {
  const classItem = getClass();
  if (!classItem) return;
  editingLessonId = entry?.id ?? null;
  els.lessonModalContext.textContent = `${getCourse().name} · ${classItem.name}`;
  els.lessonModalTitle.textContent = entry ? 'Editar aula' : 'Nova aula';
  els.lessonSubject.value = entry?.subject ?? '';
  els.lessonProfessor.value = entry?.professor ?? '';
  els.lessonRoom.value = entry?.room || entry?.local || entry?.location || '';

  els.lessonDay.innerHTML = '';
  classItem.days.forEach((day) => els.lessonDay.add(new Option(day, day)));
  els.lessonDay.value = entry?.day ?? classItem.days[0] ?? '';

  els.lessonStart.innerHTML = '';
  classItem.slots.forEach((slot, index) => els.lessonStart.add(new Option(slot.start, String(index))));
  els.lessonStart.value = String(entry?.startSlot ?? 0);
  populateLessonEndOptions(entry?.span ?? 1);
  setLessonFormMessage();
  els.lessonModal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => els.lessonSubject.focus(), 0);
}

function closeLessonModal() {
  els.lessonModal.hidden = true;
  document.body.classList.remove('modal-open');
  editingLessonId = null;
  setLessonFormMessage();
}

function placementError(entry, day, startSlot, span, ignoredId = null) {
  const classItem = getClassById(entry.classId);
  if (!classItem || !isContiguousSpan(classItem, startSlot, span)) {
    return 'O horário selecionado atravessa um intervalo ou ultrapassa o fim da grade.';
  }

  const occupied = entryAt(classItem, day, startSlot, span, ignoredId);
  if (occupied.length) {
    const target = occupied[0];
    const interval = getEntryInterval(target);
    return `A turma já possui ${target.subject} nesse período (${interval?.label ?? 'horário sobreposto'}).`;
  }

  const conflicts = findProfessorConflicts({ ...entry, span }, day, startSlot, ignoredId ? [ignoredId] : []);
  if (conflicts.length) {
    const conflict = conflicts[0];
    const interval = getEntryInterval(conflict);
    return `${entry.professor} já possui ${conflict.subject} em ${conflict.className}, ${conflict.day} (${interval?.label ?? 'horário sobreposto'}).`;
  }

  return null;
}

function saveLessonFromForm(event) {
  event.preventDefault();
  const classItem = getClass();
  const course = getCourse();
  if (!classItem || !course) return;

  const subject = els.lessonSubject.value.trim();
  const professor = els.lessonProfessor.value.trim();
  const room = els.lessonRoom.value.trim();
  const day = els.lessonDay.value;
  const startSlot = Number(els.lessonStart.value);
  const span = Number(els.lessonEnd.value);

  if (!subject || !professor || !day || !Number.isInteger(startSlot) || !Number.isInteger(span) || span < 1) {
    setLessonFormMessage('Preencha disciplina, professor, dia, início e fim.');
    return;
  }

  if (editingLessonId) {
    const entry = getEntry(editingLessonId);
    if (!entry) return;
    const candidate = { ...entry, subject, professor, room, day, startSlot, span };
    const error = placementError(candidate, day, startSlot, span, entry.id);
    if (error) {
      setLessonFormMessage(error);
      return;
    }

    undoStack.push({ type: 'edit', entryId: entry.id, previous: snapshotEntry(entry) });
    Object.assign(entry, { subject, professor, room, day, startSlot, span, status: 'active' });
    selectedLessonId = entry.id;
    const interval = getEntryInterval(entry);
    const message = `${entry.subject} atualizada para ${entry.day}, ${interval?.label ?? ''}.`;
    logActivity(message);
    setStatus(message, 'success');
  } else {
    const entry = {
      id: `manual-${Date.now()}-${manualEntrySequence += 1}`,
      courseId: course.id,
      classId: classItem.id,
      className: classItem.name,
      subject,
      professor,
      room,
      day,
      startSlot,
      span,
      origin: 'manual',
      status: 'active',
      originalDay: null,
      originalStartSlot: null,
      originalSpan: null,
      originalSubject: null,
      originalProfessor: null,
      originalRoom: null,
    };
    const error = placementError(entry, day, startSlot, span);
    if (error) {
      setLessonFormMessage(error);
      return;
    }

    classItem.entries.push(entry);
    undoStack.push({ type: 'create', classId: classItem.id, entryId: entry.id });
    selectedLessonId = entry.id;
    const interval = getEntryInterval(entry);
    const message = `Nova aula adicionada: ${entry.subject} · ${entry.day}, ${interval?.label ?? ''}.`;
    logActivity(message);
    setStatus(message, 'success');
  }

  closeLessonModal();
  render();
}

function cancelSelectedLesson() {
  const entry = getEntry(selectedLessonId);
  if (!entry || entry.status === 'cancelled') return;
  undoStack.push({ type: 'cancel', entryId: entry.id, previousStatus: entry.status });
  entry.status = 'cancelled';
  const message = `${entry.subject} cancelada da grade efetiva.`;
  logActivity(message);
  setStatus(message, 'warning');
  selectedLessonId = null;
  render();
}

function moveEntry(entryId, newDay, newStartSlot) {
  const entry = getEntry(entryId);
  const classItem = getClassById(entry?.classId);
  if (!entry || !classItem || entry.status === 'cancelled') return;
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

  undoStack.push({ type: 'move', entryId: entry.id, previous, swapEntryId: swapEntry?.id ?? null, swapPrevious });
  entry.day = newDay;
  entry.startSlot = newStartSlot;

  if (swapEntry) {
    swapEntry.day = previous.day;
    swapEntry.startSlot = previous.startSlot;
    const message = `Troca realizada: ${entry.subject} ↔ ${swapEntry.subject}.`;
    logActivity(message);
    setStatus(message, 'success');
  } else {
    const interval = getEntryInterval(entry);
    const message = `${entry.subject} movida para ${newDay}, ${interval?.label ?? ''}.`;
    logActivity(message);
    setStatus(message, 'success');
  }

  selectedLessonId = entry.id;
  render();
}

function undo() {
  const action = undoStack.pop();
  if (!action) return;

  if (action.type === 'move' || !action.type) {
    const entry = getEntry(action.entryId);
    if (entry) Object.assign(entry, action.previous);
    if (action.swapEntryId && action.swapPrevious) {
      const swapEntry = getEntry(action.swapEntryId);
      if (swapEntry) Object.assign(swapEntry, action.swapPrevious);
    }
  } else if (action.type === 'create') {
    const classItem = getClassById(action.classId);
    if (classItem) classItem.entries = classItem.entries.filter((entry) => entry.id !== action.entryId);
    if (selectedLessonId === action.entryId) selectedLessonId = null;
  } else if (action.type === 'edit') {
    const entry = getEntry(action.entryId);
    if (entry) Object.assign(entry, action.previous);
  } else if (action.type === 'cancel') {
    const entry = getEntry(action.entryId);
    if (entry) entry.status = action.previousStatus ?? 'active';
  }

  logActivity('Última alteração desfeita.');
  setStatus('Última alteração desfeita.', 'info');
  render();
}

function resetCurrentClass() {
  const classItem = getClass();
  if (!classItem) return;

  classItem.entries = classItem.entries.filter((entry) => entry.origin !== 'manual');
  classItem.entries.forEach((entry) => {
    entry.day = entry.originalDay;
    entry.startSlot = entry.originalStartSlot;
    entry.span = entry.originalSpan;
    entry.subject = entry.originalSubject;
    entry.professor = entry.originalProfessor;
    entry.room = entry.originalRoom || '';
    entry.status = 'active';
  });

  undoStack = undoStack.filter((action) => {
    const entry = getEntry(action.entryId);
    return entry && entry.classId !== classItem.id;
  });
  selectedLessonId = null;
  const message = `${classItem.name} restaurada para a grade-base importada do Excel.`;
  logActivity(message);
  setStatus(message, 'info');
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
  activityLog = [];
  renderActivityLog();
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
    activityLog = [];
    renderActivityLog();
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

els.newLessonButton.addEventListener('click', () => openLessonModal());
els.undoButton.addEventListener('click', undo);
els.resetButton.addEventListener('click', resetCurrentClass);
els.coursePdfButton.addEventListener('click', () => generatePdfForCourse());
els.pdfButton.addEventListener('click', () => generatePdfForClass());
els.manualMoveButton.addEventListener('click', () => {
  if (!selectedLessonId) return;
  moveEntry(selectedLessonId, els.manualDay.value, Number(els.manualSlot.value));
});
els.editLessonButton.addEventListener('click', () => {
  const entry = getEntry(selectedLessonId);
  if (entry) openLessonModal(entry);
});
els.cancelLessonButton.addEventListener('click', cancelSelectedLesson);
els.lessonStart.addEventListener('change', () => populateLessonEndOptions());
els.lessonForm.addEventListener('submit', saveLessonFromForm);
els.closeLessonModal.addEventListener('click', closeLessonModal);
els.dismissLessonModal.addEventListener('click', closeLessonModal);
els.lessonModal.addEventListener('click', (event) => {
  if (event.target === els.lessonModal) closeLessonModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.lessonModal.hidden) closeLessonModal();
});

els.weekDateInput.value = nextMondayIso();
renderActivityLog();
loadDefaultWorkbook();
