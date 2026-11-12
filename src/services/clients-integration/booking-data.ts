import { eligibleBonos, normalizeBookings, readAllPages, type AttendanceRow, type BookingRow, type BonoRow, type ClientBookings } from '@/domain/rules/booking-assignment';
import { shiftMonth } from '@/domain/rules/training-plan';
import { supabase } from '@/services/supabase/client';

// Lectura completa antes de escribir en entrenamientos; cualquier error detiene la publicación.
export async function getBookingSnapshot(month: string, clientId?: string) {
  const observed_at = new Date().toISOString();
  const bonos = await readAllPages<BonoRow>(async (from, to) => {
    let query = supabase.from('client_bonos').select('id,user_id,sessions_total').eq('status', 'active')
      .eq('service_month', month.slice(0, 7)).not('payment_validated_at', 'is', null).order('id').range(from, to);
    if (clientId) query = query.eq('user_id', clientId);
    const { data, error } = await query;
    if (error) throw new Error('No se pudieron consultar todos los bonos de Lovable. No se ha publicado.');
    return (data ?? []) as BonoRow[];
  });
  const { eligible, excluded } = eligibleBonos(bonos);
  const clients: ClientBookings[] = [];
  const start = new Date(Date.parse(`${month}T00:00:00Z`) - 86_400_000).toISOString();
  const end = new Date(Date.parse(`${shiftMonth(month, 1)}T00:00:00Z`) + 86_400_000).toISOString();
  for (const bono of eligible) {
    const bookings = await readAllPages<BookingRow>(async (from, to) => {
      const { data, error } = await supabase.from('bookings').select('id,status,sessions!inner(starts_at,status)')
        .eq('user_id', bono.user_id).eq('bono_id', bono.id).gte('sessions.starts_at', start).lt('sessions.starts_at', end)
        .order('id').range(from, to);
      if (error) throw new Error('No se pudieron consultar todas las reservas de Lovable. Vuelve a intentarlo.');
      return (data ?? []) as unknown as BookingRow[];
    });
    const attendance: AttendanceRow[] = [];
    for (let offset = 0; offset < bookings.length; offset += 100) {
      attendance.push(...await readAllPages<AttendanceRow>(async (from, to) => {
        const { data, error } = await supabase.from('attendance').select('booking_id,status,recorded_at')
          .in('booking_id', bookings.slice(offset, offset + 100).map((item) => item.id))
          .order('booking_id').order('recorded_at').range(from, to);
        if (error) throw new Error('No se pudieron comprobar las asistencias. Vuelve a intentarlo.');
        return (data ?? []) as AttendanceRow[];
      }));
    }
    clients.push({ client_id: bono.user_id, bono_id: bono.id, session_count: bono.sessions_total, bookings: normalizeBookings(month, bookings, attendance) });
  }
  return { clients, excluded, observed_at };
}
