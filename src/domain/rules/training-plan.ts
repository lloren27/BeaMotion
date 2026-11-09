export type PlanSize = 4 | 8 | 12;
export type ModelCode = 'A' | 'B' | 'C';

export function getModelSequence(size: PlanSize): ModelCode[] {
  const pattern: ModelCode[] = size === 4 ? ['C'] : size === 8 ? ['A', 'B'] : ['A', 'B', 'C'];
  return Array.from({ length: size }, (_, index) => pattern[index % pattern.length]);
}

export function getMadridMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('No se pudo determinar el mes actual.');
  return `${year}-${month}-01`;
}

export function getMadridDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error('No se pudo determinar la fecha actual.');
  return `${year}-${month}-${day}`;
}

export function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber || monthNumber > 12) throw new Error('Mes no válido.');
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
