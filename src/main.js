import './styles.css';
import { parseScheduleWorkbook } from './excelParser.js';

const DEFAULT_FILE = '/data/Horario Azul - Faculdade - 2026.2.xls';
const FALLBACK_FILE = '/data/horario-fallback.json';
const APP_VERSION = '0.1.0';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="page-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">PROTÓTIPO ACADÊMICO · v${APP_VERSION}</p>
        <h1>Ensalamento 2026.2</h1>
        <p class="subtitle">Grade importada diretamente do Excel, com edição por arrastar e soltar.</p>
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
      <div class="toolbar-actions">
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
        <div class="legend">
          <span><i class="legend-dot normal"></i>Aula</span>
          <span><i class="legend-dot changed"></i>Alterada</span>
        </div>
      </div>
      <div id="scheduleScroll" class="schedule-scroll">
        <div id="scheduleGrid" class="schedule-grid" aria-live="polite"></div>
      </div>
      <div id="notesArea" class="notes-area" hidden></div>
    </section>

    <section class="bottom-grid">
      <article class="panel details-panel">
        <h2>Detalhes</h2>
        <div id="lessonDetails" class="details-empty">Clique em uma aula para ver os detalhes.</div>
      </article>
      <article class="panel activity-panel">
        <h2>Validação</h2>
        <div id="statusMessage" class="status-message info">Nenhuma alteração realizada.</div>
        <p class="hint">Ao mover uma aula, o protótipo verifica sobreposição do professor em todas as turmas importadas.</p>
      </article>
    </section>
  </main>
`;

const els = {
  fileInput: document.querySelector('#fileInput'),
  courseSelect: document.querySelector('#courseSelect'),
  classSelect: document.querySelector('#classSelect'),
  undoButton: document.querySelector('#undoButton'),
  resetButton: document.querySelector('#resetButton'),
  statFile: document.querySelector('#statFile'),
  statClasses: document.querySelector('#statClasses'),
  statLessons: document.querySelector('#statLessons'),
  statChanges: document.querySelector('#statChanges'),
  scheduleTitle: document.querySelector('#scheduleTitle'),
  scheduleMeta: document.querySelector('#scheduleMeta'),
  scheduleGrid: document.querySelector('#scheduleGrid'),
  notesArea: document.querySelector('#notesArea'),
  lessonDetails: document.querySelector('#lessonDetails'),
  statusMessage: document.querySelector('#statusMessage'),
};

let dataset = null;
let selectedCourseId = null;
let selectedClassId = null;
let selectedLessonId = null;
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
  dataset.courses.forEach((course) => {
    const option = new Option(course.name, course.id);
    els.courseSelect.add(option);
  });

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
  render();
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

function showLessonDetails(entry) {
  if (!entry) {
    els.lessonDetails.className = 'details-empty';
    els.lessonDetails.textContent = 'Clique em uma aula para ver os detalhes.';
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
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createLessonCard(entry, dayIndex) {
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
    selectedLessonId = entry.id;
    renderSchedule();
    showLessonDetails(entry);
  });

  card.addEventListener('dragstart', (event) => {
    dragLessonId = entry.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
    requestAnimationFrame(() => card.classList.add('is-dragging'));
  });

  card.addEventListener('dragend', () => {
    dragLessonId = null;
    card.classList.remove('is-dragging');
    document.querySelectorAll('.drop-cell.is-over').forEach((cell) => cell.classList.remove('is-over'));
  });

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
  els.scheduleMeta.textContent = `${slots.length} horários · ${classItem.entries.length} blocos de aula · arraste um card para outro horário`;

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

      cell.addEventListener('dragover', (event) => {
        const entry = getEntry(dragLessonId);
        if (!entry || slotIndex + entry.span > slots.length) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        cell.classList.add('is-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('is-over'));
      cell.addEventListener('drop', (event) => {
        event.preventDefault();
        cell.classList.remove('is-over');
        const entryId = event.dataTransfer.getData('text/plain') || dragLessonId;
        moveEntry(entryId, day, slotIndex);
      });

      els.scheduleGrid.append(cell);
    });
  });

  classItem.entries.forEach((entry) => {
    const dayIndex = days.indexOf(entry.day);
    if (dayIndex >= 0) els.scheduleGrid.append(createLessonCard(entry, dayIndex));
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

function moveEntry(entryId, newDay, newStartSlot) {
  const entry = getEntry(entryId);
  const classItem = getClassById(entry?.classId);
  if (!entry || !classItem) return;
  if (newStartSlot + entry.span > classItem.slots.length) {
    setStatus('Esse bloco não cabe no final da grade.', 'error');
    return;
  }
  if (entry.day === newDay && entry.startSlot === newStartSlot) return;

  const occupied = entryAt(classItem, newDay, newStartSlot, entry.span, entry.id);
  let swapEntry = null;

  if (occupied.length) {
    if (occupied.length === 1 && occupied[0].startSlot === newStartSlot && occupied[0].span === entry.span) {
      swapEntry = occupied[0];
    } else {
      setStatus('Destino ocupado por um bloco com duração diferente. Nesta versão, a troca só ocorre entre blocos equivalentes.', 'error');
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
    const swapConflicts = findProfessorConflicts(swapEntry, previous.day, previous.startSlot, [entry.id]);
    if (swapConflicts.length) {
      const conflict = swapConflicts[0];
      const interval = getEntryInterval(conflict);
      setStatus(`Troca bloqueada: ${swapEntry.professor} teria conflito com ${conflict.className} (${conflict.subject}) — ${conflict.day}, ${interval?.label ?? 'horário sobreposto'}.`, 'error');
      return;
    }
    swapPrevious = { day: swapEntry.day, startSlot: swapEntry.startSlot };
  }

  undoStack.push({
    entryId: entry.id,
    previous,
    swapEntryId: swapEntry?.id ?? null,
    swapPrevious,
  });

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

function render() {
  renderSchedule();
  updateStats();
}

async function loadDefaultWorkbook() {
  try {
    setStatus('Lendo o Excel original…', 'info');
    const response = await fetch(DEFAULT_FILE);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    dataset = parseScheduleWorkbook(buffer, 'Horario Azul - Faculdade - 2026.2.xls');
    setStatus('Excel carregado. As alterações ficam apenas nesta sessão.', 'success');
  } catch (error) {
    console.error('Falha ao ler XLS, usando fallback JSON:', error);
    const response = await fetch(FALLBACK_FILE);
    dataset = await response.json();
    setStatus('A planilha não pôde ser lida pelo navegador; dados normalizados de contingência foram carregados.', 'warning');
  }
  undoStack = [];
  populateSelectors();
  updateStats();
}

async function loadUserFile(file) {
  try {
    setStatus(`Lendo ${file.name}…`, 'info');
    const buffer = await file.arrayBuffer();
    dataset = parseScheduleWorkbook(buffer, file.name);
    undoStack = [];
    selectedLessonId = null;
    populateSelectors();
    setStatus(`${file.name} carregado com sucesso.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Não foi possível ler o arquivo.', 'error');
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

els.fileInput.addEventListener('change', () => {
  const [file] = els.fileInput.files;
  if (file) loadUserFile(file);
  els.fileInput.value = '';
});

els.undoButton.addEventListener('click', undo);
els.resetButton.addEventListener('click', resetCurrentClass);

loadDefaultWorkbook();
