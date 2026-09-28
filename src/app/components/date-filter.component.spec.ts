import { calculateCalendarPosition } from './date-filter.component';

describe('calculateCalendarPosition', () => {
  it('opens below when the viewport has enough space', () => {
    const position = calculateCalendarPosition({ top: 100, right: 500, bottom: 140 }, { width: 286, height: 320 }, 1000, 800);
    expect(position).toEqual({ top: 147, left: 214, placement: 'below' });
  });

  it('opens above when the lower edge would cover content outside the viewport', () => {
    const position = calculateCalendarPosition({ top: 600, right: 700, bottom: 640 }, { width: 286, height: 320 }, 1000, 700);
    expect(position).toEqual({ top: 273, left: 414, placement: 'above' });
  });

  it('keeps the calendar inside the horizontal viewport', () => {
    const position = calculateCalendarPosition({ top: 100, right: 190, bottom: 140 }, { width: 286, height: 320 }, 320, 700);
    expect(position.left).toBe(12);
  });
});
