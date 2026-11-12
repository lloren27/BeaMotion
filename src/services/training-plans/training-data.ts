import { getBookingSnapshot } from '@/services/clients-integration/booking-data';
import type { DistributionResult } from '@/services/training-models/model-data';
import type { Json } from '@/types/training-database';
import type { ModelCode, PlanSize } from '@/domain/rules/training-plan';
import { getTrainingSupabase } from '@/services/training-supabase/client';

export type SessionStatus = 'pending' | 'completed' | 'not_completed';
export type NotCompletedReason = 'cancelled' | 'changed';

export type TrainingSet = {
  id: string;
  position: number;
  series_count: number | null;
  planned_series: string | null;
  duration: string | null;
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
  patterns: string[];
  material: string | null;
  adaptation: string | null;
  position: number;
  sets: TrainingSet[];
};

export type TrainingSession = {
  id: string;
  session_number: number;
  revision: number;
  booking_id: string | null;
  attendance_confirmed: boolean;
  scheduled_date: string | null;
  source_version_id: string | null;
  personalized: boolean;
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
    .select('id, client_id, period_month, session_count, sessions:training_sessions(id, session_number, revision, booking_id, attendance_confirmed, scheduled_date, source_version_id, personalized, model_code, status, not_completed_reason, session_date, exercises:training_exercises(id, name, notes, patterns, material, adaptation, position, sets:training_sets(id, position, series_count, planned_series, duration, repetitions, rest, load, actual_series_count, actual_repetitions, actual_rest, actual_load, actual_notes)))')
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

export async function saveTrainingExercise(sessionId: string, revision: number, exercise: TrainingExercise): Promise<void> {
  const { error } = await getTrainingSupabase().rpc('save_training_exercise', {
    p_session_id: sessionId, p_revision: revision, p_exercise: exercise as unknown as Json,
  });
  if (error) throwTrainingError(error);
}

export async function syncClientBookings(clientId: string, month: string): Promise<DistributionResult> {
  const snapshot = await getBookingSnapshot(month, clientId);
  const { data, error } = await getTrainingSupabase().rpc('sync_training_bookings', {
    p_month: month, p_clients: snapshot.clients as unknown as Json, p_observed_at: snapshot.observed_at,
  });
  if (error) throwTrainingError(error);
  const result = data as unknown as DistributionResult;
  return { ...result, excluded: [...snapshot.excluded, ...result.excluded] };
}

export async function addTrainingSet(exerciseId: string, position: number): Promise<void> {
  const { error } = await getTrainingSupabase().from('training_sets').insert({ exercise_id: exerciseId, position });
  if (error) throwTrainingError(error);
}
