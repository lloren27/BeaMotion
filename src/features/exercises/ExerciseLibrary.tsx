import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SectionMenu } from '@/features/navigation/SectionMenu';
import { CATEGORIES, emptyExercise, filterExercises, prepareExercise, type CatalogExercise, type ExerciseDraft } from '@/domain/exercises/catalog';
import { archiveCatalogExercise, listExercises, saveCatalogExercise } from '@/services/exercises/exercise-data';
import { useSession } from '@/services/supabase/session';

type Category = keyof typeof CATEGORIES;
const labels: Record<Category, string> = { patterns: 'Familia o patrón', laterality: 'Lateralidad', positions: 'Posición', actions: 'Tipo de acción' };
const inputFields: { key: 'name' | 'description' | 'band_color' | 'weight_kg' | 'action_time' | 'notes'; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Nombre' }, { key: 'description', label: 'Descripción e instrucciones', multiline: true },
  { key: 'band_color', label: 'Color de goma' }, { key: 'weight_kg', label: 'Peso en kg' },
  { key: 'action_time', label: 'Tiempo de acción' }, { key: 'notes', label: 'Notas', multiline: true },
];
function toDraft(item: CatalogExercise): ExerciseDraft {
  return { name: item.name, description: item.description, patterns: [...item.patterns], laterality: [...item.laterality], positions: [...item.positions], actions: [...item.actions], band_color: item.band_color, weight_kg: item.weight_kg === null ? '' : String(item.weight_kg), action_time: item.action_time, notes: item.notes };
}
export function ExerciseLibrary() {
  const { trainingStatus } = useSession();
  const [items, setItems] = useState<CatalogExercise[]>([]);
  const [query, setQuery] = useState(''); const [tag, setTag] = useState('');
  const [draft, setDraft] = useState<ExerciseDraft | null>(null); const [editingId, setEditingId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listExercises()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { if (trainingStatus === 'ready') void load(); }, [trainingStatus, load]));
  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError(null);
    try { await saveCatalogExercise(prepareExercise(draft), editingId); setDraft(null); setEditingId(undefined); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  async function archive(item: CatalogExercise) {
    setBusy(true); setError(null);
    try { await archiveCatalogExercise(item.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo archivar.'); }
    finally { setBusy(false); }
  }
  if (trainingStatus !== 'ready') return <SafeAreaView style={styles.page}><View style={styles.content}><View style={styles.header}><Text style={styles.title}>Ejercicios</Text><SectionMenu current="Ejercicios" /></View><Text>Conecta la cuenta de entrenamientos para abrir la biblioteca.</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>Biblioteca de ejercicios</Text>{!draft ? <SectionMenu current="Ejercicios" /> : null}</View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {draft ? <View style={styles.card}>
      <Text style={styles.heading}>{editingId ? 'Editar ejercicio' : 'Nuevo ejercicio'}</Text>
      {inputFields.map(({ key, label, multiline }) => <View key={key}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={draft[key]} onChangeText={(value) => setDraft({ ...draft, [key]: value })} multiline={multiline} keyboardType={key === 'weight_kg' ? 'decimal-pad' : 'default'} style={styles.input} /></View>)}
      {(Object.keys(CATEGORIES) as Category[]).map((key) => <View key={key}><Text style={styles.label}>{labels[key]} · selección múltiple</Text><View style={styles.chips}>{CATEGORIES[key].map((value) => {
        const selected = draft[key].includes(value);
        return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={value} onPress={() => setDraft({ ...draft, [key]: selected ? draft[key].filter((x) => x !== value) : [...draft[key], value] })} style={[styles.chip, selected && styles.selected]}><Text>{value}</Text></Pressable>;
      })}</View></View>)}
      <View style={styles.actions}><Pressable disabled={busy} onPress={() => void save()}><Text style={styles.link}>Guardar ejercicio</Text></Pressable><Pressable disabled={busy} onPress={() => { setDraft(null); setError(null); }}><Text style={styles.link}>Cancelar</Text></Pressable></View>
    </View> : <>
      <Pressable disabled={busy} onPress={() => { setEditingId(undefined); setDraft(emptyExercise()); }} style={styles.button}><Text style={styles.buttonText}>+ Crear ejercicio</Text></Pressable>
      <TextInput accessibilityLabel="Buscar por nombre" placeholder="Buscar por nombre" value={query} onChangeText={setQuery} style={styles.input} />
      <TextInput accessibilityLabel="Filtrar por etiqueta" placeholder="Filtrar por etiqueta" value={tag} onChangeText={setTag} style={styles.input} />
      {loading ? <ActivityIndicator /> : null}
      {error ? <Pressable onPress={() => void load()}><Text style={styles.link}>Reintentar</Text></Pressable> : null}
      {!loading && !filterExercises(items, query, tag).length ? <Text>No hay ejercicios para esta búsqueda.</Text> : null}
      {filterExercises(items, query, tag).map((item) => <View key={item.id} style={styles.card}>
        <Text style={styles.heading}>{item.name}</Text><Text>{item.description}</Text>
        <Text>{[...item.patterns, ...item.laterality, ...item.positions, ...item.actions].join(' · ')}</Text>
        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => { setEditingId(item.id); setDraft(toDraft(item)); }}><Text style={styles.link}>Editar</Text></Pressable>
          <Pressable disabled={busy} onPress={() => { setEditingId(undefined); setDraft({ ...toDraft(item), name: `${item.name} (copia)` }); }}><Text style={styles.link}>Duplicar</Text></Pressable>
          <Pressable disabled={busy} onPress={() => Alert.alert('Archivar ejercicio', 'Dejará de aparecer en el selector. Las sesiones existentes se conservarán.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Archivar', onPress: () => void archive(item) }])}><Text style={styles.link}>Archivar</Text></Pressable>
        </View>
      </View>)}
    </>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f8fa' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 10 }, content: { padding: 20, gap: 14 }, title: { fontSize: 26, fontWeight: '700', color: '#182321', flexShrink: 1 }, heading: { fontSize: 18, fontWeight: '700' }, label: { fontWeight: '600', marginBottom: 5 }, link: { color: '#436b63', fontSize: 16, fontWeight: '700' }, error: { color: '#a43d3d' }, input: { borderWidth: 1, borderColor: '#ccd6d1', backgroundColor: '#fff', borderRadius: 8, padding: 10 }, card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: '#ccd6d1', borderRadius: 16, padding: 7 }, selected: { backgroundColor: '#cde5d8', borderColor: '#436b63' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, button: { backgroundColor: '#436b63', borderRadius: 8, padding: 12, alignSelf: 'flex-start' }, buttonText: { color: '#fff', fontWeight: '700' },
});
