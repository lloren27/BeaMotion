import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORIES, type CatalogExercise } from '@/domain/exercises/catalog';
import { duplicateModelExercises, emptyModelExercise, missingPatterns, MODEL_PATTERNS, type ModelExercise } from '@/domain/rules/training-model';
import { getMonthWeeks } from '@/domain/rules/month-weeks';
import { getMadridMonth, shiftMonth, type ModelCode } from '@/domain/rules/training-plan';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { SectionMenu } from '@/features/navigation/SectionMenu';
import { createMonthlyModels, getModelVersions, getMonthlyModels, publishModel, restoreWeekFromBase, saveModelDraft, type ModelVersion, type MonthlyModel } from '@/services/training-models/model-data';
import { useSession } from '@/services/supabase/session';

const fields: { key: keyof Omit<ModelExercise, 'patterns'>; label: string }[] = [
  { key: 'name', label: 'Nombre' }, { key: 'description', label: 'Instrucciones' }, { key: 'series', label: 'Series' },
  { key: 'repetitions', label: 'Repeticiones' }, { key: 'duration', label: 'Duración' }, { key: 'rest', label: 'Descanso' },
  { key: 'load', label: 'Peso / carga' }, { key: 'material', label: 'Material' }, { key: 'adaptation', label: 'Progresión / regresión' },
];
function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}
export function MonthlyModelsScreen() {
  const { trainingStatus } = useSession();
  const [month, setMonth] = useState(getMadridMonth());
  const [week, setWeek] = useState(1);
  const [models, setModels] = useState<MonthlyModel[]>([]);
  const [model, setModel] = useState<MonthlyModel | null>(null);
  const [draft, setDraft] = useState<ModelExercise[]>([]);
  const [expandedDraft, setExpandedDraft] = useState<number | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    if (trainingStatus !== 'ready') { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError(null); setModels([]);
    void getMonthlyModels(month).then((data) => { if (active) setModels(data); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'No se pudo cargar el mes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, trainingStatus, reloadKey]);
  async function create(copy: boolean) {
    setBusy(true); setError(null);
    try { await createMonthlyModels(month, copy); setReloadKey((n) => n + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el mes.'); }
    finally { setBusy(false); }
  }
  async function edit(item: MonthlyModel) {
    setExpandedDraft(null); setModel(item); setDraft(duplicateModelExercises(item.draft)); setVersions([]); setError(null); setNotice(null);
    try { setVersions(await getModelVersions(item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); }
  }
  function update(index: number, changes: Partial<ModelExercise>) {
    setDraft((current) => current.map((item, i) => i === index ? { ...item, ...changes } : item));
  }
  function move(index: number, change: number) {
    const target = index + change;
    if (target < 0 || target >= draft.length) return;
    setExpandedDraft((current) => current === index ? target : current === target ? index : current);
    setDraft((current) => { const target = index + change; if (target < 0 || target >= current.length) return current;
      const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  function addCatalog(item: CatalogExercise) {
    setExpandedDraft(draft.length);
    setDraft((current) => [...current, { ...emptyModelExercise(), name: item.name, description: [item.description, item.notes].filter(Boolean).join('\n'), patterns: [...item.patterns], load: item.weight_kg === null ? '' : `${item.weight_kg} kg`, material: item.band_color ? `Goma ${item.band_color}` : '' }]);
    setPicker(false);
  }
  async function save(publish: boolean) {
    if (!model || busy) return;
    if (draft.some((e) => !e.name.trim())) { setError('Todos los ejercicios necesitan un nombre.'); return; }
    const missing = missingPatterns(model.model_code, draft);
    if (publish && missing.length) { setError(`Faltan patrones para publicar: ${missing.join(', ')}.`); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const revision = await saveModelDraft(model.id, model.revision, draft);
      const saved = { ...model, revision, draft: duplicateModelExercises(draft), inherits_base: model.week_number > 1 && revision !== model.revision ? false : model.inherits_base };
      setModel(saved); setModels((current) => current.map((item) => item.id === saved.id ? saved : item));
      if (publish) {
        const version = await publishModel(model.id, revision);
        setNotice(`Versión ${version} publicada.`);
        setVersions(await getModelVersions(model.id));
      } else setNotice('Borrador guardado.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el modelo.'); }
    finally { setBusy(false); }
  }
  async function restoreBase() {
    if (!model || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await restoreWeekFromBase(model.id, model.revision);
      const refreshed = await getMonthlyModels(month);
      const updated = refreshed.find((item) => item.id === model.id);
      if (!updated) throw new Error('No se pudo cargar la semana actualizada.');
      setModels(refreshed); setModel(updated); setDraft(duplicateModelExercises(updated.draft)); setExpandedDraft(null);
      setNotice('Semana actualizada: volverá a heredar los cambios de la primera semana.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar la semana.'); }
    finally { setBusy(false); }
  }
  const monthWeeks = getMonthWeeks(month);
  const activeWeek = monthWeeks[week - 1];
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>Modelos mensuales</Text>{!model ? <SectionMenu current="Modelos mensuales" /> : null}</View>
    {trainingStatus !== 'ready' ? <Text>Conecta la cuenta de entrenamientos para preparar los modelos.</Text> : <>
      {!model ? <>
        <View style={styles.row}><Pressable disabled={loading || busy} onPress={() => { setMonth((value) => shiftMonth(value, -1)); setWeek(1); setNotice(null); }}><Text style={styles.link}>‹ Anterior</Text></Pressable><Text style={styles.heading}>{formatMonth(month)}</Text><Pressable disabled={loading || busy} onPress={() => { setMonth((value) => shiftMonth(value, 1)); setWeek(1); setNotice(null); }}><Text style={styles.link}>Siguiente ›</Text></Pressable></View>
        {loading ? <ActivityIndicator /> : null}
        {!loading && !models.length && !error ? <View style={styles.card}><Text>Prepara los modelos A, B y C de este mes.</Text><Pressable disabled={busy} onPress={() => void create(false)}><Text style={styles.link}>Empezar desde cero</Text></Pressable><Pressable disabled={busy} onPress={() => void create(true)}><Text style={styles.link}>Copiar el mes anterior</Text></Pressable></View> : null}
        {models.length ? <><Text style={styles.heading}>Semanas del mes</Text><View style={styles.chips}>{monthWeeks.map((entry) => <Pressable key={entry.number} accessibilityRole="button" accessibilityState={{ selected: entry.number === week }} onPress={() => setWeek(entry.number)} style={[styles.chip, entry.number === week && styles.selected]}><Text>Semana {entry.number} · {entry.start.slice(8)}–{entry.end.slice(8)}</Text></Pressable>)}</View><Text>{activeWeek ? `Del ${activeWeek.start} al ${activeWeek.end}` : ''}</Text></> : null}
        {models.filter((item) => item.week_number === week).map((item) => <Pressable key={item.id} style={styles.card} onPress={() => void edit(item)}><Text style={styles.heading}>Modelo {item.model_code}</Text><Text>{MODEL_PATTERNS[item.model_code].join(' · ')}</Text><Text>{item.draft.length} ejercicios{item.week_number > 1 ? item.inherits_base ? ' · Hereda semana 1' : ' · Personalizado' : ' · Base'} · Abrir borrador ›</Text></Pressable>)}
        {error ? <Pressable onPress={() => setReloadKey((n) => n + 1)}><Text style={styles.link}>Reintentar</Text></Pressable> : null}
      </> : <>
        <Text style={styles.heading}>Modelo {model.model_code} · {formatMonth(month)} · Semana {model.week_number}</Text><Text>Patrones requeridos: {MODEL_PATTERNS[model.model_code].join(' · ')}</Text>
        {model.week_number > 1 ? <View style={styles.card}><Text>{model.inherits_base ? 'Esta semana hereda la semana 1 hasta que guardes una modificación.' : 'Esta semana tiene cambios propios y no se actualiza automáticamente.'}</Text><Pressable disabled={busy} onPress={() => Alert.alert('Actualizar desde la semana 1', 'Se sustituirá el borrador de esta semana, incluidos los cambios sin guardar. Después volverá a heredar la semana 1. Las versiones publicadas se conservan.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Actualizar', onPress: () => void restoreBase() }])}><Text style={styles.link}>Actualizar desde la semana 1</Text></Pressable></View> : null}
        <Text style={styles.hint}>Los cambios se guardan al pulsar «Guardar borrador» o «Publicar».</Text>
        {draft.map((exercise, index) => <View key={index} style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel={exercise.name.trim() || `Ejercicio ${index + 1}`} accessibilityState={{ expanded: expandedDraft === index }} onPress={() => setExpandedDraft((current) => current === index ? null : index)} style={styles.exerciseToggle}>
            <Text style={[styles.heading, styles.exerciseTitle]}>{exercise.name.trim() || `Ejercicio ${index + 1} · Sin nombre`}</Text>
            <Text style={styles.exerciseIndicator}>{expandedDraft === index ? '▴' : '▾'}</Text>
          </Pressable>
          {expandedDraft === index ? <>
            {fields.map((field) => <View key={field.key}><Text>{field.label}</Text><TextInput accessibilityLabel={`${field.label} ejercicio ${index + 1}`} value={exercise[field.key]} onChangeText={(value) => update(index, { [field.key]: value })} style={styles.input} /></View>)}
            <Text>Patrones · selección múltiple</Text><View style={styles.chips}>{CATEGORIES.patterns.map((pattern) => <Pressable key={pattern} accessibilityRole="checkbox" accessibilityState={{ checked: exercise.patterns.includes(pattern) }} onPress={() => update(index, { patterns: exercise.patterns.includes(pattern) ? exercise.patterns.filter((x) => x !== pattern) : [...exercise.patterns, pattern] })} style={[styles.chip, exercise.patterns.includes(pattern) && styles.selected]}><Text>{pattern}</Text></Pressable>)}</View>
            <View style={styles.row}><Pressable disabled={busy || index === 0} onPress={() => move(index, -1)}><Text style={styles.link}>↑ Subir</Text></Pressable><Pressable disabled={busy || index === draft.length - 1} onPress={() => move(index, 1)}><Text style={styles.link}>↓ Bajar</Text></Pressable><Pressable disabled={busy} onPress={() => { setDraft((current) => current.filter((_, i) => i !== index)); setExpandedDraft(null); }}><Text style={styles.link}>Quitar</Text></Pressable></View>
          </> : null}
        </View>)}
        {picker ? <ExercisePicker busy={busy} onClose={() => setPicker(false)} onChoose={addCatalog} /> : <Pressable disabled={busy} onPress={() => setPicker(true)}><Text style={styles.link}>+ Elegir de la biblioteca</Text></Pressable>}
        <Pressable disabled={busy} onPress={() => { setExpandedDraft(draft.length); setDraft((current) => [...current, emptyModelExercise()]); }}><Text style={styles.link}>+ Añadir ejercicio libre</Text></Pressable>
        {!draft.length ? <View style={styles.card}><Text>Copiar ejercicios de otro modelo de este mes:</Text><View style={styles.row}>{models.filter((item) => item.week_number === model.week_number && item.id !== model.id).map((item) => <Pressable key={item.id} onPress={() => setDraft(duplicateModelExercises(item.draft))}><Text style={styles.link}>Copiar {item.model_code}</Text></Pressable>)}</View></View> : null}
        <View style={styles.row}><Pressable disabled={busy} onPress={() => void save(false)}><Text style={styles.link}>Guardar borrador</Text></Pressable><Pressable disabled={busy} onPress={() => void save(true)}><Text style={styles.link}>Publicar</Text></Pressable></View>
        {versions.length ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Versiones publicadas</Text>
            {versions.map((version) => (
              <View key={version.id} style={styles.version}>
                <Text style={styles.versionTitle}>Versión {version.version_number} · {new Date(version.published_at).toLocaleDateString('es-ES')}</Text>
                {version.snapshot.map((item, index) => (
                  <PublishedExercise key={index} exercise={item} />
                ))}
              </View>
            ))}
          </View>
        ) : null}
        <Pressable disabled={busy} onPress={() => { setModel(null); setDraft([]); setExpandedDraft(null); setError(null); setNotice(null); setPicker(false); setReloadKey((n) => n + 1); }}><Text style={styles.link}>‹ Volver al mes (descartar cambios sin guardar)</Text></Pressable>
      </>}
      {busy ? <ActivityIndicator /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.success}>{notice}</Text> : null}
    </>}
  </ScrollView></SafeAreaView>;
}
function PublishedExercise({ exercise }: { exercise: ModelExercise }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.versionExercise}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exercise.name}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.exerciseToggle}
      >
        <Text style={[styles.versionText, styles.exerciseName, styles.exerciseTitle]}>{exercise.name}</Text>
        <Text style={styles.exerciseIndicator}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.exerciseDetails}>
          {exercise.patterns.length ? <Text style={styles.versionText}>Patrones: {exercise.patterns.join(', ')}</Text> : null}
          {fields.filter((field) => field.key !== 'name' && exercise[field.key]).map((field) => (
            <Text key={field.key} style={styles.versionText}>{field.label}: {exercise[field.key]}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  version: { gap: 10 },
  versionTitle: { fontSize: 20, fontWeight: '700', color: '#182321' },
  versionExercise: { gap: 3 },
  exerciseName: { fontWeight: '700' },
  exerciseToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  exerciseTitle: { flex: 1 },
  exerciseIndicator: { color: '#436b63', fontSize: 18 },
  exerciseDetails: { gap: 3 },
  versionText: { textAlign: 'justify', lineHeight: 22, color: '#182321' },
  page: { flex: 1, backgroundColor: '#f7f8fa' }, content: { padding: 20, gap: 14 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, zIndex: 10 }, title: { fontSize: 26, fontWeight: '700', color: '#182321', flexShrink: 1 }, heading: { fontSize: 18, fontWeight: '700' }, link: { color: '#436b63', fontSize: 16, fontWeight: '700' }, hint: { color: '#53615e' }, error: { color: '#a43d3d' }, success: { color: '#2f8a51' }, row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }, card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 10 }, input: { borderWidth: 1, borderColor: '#ccd6d1', borderRadius: 8, padding: 10, backgroundColor: '#fff' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { borderWidth: 1, borderColor: '#ccd6d1', borderRadius: 16, padding: 7 }, selected: { backgroundColor: '#cde5d8', borderColor: '#436b63' },
});
