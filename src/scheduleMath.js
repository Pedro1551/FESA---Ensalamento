export function toMinutes(hhmm) {
  const [hour, minute] = String(hhmm ?? '').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return (hour * 60) + minute;
}

export function spanFits(slots, startSlot, span) {
  const start = Number(startSlot);
  const length = Number(span);
  return Number.isInteger(start)
    && Number.isInteger(length)
    && start >= 0
    && length >= 1
    && start + length <= (slots?.length ?? 0);
}

export function occupiedSegments(slots, startSlot, span) {
  if (!spanFits(slots, startSlot, span)) return [];
  return slots.slice(startSlot, startSlot + span).map((slot) => ({
    start: toMinutes(slot.start),
    end: toMinutes(slot.end),
    startLabel: slot.start,
    endLabel: slot.end,
  })).filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end));
}

export function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

export function segmentsOverlap(first, second) {
  return first.some((a) => second.some((b) => rangesOverlap(a, b)));
}

export function placementLabel(slots, startSlot, span) {
  if (!spanFits(slots, startSlot, span)) return '';
  const first = slots[startSlot];
  const last = slots[startSlot + span - 1];
  return `${first.start}–${last.end}`;
}

export function harmonizeCourseSlots(course) {
  const slotMap = new Map();
  (course?.classes ?? []).forEach((classItem) => {
    (classItem.slots ?? []).forEach((slot) => {
      const key = `${slot.start}|${slot.end}`;
      if (!slotMap.has(key)) slotMap.set(key, {
        start: slot.start,
        end: slot.end,
        label: slot.label ?? `${slot.start}–${slot.end}`,
      });
    });
  });

  const canonicalSlots = [...slotMap.values()]
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end))
    .map((slot, index) => ({ ...slot, index }));

  if (!canonicalSlots.length) return course;

  const findRange = (oldSlots, startSlot, span) => {
    const first = oldSlots?.[startSlot];
    const last = oldSlots?.[startSlot + span - 1];
    if (!first || !last) return null;
    const newStart = canonicalSlots.findIndex((slot) => slot.start === first.start);
    if (newStart < 0) return null;
    let newEnd = -1;
    for (let index = newStart; index < canonicalSlots.length; index += 1) {
      if (canonicalSlots[index].end === last.end) newEnd = index;
    }
    if (newEnd < newStart) return null;
    return { startSlot: newStart, span: newEnd - newStart + 1 };
  };

  (course.classes ?? []).forEach((classItem) => {
    const oldSlots = classItem.slots ?? [];
    (classItem.entries ?? []).forEach((entry) => {
      const originalStartBefore = Number(entry.originalStartSlot ?? entry.startSlot);
      const originalSpanBefore = Number(entry.originalSpan ?? entry.span);
      const currentRange = findRange(oldSlots, Number(entry.startSlot), Number(entry.span));
      const originalRange = findRange(oldSlots, originalStartBefore, originalSpanBefore);

      if (currentRange) {
        entry.startSlot = currentRange.startSlot;
        entry.span = currentRange.span;
      }
      if (originalRange) {
        entry.originalStartSlot = originalRange.startSlot;
        entry.originalSpan = originalRange.span;
      }
    });
    classItem.slots = canonicalSlots.map((slot) => ({ ...slot }));
  });

  return course;
}
