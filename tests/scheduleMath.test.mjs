import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { harmonizeCourseSlots, occupiedSegments, placementLabel, segmentsOverlap, spanFits } from '../src/scheduleMath.js';

const fallback = JSON.parse(fs.readFileSync(new URL('../public/data/horario-fallback.json', import.meta.url), 'utf8'));
const alimentos = structuredClone(fallback.courses.find((course) => course.name === 'ENG. ALIMENTOS'));
harmonizeCourseSlots(alimentos);

const ea7 = alimentos.classes.find((classItem) => /EA\s*7/i.test(classItem.name));
const middle = ea7.entries.find((entry) => entry.subject.startsWith('Tecnologia de Frutas') && entry.day === 'Quarta-feira');

test('normaliza todas as turmas do curso para a mesma malha de horários', () => {
  const counts = new Set(alimentos.classes.map((classItem) => classItem.slots.length));
  assert.deepEqual([...counts], [6]);
});

test('aula de três períodos da EA7 continua válida mesmo atravessando o intervalo', () => {
  assert.equal(middle.startSlot, 1);
  assert.equal(middle.span, 3);
  assert.equal(spanFits(ea7.slots, middle.startSlot, middle.span), true);
  assert.equal(placementLabel(ea7.slots, middle.startSlot, middle.span), '07:50–10:35');
});

test('conflitos usam períodos ocupados e não consideram o intervalo como aula', () => {
  const segments = occupiedSegments(ea7.slots, 1, 3);
  assert.deepEqual(segments.map(({ startLabel, endLabel }) => [startLabel, endLabel]), [
    ['07:50', '08:40'],
    ['08:40', '09:30'],
    ['09:45', '10:35'],
  ]);
  assert.equal(segmentsOverlap(segments, [{ start: 570, end: 585 }]), false); // 09:30–09:45
  assert.equal(segmentsOverlap(segments, [{ start: 585, end: 635 }]), true);  // 09:45–10:35
});

test('bloco só é rejeitado quando realmente ultrapassa a malha', () => {
  assert.equal(spanFits(ea7.slots, 3, 3), true);
  assert.equal(spanFits(ea7.slots, 4, 3), false);
});
