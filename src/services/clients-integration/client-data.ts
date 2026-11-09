import { supabase } from '../supabase/client';

export type ClientSummary = {
  id: string;
  nombre: string;
  active: boolean;
  updated_at: string;
};

export type ClientListItem = ClientSummary & { has_active_bono: boolean };

export type ClientPage = {
  clients: ClientListItem[];
  next_offset: number | null;
};

export type ClientBono = {
  id: string;
  status: string;
  service_month: string;
  sessions_total: number;
  sessions_used: number;
  training_type: string;
  payment_validated_at: string | null;
};

export type ClientOverview = {
  client: ClientSummary & { birth_date: string | null; age: number | null; sex: string | null };
  active_bonos: ClientBono[];
  bonos: ClientBono[];
  this_week: { starts_on: string; count: number; sessions: Array<{ starts_at: string; training_type: string }> };
  latest_form: {
    lesiones: string | null;
    operaciones: string | null;
    dolores: string | null;
    enfermedades: string | null;
    diagnostico: string | null;
    historialDeportivo: string | null;
    relacionEjercicio: string | null;
    actividadDiaria: string | null;
    incomodo: string | null;
  } | null;
  form_match: string;
  notes: Array<{ id: string; note: string; created_at: string }>;
  journal: Array<{ id: string; body: string; entry_date: string; kind: string }>;
  totals: { notes: number; journal: number };
};

function rpcError(code?: string) {
  return new Error(
    code === '42501'
      ? 'Tu cuenta no tiene permiso para consultar estos datos.'
      : 'No se pudieron cargar los datos de Lovable.',
  );
}

export async function listClients(limit = 50, offset = 0): Promise<ClientPage> {
  const { data, error } = await supabase.rpc('list_clients', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw rpcError(error.code);
  if (!data || !Array.isArray(data.clients)) throw new Error('Respuesta de clientes no válida.');

  const clients = data.clients as ClientSummary[];
  if (!clients.length) return { clients: [], next_offset: data.next_offset };

  const monthParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const year = monthParts.find((part) => part.type === 'year')?.value;
  const month = monthParts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('No se pudo determinar el mes actual.');

  const { data: bonos, error: bonosError } = await supabase
    .from('client_bonos')
    .select('user_id')
    .in('user_id', clients.map((client) => client.id))
    .eq('status', 'active')
    .eq('service_month', `${year}-${month}`)
    .not('payment_validated_at', 'is', null);
  if (bonosError) throw rpcError(bonosError.code);

  const withBono = new Set(bonos?.map((bono) => bono.user_id));
  return {
    clients: clients.map((client) => ({ ...client, has_active_bono: withBono.has(client.id) })),
    next_offset: data.next_offset,
  };
}

export async function getClientOverview(
  clientId: string,
  page?: { notes?: number; journal?: number },
): Promise<ClientOverview> {
  const { data, error } = await supabase.rpc('client_overview', {
    p_client_id: clientId,
    p_history_limit: 1,
    ...(page?.notes !== undefined ? { p_notes_offset: page.notes } : {}),
    ...(page?.journal !== undefined ? { p_journal_offset: page.journal } : {}),
  });
  if (error) throw rpcError(error.code);
  if (!data || typeof data !== 'object' || !data.client) {
    throw new Error('No se encontró la ficha de esta clienta.');
  }
  return data as ClientOverview;
}
