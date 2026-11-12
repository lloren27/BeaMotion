import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { addCatalogExerciseToSession } from '@/services/exercises/exercise-data';

import { getMonthWeeks } from '@/domain/rules/month-weeks';
import { getMadridDate, getMadridMonth, shiftMonth, type PlanSize } from '@/domain/rules/training-plan';
import type { ClientBono } from '@/services/clients-integration/client-data';
import { useSession } from '@/services/supabase/session';
import {
  addTrainingExercise,
  addTrainingSet,
  createMonthlyTrainingPlan,
  getMonthlyTrainingPlan,
  saveTrainingExercise,
  updateTrainingSession,
  syncClientBookings,
  type MonthlyTrainingPlan,
  type NotCompletedReason,
  type SessionStatus,
  type TrainingExercise,
  type TrainingSet,
} from '@/services/training-plans/training-data';
import { colors, borderRadius, spacing } from '@/theme/colors';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthTitle(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTHS[monthNumber - 1]} ${year}`;
}

function completedDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function ClientTrainingSection({ clientId, bonos }: { clientId: string; bonos: ClientBono[] }) {
  const { trainingStatus } = useSession();
  const [month, setMonth] = useState(getMadridMonth());
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<MonthlyTrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedSessionIds, setConfirmedSessionIds] = useState<string[]>([]);
  const loadVersion = useRef(0);
  const activeBonos = bonos.filter((bono) =>
    bono.status === 'active'
    && bono.payment_validated_at !== null
    && bono.service_month.slice(0, 7) === month.slice(0, 7),
  );
  const activeBono = activeBonos.length === 1 ? activeBonos[0] : null;
  const planSize = activeBono && ([4, 8, 12] as number[]).includes(activeBono.sessions_total)
    ? activeBono.sessions_total as PlanSize
    : null;

  async function reload() {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    setConfirmedSessionIds([]);
    try {
      let syncMessage: string | null = null;
      try {
        const report = await syncClientBookings(clientId, month);
        if (report.excluded.length) syncMessage = report.excluded.map((item) => item.reason).join('. ');
      } catch (cause) {
        syncMessage = `No se actualizaron las reservas: ${cause instanceof Error ? cause.message : 'Vuelve a intentarlo.'}`;
      }
      if (version !== loadVersion.current) return;
      const nextPlan = await getMonthlyTrainingPlan(clientId, month);
      if (version !== loadVersion.current) return;
      setPlan(nextPlan);
      setConfirmedSessionIds(nextPlan?.sessions.filter((session) => session.attendance_confirmed && session.status === 'completed').map((session) => session.id) ?? []);
      if (syncMessage) setError(syncMessage);
    } catch (cause) {
      if (version === loadVersion.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el plan de entrenamientos.');
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (trainingStatus === 'ready') void reload();
    return () => { loadVersion.current += 1; };
  }, [clientId, month, trainingStatus, planSize, activeBono?.id]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.');
    } finally {
      setBusy(false);
    }
  }

  function updateExercise(exerciseId: string, transform: (exercise: TrainingExercise) => TrainingExercise) {
    setPlan((current) => current ? {
      ...current,
      sessions: current.sessions.map((session) => ({
        ...session,
        exercises: session.exercises.map((exercise) => exercise.id === exerciseId ? transform(exercise) : exercise),
      })),
    } : current);
  }

  async function createPlan(size: PlanSize) {
    await run(() => createMonthlyTrainingPlan(clientId, month, size));
  }

  async function markSession(sessionId: string, status: SessionStatus, reason?: NotCompletedReason) {
    await run(() => updateTrainingSession(sessionId, {
      status, reason, sessionDate: status === 'completed' ? getMadridDate() : undefined,
    }));
  }

  async function addExercise(sessionId: string, count: number) {
    await run(() => addTrainingExercise(sessionId, count));
  }

  async function addSet(exerciseId: string, count: number) {
    await run(() => addTrainingSet(exerciseId, count));
  }

  async function saveExercise(exercise: TrainingExercise) {
    const session = plan?.sessions.find((item) => item.exercises.some((entry) => entry.id === exercise.id));
    if (session) await run(() => saveTrainingExercise(session.id, session.revision, exercise));
  }

  if (trainingStatus !== 'ready') {
    const message = trainingStatus === 'unconfigured'
      ? 'Configura el proyecto Supabase de entrenamientos para activarlos.'
      : trainingStatus === 'pending'
        ? 'Conectando con los entrenamientos…'
        : 'No se pudo iniciar sesión en el proyecto de entrenamientos. Revisa su cuenta en Auth y vuelve a entrar.';
    return <View style={styles.section}><Text style={styles.heading}>Entrenamientos</Text><Text style={styles.muted}>{message}</Text></View>;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Entrenamientos</Text>
      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setMonth((current) => shiftMonth(current, -1))} style={styles.monthButton}>
          <Text style={styles.link}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setMonth((current) => shiftMonth(current, 1))} style={styles.monthButton}>
          <Text style={styles.link}>›</Text>
        </Pressable>
      </View>
      {plan && plan.period_month === month ? (
        <Pressable disabled={busy || loading} onPress={() => void reload()}><Text style={styles.link}>Actualizar reservas y ejercicios</Text></Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {error && !loading ? <Pressable onPress={() => void reload()}><Text style={styles.link}>Reintentar</Text></Pressable> : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {!loading && !plan && !error ? (
        <>
          {activeBonos.length > 1 ? <Text style={styles.error}>Hay varios bonos activos para este mes. Revisa los bonos en Lovable antes de generar el plan.</Text> : null}
          {activeBonos.length === 0 ? <Text style={styles.muted}>No hay un bono activo con el pago validado para este mes.</Text> : null}
          {activeBono && !planSize ? <Text style={styles.muted}>El bono tiene {activeBono.sessions_total} sesiones. Los planes disponibles son de 4, 8 o 12 sesiones.</Text> : null}
          {planSize && month !== getMadridMonth() ? (
            <Pressable disabled={busy} onPress={() => void createPlan(planSize)} style={styles.choice}>
              <Text style={styles.choiceTitle}>Generar plan de {planSize} sesiones</Text>
              <Text style={styles.choiceText}>Según el bono activo de {month.slice(0, 7)} · {planSize === 4 ? 'C' : planSize === 8 ? 'AB' : 'ABC'}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {!loading && plan && plan.period_month === month ? (
        <>
          <Text style={styles.muted}>{plan.session_count} sesiones este mes</Text>
          {activeBono && plan.session_count !== activeBono.sessions_total ? (
            <Text style={styles.error}>El plan tiene {plan.session_count} sesiones y el bono activo tiene {activeBono.sessions_total}. Revisa esta diferencia antes de continuar.</Text>
          ) : null}
          {plan.sessions.map((session) => (
            <View key={session.id} style={[styles.session, session.status === 'completed' ? styles.completed : session.status === 'not_completed' ? session.not_completed_reason === 'changed' ? styles.changed : styles.notCompleted : styles.pending]}>
              <View>
                <Text style={styles.sessionTitle}>Sesión {session.session_number} · Modelo {session.model_code}</Text>
                <Text style={styles.muted}>{session.scheduled_date ? `Semana ${getMonthWeeks(month).find((week) => session.scheduled_date! >= week.start && session.scheduled_date! <= week.end)?.number ?? '—'} · ${completedDate(session.scheduled_date)}` : 'Sin reserva asignada'}</Text>
                <Text style={styles.muted}>{session.personalized ? 'Personalizada · se conserva al publicar' : session.source_version_id ? 'Ejercicios del modelo publicado' : 'Contenido pendiente de preparar'}</Text>
                <Text style={styles.statusText}>{session.status === 'completed' ? `Realizada${session.session_date ? ` · ${completedDate(session.session_date)}` : ''}` : session.status === 'not_completed' ? `No realizada · ${session.not_completed_reason === 'cancelled' ? 'cancelación' : 'cambio de fecha'}` : 'Pendiente'}</Text>
              </View>
              <View style={styles.statusActions}>
                <Pressable accessibilityLabel="Marcar como realizada" accessibilityRole="button" disabled={busy || session.status === 'completed'} onPress={() => void markSession(session.id, 'completed')} style={styles.statusButton}>
                  <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={25} tintColor={colors.success} />
                </Pressable>
                {session.status !== 'pending' && !confirmedSessionIds.includes(session.id) ? (
                  <Pressable accessibilityLabel="Marcar como pendiente" accessibilityRole="button" disabled={busy} onPress={() => void markSession(session.id, 'pending')} style={styles.statusButton}>
                    <SymbolView name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} size={24} tintColor={colors.textMuted} />
                  </Pressable>
                ) : null}
                {session.status !== 'completed' && !confirmedSessionIds.includes(session.id) ? (
                  <>
                    <Pressable accessibilityLabel="Marcar como cancelada" accessibilityRole="button" disabled={busy} onPress={() => void markSession(session.id, 'not_completed', 'cancelled')} style={styles.statusButton}>
                      <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={25} tintColor={colors.destructive} />
                    </Pressable>
                    <Pressable accessibilityLabel="Marcar como cambio de fecha" accessibilityRole="button" disabled={busy} onPress={() => void markSession(session.id, 'not_completed', 'changed')} style={styles.statusButton}>
                      <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }} size={25} tintColor={colors.textMuted} />
                    </Pressable>
                  </>
                ) : null}
              </View>
              {session.exercises.map((exercise) => (
                <ExerciseEditor
                  key={exercise.id}
                  exercise={exercise}
                  busy={busy}
                  onChange={(transform) => updateExercise(exercise.id, transform)}
                  onSave={() => void saveExercise(exercise)}
                  onAddSet={() => void addSet(exercise.id, exercise.sets.length)}
                />
              ))}
              {pickerSessionId === session.id ? <ExercisePicker busy={busy} onClose={() => setPickerSessionId(null)} onChoose={(item) => {
                void run(async () => { await addCatalogExerciseToSession(session.id, session.exercises.length, item.id); setPickerSessionId(null); });
              }} /> : <Pressable disabled={busy} onPress={() => setPickerSessionId(session.id)} style={styles.addButton}><Text style={styles.link}>+ Elegir de la biblioteca</Text></Pressable>}
              <Pressable disabled={busy} onPress={() => void addExercise(session.id, session.exercises.length)} style={styles.addButton}>
                <Text style={styles.link}>+ Añadir ejercicio</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function ExerciseEditor({
  exercise, busy, onChange, onSave, onAddSet,
}: {
  exercise: TrainingExercise;
  busy: boolean;
  onChange: (transform: (exercise: TrainingExercise) => TrainingExercise) => void;
  onSave: () => void;
  onAddSet: () => void;
}) {
  function updateSet(setId: string, field: keyof TrainingSet, value: string) {
    onChange((current) => ({
      ...current, sets: current.sets.map((set) => set.id === setId ? {
        ...set,
        [field]: field === 'series_count' ? (value ? Number(value) || null : null) : value || null,
      } : set)
    }));
  }

  return (
    <View style={styles.exercise}>
      <TextInput
        accessibilityLabel="Nombre del ejercicio"
        onChangeText={(name) => onChange((current) => ({ ...current, name }))}
        placeholder="Nombre del ejercicio"
        style={styles.input}
        value={exercise.name}
      />
      <TextInput
        accessibilityLabel="Notas del ejercicio"
        multiline
        onChangeText={(notes) => onChange((current) => ({ ...current, notes: notes || null }))}
        placeholder="Notas del ejercicio"
        style={[styles.input, styles.multiline]}
        value={exercise.notes ?? ''}
      />
      {exercise.patterns.length ? <Text style={styles.muted}>{exercise.patterns.join(' · ')}</Text> : null}
      <Field label="Material" value={exercise.material ?? ''} onChange={(material) => onChange((current) => ({ ...current, material: material || null }))} />
      <Field label="Progresión / regresión" value={exercise.adaptation ?? ''} onChange={(adaptation) => onChange((current) => ({ ...current, adaptation: adaptation || null }))} />
      {exercise.sets.map((set) => (
        <View key={set.id} style={styles.setCard}>
          <View style={styles.setFields}>
            <Field label="Series" value={set.planned_series ?? set.series_count?.toString() ?? ''} onChange={(value) => updateSet(set.id, 'planned_series', value)} />
            <Field label="Duración" value={set.duration ?? ''} onChange={(value) => updateSet(set.id, 'duration', value)} />
            <Field label="Repeticiones" value={set.repetitions ?? ''} onChange={(value) => updateSet(set.id, 'repetitions', value)} />
            <Field label="Descanso" value={set.rest ?? ''} onChange={(value) => updateSet(set.id, 'rest', value)} />
            <Field label="Peso / carga" value={set.load ?? ''} onChange={(value) => updateSet(set.id, 'load', value)} />
          </View>
          <Text style={styles.actualLabel}>Realizado (si fue distinto)</Text>
          <View style={styles.setFields}>
            <Field label="Series reales" value={set.actual_series_count ?? ''} onChange={(value) => updateSet(set.id, 'actual_series_count', value)} />
            <Field label="Repeticiones reales" value={set.actual_repetitions ?? ''} onChange={(value) => updateSet(set.id, 'actual_repetitions', value)} />
            <Field label="Descanso real" value={set.actual_rest ?? ''} onChange={(value) => updateSet(set.id, 'actual_rest', value)} />
            <Field label="Peso / carga real" value={set.actual_load ?? ''} onChange={(value) => updateSet(set.id, 'actual_load', value)} />
          </View>
          <TextInput
            accessibilityLabel="Aclaraciones de ejecución"
            onChangeText={(value) => updateSet(set.id, 'actual_notes', value)}
            placeholder="Aclaraciones de ejecución"
            style={styles.input}
            value={set.actual_notes ?? ''}
          />
        </View>
      ))}
      <View style={styles.exerciseActions}>
        <Pressable disabled={busy} onPress={onAddSet}><Text style={styles.link}>+ Añadir línea de series</Text></Pressable>
        <Pressable disabled={busy} onPress={onSave} style={styles.saveButton}><Text style={styles.saveText}>Guardar</Text></Pressable>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, keyboardType }: { label: string; value: string; onChange: (value: string) => void; keyboardType?: 'number-pad' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput keyboardType={keyboardType} onChangeText={onChange} placeholder="—" style={styles.fieldInput} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: borderRadius.md, gap: spacing.md },
  heading: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  monthTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  choice: { padding: spacing.md, borderColor: colors.borderLight, borderWidth: 1, borderRadius: borderRadius.sm, gap: spacing.xs },
  choiceTitle: { color: colors.textPrimary, fontWeight: '700' },
  choiceText: { color: colors.textSecondary, fontSize: 13 },
  muted: { color: colors.textSecondary, fontSize: 14 },
  error: { color: colors.error, fontSize: 14 },
  link: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  session: { padding: spacing.md, borderRadius: borderRadius.sm, gap: spacing.sm, borderWidth: 1 },
  pending: { backgroundColor: colors.muted, borderColor: colors.border },
  completed: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  notCompleted: { backgroundColor: colors.destructiveBg, borderColor: colors.destructiveBorder },
  changed: { backgroundColor: colors.muted, borderColor: colors.border },
  sessionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  statusText: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.xs },
  statusActions: { flexDirection: 'row', alignSelf: 'flex-start', gap: spacing.sm },
  statusButton: { backgroundColor: colors.card, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: spacing.sm },
  exercise: { backgroundColor: colors.card, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.sm, gap: spacing.sm },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: spacing.sm, padding: spacing.sm, color: colors.textPrimary, fontSize: 14 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  setCard: { gap: spacing.sm, paddingTop: spacing.sm, borderTopColor: colors.borderLight, borderTopWidth: 1 },
  setFields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { minWidth: '45%', flexGrow: 1, gap: spacing.xs },
  fieldLabel: { color: colors.textSecondary, fontSize: 11 },
  fieldInput: { backgroundColor: colors.surfaceLight, borderColor: colors.border, borderWidth: 1, borderRadius: spacing.sm, padding: spacing.sm, color: colors.textPrimary, fontSize: 14 },
  actualLabel: { color: colors.brand, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  exerciseActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  saveButton: { backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: spacing.sm },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  addButton: { paddingVertical: spacing.xs },
});
