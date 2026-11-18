import { readAllPages } from '@/domain/rules/booking-assignment';
import { groupTodayBookings, parseTrainingDate, type TodayBooking, type TodayClient } from '@/domain/rules/today-training';
import { supabase } from '@/services/supabase/client';

export type TodayTrainingClient = TodayClient & { name: string };

export async function listTodayTrainingClients(date: string): Promise<TodayTrainingClient[]> {
  if (!parseTrainingDate(date)) throw new Error('Fecha no válida.');
  // Ventana amplia: el filtro Madrid posterior resuelve ambos offsets y los cambios de horario.
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const start = new Date(midnight - 86_400_000).toISOString();
  const end = new Date(midnight + 86_400_000).toISOString();
  const bookings = await readAllPages<TodayBooking>(async (from, to) => {
    const { data, error } = await supabase.from('bookings')
      .select('id,user_id,status,sessions!inner(starts_at,status)')
      .eq('status', 'booked').gte('sessions.starts_at', start).lt('sessions.starts_at', end)
      .order('id').range(from, to);
    if (error) throw new Error('No se pudieron cargar las reservas de hoy.');
    return (data ?? []) as unknown as TodayBooking[];
  });
  const clients = groupTodayBookings(bookings, date);
  const names = new Map<string, string>();
  for (let offset = 0; offset < clients.length; offset += 100) {
    const ids = clients.slice(offset, offset + 100).map((client) => client.clientId);
    const profiles = await readAllPages<{ id: string; nombre: string }>(async (from, to) => {
      const { data, error } = await supabase.from('profiles').select('id,nombre').in('id', ids).order('id').range(from, to);
      if (error) throw new Error('No se pudieron cargar los nombres de los clientes.');
      return data ?? [];
    });
    for (const profile of profiles) names.set(profile.id, profile.nombre);
  }
  return clients.map((client) => ({ ...client, name: names.get(client.clientId) || 'Cliente sin nombre disponible' }));
}
