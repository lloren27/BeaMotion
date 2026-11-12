export type MonthWeek = { number: number; start: string; end: string };
export function getWeekForDate(month: string, date: string): number | null {
  return getMonthWeeks(month).find((week) => date >= week.start && date <= week.end)?.number ?? null;
}

export function getMonthWeeks(month: string): MonthWeek[] {
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error('Mes no válido.');
  const [year, number] = month.split('-').map(Number);
  if (year < 1 || number < 1 || number > 12) throw new Error('Mes no válido.');
  const first = new Date(Date.UTC(year, number - 1, 1));
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const firstWeekday = (first.getUTCDay() + 6) % 7;
  const format = (day: number) => `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
  const weeks: MonthWeek[] = [];
  let day = 1;
  while (day <= last) {
    const end = Math.min(last, day + (day === 1 ? 6 - firstWeekday : 6));
    weeks.push({ number: weeks.length + 1, start: format(day), end: format(end) });
    day = end + 1;
  }
  return weeks;
}
