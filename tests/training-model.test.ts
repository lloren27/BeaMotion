import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { missingPatterns, emptyModelExercise, duplicateModelExercises } from '../src/domain/rules/training-model.ts';

test('A, B y C requieren sus patrones propios', () => {
  deepStrictEqual(missingPatterns('A', []), ['core', 'empuje superior', 'tracción inferior']);
  deepStrictEqual(missingPatterns('B', []), ['core', 'tracción superior', 'tracción inferior']);
  deepStrictEqual(missingPatterns('C', []), ['core', 'empuje superior', 'empuje inferior', 'tracción superior', 'tracción inferior']);
  deepStrictEqual(missingPatterns('A', [{...emptyModelExercise(), name:'Uno', patterns:['core', 'empuje superior', 'tracción inferior']}]), []);
});
test('duplicar ejercicios no comparte campos editables', () => {
 const original = [{...emptyModelExercise(), name: 'Sentadilla', patterns: ['empuje inferior']}];
 const copy = duplicateModelExercises(original);
 copy[0].patterns.push('core'); copy[0].name = 'Copia';
 strictEqual(original[0].name, 'Sentadilla'); deepStrictEqual(original[0].patterns, ['empuje inferior']);
});
