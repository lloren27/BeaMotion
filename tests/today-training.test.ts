import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { groupTodayBookings, parseTrainingDate } from '../src/domain/rules/today-training.ts';

const booking = (id: string, user_id: string, starts_at: string, status = 'booked', sessionStatus = 'scheduled') => ({
  id, user_id, status, sessions: { starts_at, status: sessionStatus },
});

test('agrupa clientes sin requerir planes o bonos y ordena reservas y clientes por hora', () => {
  deepStrictEqual(groupTodayBookings([
    booking('b', 'ana', '2026-11-18T15:00:00Z'),
    booking('c', 'bea', '2026-11-18T10:00:00Z'),
    booking('a', 'ana', '2026-11-18T09:00:00Z'),
  ], '2026-11-18'), [
    { clientId: 'ana', startsAt: ['2026-11-18T09:00:00Z', '2026-11-18T15:00:00Z'] },
    { clientId: 'bea', startsAt: ['2026-11-18T10:00:00Z'] },
  ]);
});

test('excluye otras fechas, reservas canceladas y sesiones canceladas', () => {
  deepStrictEqual(groupTodayBookings([
    booking('a', 'ana', '2026-11-18T09:00:00Z', 'cancelled'),
    booking('b', 'bea', '2026-11-18T09:00:00Z', 'booked', 'cancelled'),
    booking('c', 'bea', '2026-11-18T09:00:00Z', 'booked', 'canceled'),
    booking('d', 'ana', '2026-11-17T09:00:00Z'),
    booking('e', 'ana', '2026-11-18T23:00:00Z'),
  ], '2026-11-18'), []);
});

test('usa medianoche Madrid en invierno y verano y admite relaciones en array', () => {
  deepStrictEqual(groupTodayBookings([
    booking('a', 'ana', '2026-11-17T23:00:00Z'),
  ], '2026-11-18'), [{ clientId: 'ana', startsAt: ['2026-11-17T23:00:00Z'] }]);
  deepStrictEqual(groupTodayBookings([
    { id: 'b', user_id: 'bea', status: 'booked', sessions: [{ starts_at: '2026-06-17T22:00:00Z', status: 'scheduled' }] },
  ], '2026-06-18'), [{ clientId: 'bea', startsAt: ['2026-06-17T22:00:00Z'] }]);
});

test('valida fechas de navegación antes de seleccionar mes y día', () => {
  strictEqual(parseTrainingDate('2026-11-18'), '2026-11-18');
  strictEqual(parseTrainingDate('2028-02-29'), '2028-02-29');
  for (const date of ['2026-02-29', '2026-13-01', 'bad', '', undefined, ['2026-11-18']]) {
    strictEqual(parseTrainingDate(date), undefined);
  }
});
