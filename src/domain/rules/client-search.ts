type Page<T> = { clients: T[]; next_offset: number | null };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export async function searchAllClientPages<T extends { nombre: string }>(
  fetchPage: (offset: number) => Promise<Page<T>>,
  query: string,
  isCurrent: () => boolean = () => true,
): Promise<T[]> {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches: T[] = [];
  let offset: number | null = 0;
  while (offset !== null && isCurrent()) {
    const page: Page<T> = await fetchPage(offset);
    if (!isCurrent()) return [];
    matches.push(...page.clients.filter((client) => {
      const name = normalize(client.nombre);
      return words.every((word) => name.includes(word));
    }));
    if (page.next_offset !== null && page.next_offset <= offset) throw new Error('No se pudo avanzar en la paginación de clientes.');
    offset = page.next_offset;
  }
  return matches;
}
