import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getClientOverview, type ClientOverview } from '@/services/clients-integration/client-data';

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid',
  }).format(date);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.heading}>{title}</Text>{children}</View>;
}

export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    getClientOverview(id).then((data) => { if (mounted) setOverview(data); })
      .catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la ficha.'); });
    return () => { mounted = false; };
  }, [id]);

  async function loadMore(kind: 'notes' | 'journal') {
    if (!overview || !id || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getClientOverview(id, { [kind]: overview[kind].length });
      setOverview((current) => current ? { ...current, [kind]: [...current[kind], ...page[kind]] } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar más datos.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (error && !overview) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!overview) return <View style={styles.center}><ActivityIndicator color="#436b63" /></View>;

  const { client, active_bonos: bonos, this_week: week, latest_form: form, notes, journal, totals } = overview;
  return (
    <SafeAreaView style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
        style={styles.back}
      >
        <Text style={styles.link}>‹ Volver al listado</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{client.nombre}</Text>
        <Text style={styles.muted}>{client.active ? 'Perfil activo' : 'Perfil inactivo'} · {client.age === null ? 'Edad desconocida' : `${client.age} años`}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title="Formulario inicial">
          {form ? (
            <>
              {([
                ['Lesiones', form.lesiones], ['Operaciones', form.operaciones], ['Dolores', form.dolores],
                ['Enfermedades', form.enfermedades], ['Diagnóstico', form.diagnostico],
                ['Historial deportivo', form.historialDeportivo], ['Relación con el ejercicio', form.relacionEjercicio],
                ['Actividad diaria', form.actividadDiaria], ['Incomodidades', form.incomodo],
              ] as const).map(([label, value]) => value ? <Text key={label} style={styles.line}>{label}: {value}</Text> : null)}
            </>
          ) : <Text style={styles.muted}>{overview.form_match === 'ambiguous_email' ? 'El correo coincide con varios perfiles.' : 'Sin formulario asociado.'}</Text>}
        </Section>

        <Section title={`Esta semana · ${week.count} sesiones`}>
          {week.sessions.length ? week.sessions.map((session, index) => (
            <Text key={`${session.starts_at}-${index}`} style={styles.line}>{formatDate(session.starts_at)} · {session.training_type}</Text>
          )) : <Text style={styles.muted}>Sin reservas esta semana.</Text>}
        </Section>

        <Section title="Bonos activos">
          {bonos.length ? bonos.map((bono) => (
            <Text key={bono.id} style={styles.line}>{bono.service_month} · {bono.training_type} · {bono.sessions_used}/{bono.sessions_total} sesiones</Text>
          )) : <Text style={styles.muted}>Sin bono activo validado este mes.</Text>}
        </Section>

        <Section title={`Notas · ${totals.notes}`}>
          {notes.length ? notes.map((note) => (
            <View key={note.id} style={styles.entry}>
              <Text style={styles.entryText}>{note.note.replace(/\\n/g, '\n')}</Text>
              <Text style={styles.muted}>{formatDate(note.created_at)}</Text>
            </View>
          )) : <Text style={styles.muted}>Sin notas.</Text>}
          {notes.length < totals.notes ? <Pressable disabled={loadingMore} onPress={() => void loadMore('notes')}><Text style={styles.link}>Cargar más notas ({notes.length}/{totals.notes})</Text></Pressable> : null}
        </Section>

        <Section title={`Diario · ${totals.journal}`}>
          {journal.length ? journal.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.entryText}>{entry.body.replace(/\\n/g, '\n')}</Text>
              <Text style={styles.muted}>{entry.entry_date} · {entry.kind}</Text>
            </View>
          )) : <Text style={styles.muted}>Sin entradas.</Text>}
          {journal.length < totals.journal ? <Pressable disabled={loadingMore} onPress={() => void loadMore('journal')}><Text style={styles.link}>Cargar más diario ({journal.length}/{totals.journal})</Text></Pressable> : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  content: { padding: 24, paddingBottom: 50, gap: 14 },
  back: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f8fa', padding: 24 },
  title: { color: '#182321', fontSize: 28, fontWeight: '700' },
  muted: { color: '#53615e', fontSize: 14 },
  section: { backgroundColor: '#fff', padding: 18, borderRadius: 10, gap: 10 },
  heading: { color: '#182321', fontSize: 18, fontWeight: '700' },
  line: { color: '#33423e', fontSize: 15, lineHeight: 23, borderTopColor: '#e4e9e6', borderTopWidth: 1, paddingTop: 10 },
  entry: { borderTopColor: '#e4e9e6', borderTopWidth: 1, paddingTop: 10, gap: 6 },
  entryText: { color: '#33423e', fontSize: 15, lineHeight: 23 },
  error: { color: '#a43d3d' },
  link: { color: '#436b63', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
});
