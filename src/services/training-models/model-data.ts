import type { ModelCode } from '@/domain/rules/training-plan';
import type { ModelExercise } from '@/domain/rules/training-model';
import { getTrainingSupabase } from '@/services/training-supabase/client';

export type MonthlyModel = { id: string; period_month: string; model_code: ModelCode; draft: ModelExercise[]; revision: number; week_number: number; inherits_base: boolean };
export type ModelVersion = { id: string; model_id: string; version_number: number; snapshot: ModelExercise[]; published_at: string };
export async function getMonthlyModels(month: string): Promise<MonthlyModel[]> {
  const { data, error } = await getTrainingSupabase().from('monthly_training_models').select('*').eq('period_month', month).order('week_number').order('model_code');
  if (error) throw new Error(error.message);
  return data as unknown as MonthlyModel[];
}
export async function createMonthlyModels(month: string, copy: boolean): Promise<void> {
  const { error } = await getTrainingSupabase().rpc('create_monthly_models', { p_month: month, p_copy_previous: copy });
  if (error) throw new Error(error.message);
}
export async function saveModelDraft(id: string, revision: number, exercises: ModelExercise[]): Promise<number> {
  const { data, error } = await getTrainingSupabase().rpc('save_monthly_model_draft', { p_id: id, p_revision: revision, p_draft: exercises });
  if (error) throw new Error(error.message);
  return data;
}
export async function publishModel(id: string, revision: number): Promise<number> {
  const { data, error } = await getTrainingSupabase().rpc('publish_monthly_model', { p_id: id, p_revision: revision });
  if (error) throw new Error(error.message);
  return data;
}
export async function getModelVersions(id: string): Promise<ModelVersion[]> {
  const { data, error } = await getTrainingSupabase().from('monthly_model_versions').select('*').eq('model_id', id).order('version_number', { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as ModelVersion[];
}

export async function restoreWeekFromBase(id: string, revision: number): Promise<number> {
  const { data, error } = await getTrainingSupabase().rpc('restore_week_from_base', { p_id: id, p_revision: revision });
  if (error) throw new Error(error.message);
  return data;
}
