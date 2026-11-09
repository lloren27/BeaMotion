import type { ModelCode, PlanSize } from '@/domain/rules/training-plan';
import { getTrainingSupabase } from '@/services/training-supabase/client';

export type SessionStatus = 'pending' | 'completed' | 'not_completed';
export type NotCompletedReason = 'cancelled' | 'changed';

export type TrainingSet = {
  id: string;
  position: number;
  series_count: number | null;
  repetitions: string | null;
  rest: string | null;
  load: string | null;
  actual_series_count: string | null;
  actual_repetitions: string | null;
  actual_rest: string | null;
  actual_load: string | null;
  actual_notes: string | null;
};

export type TrainingExercise = {
  id: string;
  name: string;
  notes: string | null;
  position: number;
  sets: TrainingSet[];
};

export type TrainingSession = {
  id: string;
  session_number: number;
  model_code: ModelCode;
  status: SessionStatus;
  not_completed_reason: NotCompletedReason | null;
  session_date: string | null;
  exercises: TrainingExercise[];
};

export type MonthlyTrainingPlan = {
  id: string;
  client_id: string;
  period_month: string;
  session_count: PlanSize;
  sessions: TrainingSession[];
};

function throwTrainingError(error: { code?: string; message?: string }) {
  if (error.code === '42501') throw new Error('Tu cuenta no tiene permiso para gestionar entrenamientos.');
  if (error.code === '23505' && error.message?.includes('different session count')) {
    throw new Error('Ya existe un plan para este mes con otro número de sesiones.');
  }
  throw new Error(error.message || 'No se pudieron guardar los entrenamientos.');
}

export async function getMonthlyTrainingPlan(clientId: string, periodMonth: string): Promise<MonthlyTrainingPlan | null> {
  const supabase = getTrainingSupabase();
  const { data, error } = await supabase
    .from('training_monthly_plans')
    .select('id, client_id, period_month, session_count, sessions:training_sessions(id, session_number, model_code, status, not_completed_reason, session_date, exercises:training_exercises(id, name, notes, position, sets:training_sets(id, position, series_count, repetitions, rest, load, actual_series_count, actual_repetitions, actual_rest, actual_load, actual_notes)))')
    .eq('client_id', clientId)
    .eq('period_month', periodMonth)
    .maybeSingle();
  if (error) throwTrainingError(error);
  if (!data) return null;
  const plan = data as unknown as MonthlyTrainingPlan;
  plan.sessions.sort((a, b) => a.session_number - b.session_number);
  plan.sessions.forEach((session) => session.exercises.sort((a, b) => a.position - b.position));
  plan.sessions.forEach((session) => session.exercises.forEach((exercise) => exercise.sets.sort((a, b) => a.position - b.position)));
  return plan;
}

export async function createMonthlyTrainingPlan(clientId: string, periodMonth: string, size: PlanSize): Promise<void> {
  const supabase = getTrainingSupabase();
  const { error } = await supabase.rpc('create_training_monthly_plan', {
    p_client_id: clientId,
    p_period_month: periodMonth,
    p_session_count: size,
  });
  if (error) throwTrainingError(error);
}

export async function updateTrainingSession(
  sessionId: string,
  update: { status: SessionStatus; reason?: NotCompletedReason | null; sessionDate?: string },
): Promise<void> {
  const { error } = await getTrainingSupabase().from('training_sessions').update({
    status: update.status,
    not_completed_reason: update.status === 'not_completed' ? update.reason : null,
    completed_at: update.status === 'completed' ? new Date().toISOString() : null,
    session_date: update.status === 'completed' ? update.sessionDate ?? null : null,
  }).eq('id', sessionId);
  if (error) throwTrainingError(error);
}

export async function updateTrainingSessionDate(sessionId: string, sessionDate: string): Promise<void> {
  const { error } = await getTrainingSupabase().from('training_sessions')
    .update({ session_date: sessionDate })
    .eq('id', sessionId);
  if (error) throwTrainingError(error);
}

export async function addTrainingExercise(sessionId: string, position: number): Promise<void> {
  const { error } = await getTrainingSupabase().from('training_exercises').insert({
    session_id: sessionId, position, name: 'Nuevo ejercicio',
  });
  if (error) throwTrainingError(error);
}

export async function saveTrainingExercise(exercise: TrainingExercise): Promise<void> {
  const supabase = getTrainingSupabase();
  const { error: exerciseError } = await supabase.from('training_exercises')
    .update({ name: exercise.name.trim(), notes: exercise.notes })
    .eq('id', exercise.id);
  if (exerciseError) throwTrainingError(exerciseError);

  for (const set of exercise.sets) {
    const { error } = await supabase.from('training_sets').update({
      series_count: set.series_count,
      repetitions: set.repetitions,
      rest: set.rest,
      load: set.load,
      actual_series_count: set.actual_series_count,
      actual_repetitions: set.actual_repetitions,
      actual_rest: set.actual_rest,
      actual_load: set.actual_load,
      actual_notes: set.actual_notes,
    }).eq('id', set.id);
    if (error) throwTrainingError(error);
  }
}

export async function addTrainingSet(exerciseId: string, position: number): Promise<void> {
  const { error } = await getTrainingSupabase().from('training_sets').insert({ exercise_id: exerciseId, position });
  if (error) throwTrainingError(error);
}
