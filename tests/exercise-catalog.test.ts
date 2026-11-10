import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { filterExercises, prepareExercise } from '../src/domain/exercises/catalog.ts';

const sample = { name: '  Zancada y press  ', description: 'Instrucciones', patterns: ['core', 'empuje superior'], laterality: ['unilateral'], positions: [], actions: [], band_color: 'roja', weight_kg: '8', action_time: '3 s', notes: '' };

test('valida y normaliza una ficha sin perder clasificaciones múltiples', () => {
  const result = prepareExercise(sample);
  strictEqual(result.name, 'Zancada y press');
  deepStrictEqual(result.patterns, ['core', 'empuje superior']);
  strictEqual(result.weight_kg, 8);
  throws(() => prepareExercise({ ...sample, name: '  ' }), /nombre/i);
  throws(() => prepareExercise({ ...sample, weight_kg: '-1' }), /peso/i);
});

test('filtra por nombre y etiquetas sin distinguir mayúsculas ni acentos', () => {
  const exercises = [{ ...prepareExercise(sample), id: '1', archived: false }, { ...prepareExercise({ ...sample, name: 'Remo', patterns: ['tracción superior'] }), id: '2', archived: false }];
  deepStrictEqual(filterExercises(exercises, 'ZANCADA', 'core').map(x => x.id), ['1']);
  deepStrictEqual(filterExercises(exercises, '', 'traccion superior').map(x => x.id), ['2']);
  deepStrictEqual(filterExercises(exercises, 'zancada', 'roja').map(x => x.id), ['1']);
  deepStrictEqual(filterExercises([{ ...exercises[0], archived: true }], '', '').map(x => x.id), []);
});
