import { test } from 'node:test';
import { deepStrictEqual, throws } from 'node:assert';
import { getMonthWeeks } from '../src/domain/rules/month-weeks.ts';
test('semanas de lunes a domingo recortadas al mes', () => {
 deepStrictEqual(getMonthWeeks('2026-11-01').map(w => [w.start,w.end]), [['2026-11-01','2026-11-01'],['2026-11-02','2026-11-08'],['2026-11-09','2026-11-15'],['2026-11-16','2026-11-22'],['2026-11-23','2026-11-29'],['2026-11-30','2026-11-30']]);
});
test('respeta febrero bisiesto y cambio de año', () => {
 deepStrictEqual(getMonthWeeks('2024-02-01').at(-1)?.end, '2024-02-29');
 deepStrictEqual(getMonthWeeks('2027-02-01').length, 4);
 deepStrictEqual(getMonthWeeks('2025-12-01').at(-1)?.end, '2025-12-31');
 throws(() => getMonthWeeks('2026-13-01'));
});

test('localiza la semana de hoy respetando los límites de lunes a domingo', async () => {
 const { getWeekForDate } = await import('../src/domain/rules/month-weeks.ts');
 deepStrictEqual(getWeekForDate('2026-11-01', '2026-11-12'), 3);
 deepStrictEqual(getWeekForDate('2026-11-01', '2026-11-01'), 1);
 deepStrictEqual(getWeekForDate('2026-11-01', '2026-11-08'), 2);
 deepStrictEqual(getWeekForDate('2026-11-01', '2026-11-09'), 3);
 deepStrictEqual(getWeekForDate('2026-11-01', '2026-11-30'), 6);
 deepStrictEqual(getWeekForDate('2026-12-01', '2026-11-12'), null);
});

test('la semana actual usa la fecha de Madrid cerca de medianoche', async () => {
 const { getWeekForDate } = await import('../src/domain/rules/month-weeks.ts');
 const { getMadridDate, getMadridMonth } = await import('../src/domain/rules/training-plan.ts');
 const now = new Date('2026-11-08T23:30:00Z');
 deepStrictEqual(getWeekForDate(getMadridMonth(now), getMadridDate(now)), 3);
});
