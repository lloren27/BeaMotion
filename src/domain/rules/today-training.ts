import { getMadridDate } from './training-plan';

export type TodayBooking = {
  id: string;
  user_id: string;
  status: string;
  sessions: { starts_at: string; status: string } | Array<{ starts_at: string; status: string }> | null;
};
export type TodayClient = { clientId: string; startsAt: string[] };

export function parseTrainingDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : undefined;
}

export function groupTodayBookings(bookings: TodayBooking[], date: string): TodayClient[] {
  const clients = new Map<string, TodayClient>();
  for (const booking of bookings) {
    const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
    if (booking.status !== 'booked' || !session || ['cancelled', 'canceled'].includes(session.status)) continue;
    if (!Number.isFinite(Date.parse(session.starts_at))) throw new Error('Hay una reserva sin fecha válida.');
    if (getMadridDate(new Date(session.starts_at)) !== date) continue;
    const client = clients.get(booking.user_id) ?? { clientId: booking.user_id, startsAt: [] };
    client.startsAt.push(session.starts_at);
    clients.set(client.clientId, client);
  }
  const compare = (a: string, b: string) => Date.parse(a) - Date.parse(b);
  for (const client of clients.values()) client.startsAt.sort(compare);
  return [...clients.values()].sort((a, b) => compare(a.startsAt[0], b.startsAt[0]) || a.clientId.localeCompare(b.clientId));
}
