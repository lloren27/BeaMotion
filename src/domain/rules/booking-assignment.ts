export type BookingRow = { id: string; status: string; sessions: { starts_at: string; status: string } | Array<{ starts_at: string; status: string }> | null };
export type AttendanceRow = { booking_id: string; status: string; recorded_at: string | null };
export type BookingSnapshot = { id: string; date: string; active: boolean; attended: boolean };
export type BonoRow = { id: string; user_id: string; sessions_total: number };
export type BookingExclusion = { client_id: string; reason: string };
export type ClientBookings = { client_id: string; bono_id: string; session_count: number; bookings: BookingSnapshot[] };

export async function readAllPages<T>(read: (from: number, to: number) => Promise<T[]>, size = 500): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += size) {
    const page = await read(from, from + size - 1);
    result.push(...page);
    if (page.length < size) return result;
  }
}
export function eligibleBonos(bonos: BonoRow[]): { eligible: BonoRow[]; excluded: BookingExclusion[] } {
  const clients = new Map<string, BonoRow[]>();
  for (const bono of bonos) clients.set(bono.user_id, [...(clients.get(bono.user_id) ?? []), bono]);
  const eligible: BonoRow[] = []; const excluded: BookingExclusion[] = [];
  for (const [client_id, items] of clients) {
    if (items.length !== 1) excluded.push({ client_id, reason: 'Varios bonos activos para el mes' });
    else if (![4, 8, 12].includes(items[0].sessions_total)) excluded.push({ client_id, reason: 'Bono distinto de 4, 8 o 12 sesiones' });
    else eligible.push(items[0]);
  }
  return { eligible, excluded };
}
export function normalizeBookings(month: string, bookings: BookingRow[], attendance: AttendanceRow[]): BookingSnapshot[] {
  const latest = new Map<string, AttendanceRow>();
  for (const row of attendance) {
    const previous = latest.get(row.booking_id);
    if (!previous || (row.recorded_at ?? '') > (previous.recorded_at ?? '')) latest.set(row.booking_id, row);
    else if (row.recorded_at === previous.recorded_at && row.status !== previous.status) throw new Error('Asistencias contradictorias. Revisa Lovable.');
  }
  return bookings.map((booking) => {
    const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
    if (!session?.starts_at || !Number.isFinite(Date.parse(session.starts_at))) throw new Error('Reserva sin fecha válida. Revisa Lovable.');
    return { booking, session };
  }).sort((a, b) => Date.parse(a.session.starts_at) - Date.parse(b.session.starts_at) || a.booking.id.localeCompare(b.booking.id))
    .flatMap(({ booking, session }) => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(session.starts_at));
      const part = (type: string) => parts.find((item) => item.type === type)?.value;
      const date = `${part('year')}-${part('month')}-${part('day')}`;
      if (date.slice(0, 7) !== month.slice(0, 7)) return [];
      return [{ id: booking.id, date, active: booking.status === 'booked' && !['cancelled', 'canceled'].includes(session.status), attended: latest.get(booking.id)?.status === 'attended' }];
    });
}
