export const CATEGORIES = {
  patterns: ['core', 'empuje superior', 'tracción superior', 'empuje inferior', 'tracción inferior', 'combinada', 'movilidad', 'HIIT'],
  laterality: ['unilateral', 'bilateral', 'combinado', 'otros'],
  positions: ['horizontal', 'vertical', 'sentado', 'tumbado', 'posición de caballero', 'cuadrupedia', 'combinado'],
  actions: ['rotación / antirotación', 'inclinación', 'flexión / extensión', 'giro', 'abducción / aducción', 'rebote', 'combinado'],
} as const;
export type ExerciseDraft = {
  name: string; description: string; patterns: string[]; laterality: string[]; positions: string[]; actions: string[];
  band_color: string; weight_kg: string; action_time: string; notes: string;
};
export type ExerciseValues = Omit<ExerciseDraft, 'weight_kg'> & { weight_kg: number | null };
export type CatalogExercise = ExerciseValues & { id: string; archived: boolean };
export const emptyExercise = (): ExerciseDraft => ({ name: '', description: '', patterns: [], laterality: [], positions: [], actions: [], band_color: '', weight_kg: '', action_time: '', notes: '' });
export function prepareExercise(draft: ExerciseDraft): ExerciseValues {
  const name = draft.name.trim();
  if (!name) throw new Error('Introduce el nombre del ejercicio.');
  const raw = draft.weight_kg.trim().replace(',', '.');
  const weight = raw === '' ? null : Number(raw);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0)) throw new Error('Introduce un peso válido en kg.');
  return { ...draft, name, description: draft.description.trim(), weight_kg: weight, band_color: draft.band_color.trim(), action_time: draft.action_time.trim(), notes: draft.notes.trim() };
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
const matchesQuery = (e: CatalogExercise, q: string, t: string) => normalize(e.name).includes(q) && (!t || [...e.patterns, ...e.laterality, ...e.positions, ...e.actions, e.band_color, e.action_time, e.notes, e.weight_kg === null ? '' : String(e.weight_kg)].some((value) => normalize(value).includes(t)));
export function filterExercises<T extends CatalogExercise>(exercises: T[], query: string, tag: string): T[] {
  const q = normalize(query); const t = normalize(tag);
  return exercises.filter((e) => !e.archived && matchesQuery(e, q, t));
}
export function filterArchivedExercises<T extends CatalogExercise>(exercises: T[], query: string, tag: string): T[] {
  const q = normalize(query); const t = normalize(tag);
  return exercises.filter((e) => e.archived && matchesQuery(e, q, t));
}
