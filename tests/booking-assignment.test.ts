import { test } from 'node:test';
import { deepStrictEqual, strictEqual, rejects } from 'node:assert';
import { normalizeBookings, eligibleBonos, readAllPages } from '../src/domain/rules/booking-assignment.ts';

test('fecha Madrid, reservas canceladas y asistencia más reciente', () => {
 const bookings = [
  {id:'one',status:'booked',sessions:{starts_at:'2026-10-31T23:30:00Z',status:'scheduled'}},
  {id:'two',status:'cancelled',sessions:{starts_at:'2026-11-02T10:00:00Z',status:'scheduled'}},
  {id:'three',status:'booked',sessions:{starts_at:'2026-11-30T23:30:00Z',status:'scheduled'}},
 ];
 deepStrictEqual(normalizeBookings('2026-11-01', bookings,[
  {booking_id:'one',status:'attended',recorded_at:'2026-11-01T12:00:00Z'},
  {booking_id:'one',status:'absent',recorded_at:'2026-11-01T13:00:00Z'},
 ]),[
  {id:'one',date:'2026-11-01',active:true,attended:false},
  {id:'two',date:'2026-11-02',active:false,attended:false},
 ]);
});
test('no elige arbitrariamente entre bonos activos ni tamaños no soportados', () => {
 const result=eligibleBonos([
  {id:'a',user_id:'one',sessions_total:8},{id:'b',user_id:'one',sessions_total:4},
  {id:'c',user_id:'two',sessions_total:12},{id:'d',user_id:'three',sessions_total:6},
 ]);
 deepStrictEqual(result.eligible,[{id:'c',user_id:'two',sessions_total:12}]);
 strictEqual(result.excluded.length,2);
});
test('lee todas las páginas y propaga errores en vez de devolver datos incompletos', async () => {
 deepStrictEqual(await readAllPages(async (from)=>from===0?[1,2]:from===2?[3]:[],2),[1,2,3]);
 await rejects(readAllPages(async(from)=>{if(from)throw new Error('red');return [1,2];},2),/red/);
});
