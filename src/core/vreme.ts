/**
 * Rad sa vremenom u zoni Europe/Belgrade (NFR-06).
 * Zajedničko za ceo projekat – i ekonet klijent i prikazi mogu da koriste.
 */

const ZONA = "Europe/Belgrade";

function delovi(d: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** ISO 8601 sa zonom Beograda, npr. "2026-11-16T09:00:00+01:00" (leti +02:00). */
export function isoBeograd(d: Date): string {
  const p = delovi(d);
  // timeZoneName je "GMT+01:00" (ili "GMT" za nulti pomak, što se u Beogradu ne dešava)
  const pomak = p.timeZoneName === "GMT" ? "+00:00" : p.timeZoneName.replace("GMT", "");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${pomak}`;
}

/** Pun format za prikaz: "16.11.2026. 09:00". */
export function prikazDatumVreme(d: Date): string {
  const p = delovi(d);
  return `${p.day}.${p.month}.${p.year}. ${p.hour}:${p.minute}`;
}

/** Kratak format za poruke: "15.11. u 14:00". */
export function prikazKratko(d: Date): string {
  const p = delovi(d);
  return `${p.day}.${p.month}. u ${p.hour}:${p.minute}`;
}
