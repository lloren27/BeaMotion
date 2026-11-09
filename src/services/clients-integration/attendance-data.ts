import { getMadridMonth, shiftMonth } from '@/domain/rules/training-plan';

import { supabase } from '../supabase/client';

export type AttendedBooking = { bookingId: string; sessionDate: string };
type BookingRow = { id: string; sessions: { starts_at: string } | Array<{ starts_at: string }> | null };

function madridDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function getAttendedBookingsForMonth(
  clientId: string,
  bonoId: string,
  month: string,
): Promise<AttendedBooking[]> {
  const monthStart = new Date(`${month}T00:00:00Z`).getTime();
  const nextMonthStart = new Date(`${shiftMonth(month, 1)}T00:00:00Z`).getTime();
  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id, sessions!inner(starts_at)')
    .eq('user_id', clientId)
    .eq('bono_id', bonoId)
    .gte('sessions.starts_at', new Date(monthStart - 86_400_000).toISOString())
    .lt('sessions.starts_at', new Date(nextMonthStart + 86_400_000).toISOString());
  if (bookingError) throw new Error('No se pudieron consultar las reservas del bono.');

  const monthlyBookings = ((bookings ?? []) as BookingRow[]).flatMap((booking) => {
    const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
    const startsAt = session?.starts_at;
    return startsAt && getMadridMonth(new Date(startsAt)) === month
      ? [{ id: booking.id, startsAt }]
      : [];
  });
  if (!monthlyBookings.length) return [];

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('booking_id')
    .in('booking_id', monthlyBookings.map((booking) => booking.id))
    .eq('status', 'attended');
  if (attendanceError) throw new Error('No se pudo consultar la asistencia del bono.');

  const attendedIds = new Set((attendance ?? []).map((entry) => entry.booking_id));
  return monthlyBookings
    .filter((booking) => attendedIds.has(booking.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .map((booking) => ({ bookingId: booking.id, sessionDate: madridDate(booking.startsAt) }));
}
