import type { CatalogExercise, ExerciseValues } from '@/domain/exercises/catalog';
import { getTrainingSupabase } from '@/services/training-supabase/client';

export async function listExercises(): Promise<CatalogExercise[]> {
  const { data, error } = await getTrainingSupabase().from('exercise_catalog').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
}
export async function saveCatalogExercise(values: ExerciseValues, id?: string): Promise<void> {
  const client = getTrainingSupabase();
  const result = id
    ? await client.from('exercise_catalog').update(values).eq('id', id).select('id').single()
    : await client.from('exercise_catalog').insert(values).select('id').single();
  if (result.error) throw new Error(result.error.message);
}
export async function archiveCatalogExercise(id: string): Promise<void> {
  const { error } = await getTrainingSupabase().from('exercise_catalog').update({ archived: true }).eq('id', id).select('id').single();
  if (error) throw new Error(error.message);
}
export async function unarchiveCatalogExercise(id: string): Promise<void> {
  const { error } = await getTrainingSupabase().from('exercise_catalog').update({ archived: false }).eq('id', id).select('id').single();
  if (error) throw new Error(error.message);
}
export async function addCatalogExerciseToSession(sessionId: string, position: number, catalogId: string): Promise<void> {
  const { error } = await getTrainingSupabase().rpc('add_catalog_exercise_to_session', { p_session_id: sessionId, p_position: position, p_catalog_id: catalogId });
  if (error) throw new Error(error.message);
}
