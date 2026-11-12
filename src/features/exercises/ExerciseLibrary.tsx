import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SectionMenu } from '@/features/navigation/SectionMenu';
import { CATEGORIES, emptyExercise, filterArchivedExercises, filterExercises, prepareExercise, type CatalogExercise, type ExerciseDraft } from '@/domain/exercises/catalog';
import { archiveCatalogExercise, listExercises, saveCatalogExercise, unarchiveCatalogExercise } from '@/services/exercises/exercise-data';
import { useSession } from '@/services/supabase/session';
import { colors, borderRadius, spacing } from '@/theme/colors';

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
  const [showArchived, setShowArchived] = useState(false);
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
  async function unarchive(item: CatalogExercise) {
    setBusy(true); setError(null);
    try { await unarchiveCatalogExercise(item.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo restaurar.'); }
    finally { setBusy(false); }
  }
  if (trainingStatus !== 'ready') return <SafeAreaView style={styles.page}><View style={styles.content}><View style={styles.header}><Text style={styles.title}>Ejercicios</Text><SectionMenu current="Ejercicios" /></View><Text style={{color: colors.textSecondary}}>Conecta la cuenta de entrenamientos para abrir la biblioteca.</Text></View></SafeAreaView>;
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
        <View style={styles.iconActions}>
          <Pressable disabled={busy} accessibilityLabel="Editar ejercicio" onPress={() => { setEditingId(item.id); setDraft(toDraft(item)); }} style={styles.iconBtn}><MaterialCommunityIcons name="pencil" size={22} color={colors.brand} /></Pressable>
          <Pressable disabled={busy} accessibilityLabel="Duplicar ejercicio" onPress={() => { setEditingId(undefined); setDraft({ ...toDraft(item), name: `${item.name} (copia)` }); }} style={styles.iconBtn}><MaterialCommunityIcons name="content-copy" size={22} color={colors.brand} /></Pressable>
          <Pressable disabled={busy} accessibilityLabel="Archivar ejercicio" onPress={() => Alert.alert('Archivar ejercicio', 'Dejará de aparecer en el selector. Las sesiones existentes se conservarán.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Archivar', onPress: () => void archive(item) }])} style={styles.iconBtn}><MaterialCommunityIcons name="archive" size={22} color={colors.brand} /></Pressable>
        </View>
      </View>)}
      {items.some((e) => e.archived) ? <Pressable onPress={() => setShowArchived(!showArchived)} style={styles.archivedToggle}><MaterialCommunityIcons name={showArchived ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} /><Text style={styles.archivedToggleText}>Archivados ({filterArchivedExercises(items, '', '').length})</Text></Pressable> : null}
      {showArchived ? <View style={styles.archivedSection}>
        {filterArchivedExercises(items, query, tag).map((item) => <View key={item.id} style={styles.card}>
          <Text style={styles.heading}>{item.name}</Text><Text>{item.description}</Text>
          <Text>{[...item.patterns, ...item.laterality, ...item.positions, ...item.actions].join(' · ')}</Text>
          <View style={styles.iconActions}>
            <Pressable disabled={busy} accessibilityLabel="Restaurar ejercicio" onPress={() => Alert.alert('Restaurar ejercicio', `${item.name} volverá a aparecer en la biblioteca.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Restaurar', onPress: () => void unarchive(item) }])} style={styles.iconBtn}><MaterialCommunityIcons name="archive-outline" size={22} color={colors.success} /></Pressable>
          </View>
        </View>)}
      </View> : null}
    </>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, zIndex: 10 }, content: { padding: spacing.xl, gap: spacing.md }, title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 }, heading: { fontSize: 18, fontWeight: '700', color: colors.textPrimary }, label: { fontWeight: '600', marginBottom: spacing.xs, color: colors.textSecondary }, link: { color: colors.brand, fontSize: 16, fontWeight: '700' }, error: { color: colors.error }, input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: borderRadius.sm, padding: spacing.sm }, card: { backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.md }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.xl, padding: spacing.sm }, selected: { backgroundColor: colors.accentLight, borderColor: colors.brand }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }, button: { backgroundColor: colors.brand, borderRadius: borderRadius.sm, padding: spacing.md, alignSelf: 'flex-start' }, buttonText: { color: colors.white, fontWeight: '700' },
  iconActions: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.xs },
  iconBtn: { padding: spacing.sm },
  archivedToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  archivedToggleText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  archivedSection: { gap: spacing.md },
});
