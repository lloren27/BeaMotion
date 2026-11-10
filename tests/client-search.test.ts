import { test } from 'node:test';
import { deepStrictEqual, rejects } from 'node:assert';
import { searchAllClientPages } from '../src/domain/rules/client-search.ts';

test('busca por nombre y apellidos en todas las páginas sin importar tildes', async () => {
  const pages = [ { clients: [{ nombre: 'Ana Martín Sanz' }], next_offset: 1 }, { clients: [{ nombre: 'Jesús García Sol' }, { nombre: 'Carmen Martín Sol' }], next_offset: null } ];
  const result = await searchAllClientPages(async (offset) => pages[offset], 'MARTIN');
  deepStrictEqual(result.map(x => x.nombre), ['Ana Martín Sanz', 'Carmen Martín Sol']);
  deepStrictEqual((await searchAllClientPages(async (offset) => pages[offset], 'garcia')).map(x => x.nombre), ['Jesús García Sol']);
});

test('detecta paginación que no avanza', async () => {
  await rejects(searchAllClientPages(async () => ({ clients: [], next_offset: 0 }), 'ana'), /paginación/i);
});


test('detiene la lectura al quedar obsoleta la búsqueda', async () => {
  let current = true;
  let calls = 0;
  const result = await searchAllClientPages(async () => { calls++; current = false; return { clients: [{ nombre: 'Ana' }], next_offset: 1 }; }, 'ana', () => current);
  deepStrictEqual(result, []);
  deepStrictEqual(calls, 1);
});
