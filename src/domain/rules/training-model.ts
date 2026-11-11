import type { ModelCode } from './training-plan';
export const MODEL_PATTERNS: Record<ModelCode, string[]> = {
  A: ['core', 'empuje superior', 'tracción inferior'],
  B: ['core', 'tracción superior', 'tracción inferior'],
  C: ['core', 'empuje superior', 'empuje inferior', 'tracción superior', 'tracción inferior'],
};
export type ModelExercise = {
  name: string; description: string; patterns: string[]; series: string; repetitions: string;
  duration: string; rest: string; load: string; material: string; adaptation: string;
};
export function emptyModelExercise(): ModelExercise {
  return { name: '', description: '', patterns: [], series: '', repetitions: '', duration: '', rest: '', load: '', material: '', adaptation: '' };
}
export function missingPatterns(code: ModelCode, exercises: ModelExercise[]): string[] {
  return MODEL_PATTERNS[code].filter((pattern) => !exercises.some((exercise) => exercise.name.trim() && exercise.patterns.includes(pattern)));
}
export function duplicateModelExercises(exercises: ModelExercise[]): ModelExercise[] {
  return exercises.map((exercise) => ({ ...exercise, patterns: [...exercise.patterns] }));
}
