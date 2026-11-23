/**
 * Mali SVG grafikoni za dashboard (bez biblioteke): mini-linija u kartici, linijski i stubičasti grafikon.
 * Vraćaju SVG kao tekst; svaki tekst koji ide u SVG prolazi kroz `esc`.
 */

export function esc(t: string): string {
  return t.replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]!);
}

const brojFmt = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });
export const fmt = (n: number) => brojFmt.format(n);

/** Granice ose sa malo vazduha; za ravnu liniju širi opseg da se ne deli nulom. */
function opseg(vrednosti: number[], odNule: boolean): [number, number] {
  let min = Math.min(...vrednosti);
  let max = Math.max(...vrednosti);
  if (odNule) min = Math.min(0, min);
  if (max === min) {
    max += 1;
    min -= odNule ? 0 : 1;
  }
  const zazor = (max - min) * 0.08;
  return [odNule && min >= 0 ? 0 : min - zazor, max + zazor];
}

/** Mini-linija (sparkline) za karticu; `null` tačke se preskaču. */
export function miniLinija(vrednosti: Array<number | null>, boja: string, sirina = 120, visina = 36): string {
  const tacke = vrednosti.map((v, i) => ({ v, i })).filter((t): t is { v: number; i: number } => t.v !== null);
  if (tacke.length < 2) return "";
  const [min, max] = opseg(tacke.map((t) => t.v), false);
  const x = (i: number) => (i / (vrednosti.length - 1)) * sirina;
  const y = (v: number) => visina - 2 - ((v - min) / (max - min)) * (visina - 4);
  const d = tacke.map((t, k) => `${k ? "L" : "M"}${x(t.i).toFixed(1)},${y(t.v).toFixed(1)}`).join(" ");
  const povrsina = `${d} L${x(tacke.at(-1)!.i).toFixed(1)},${visina} L${x(tacke[0]!.i).toFixed(1)},${visina} Z`;
  return `<svg class="mini" viewBox="0 0 ${sirina} ${visina}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${povrsina}" fill="${boja}" opacity="0.12"/>
    <path d="${d}" fill="none" stroke="${boja}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

export interface Tacka {
  oznaka: string;
  vrednost: number | null;
  /** Boja stubića (stubičasti grafikon). */
  boja?: string;
  /** Tekst za opis tačke (title). */
  opis?: string;
}

const DIM = { sirina: 560, visina: 200, levo: 40, desno: 12, gore: 12, dole: 26 };

function osa(min: number, max: number, jedinica: string): { linije: string; y: (v: number) => number } {
  const { sirina, visina, levo, desno, gore, dole } = DIM;
  const y = (v: number) => gore + (1 - (v - min) / (max - min)) * (visina - gore - dole);
  const korak = (max - min) / 4;
  const linije = Array.from({ length: 5 }, (_, i) => {
    const v = min + korak * i;
    return `<line x1="${levo}" x2="${sirina - desno}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mreza"/>
      <text x="${levo - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="osa">${esc(fmt(v))}</text>`;
  }).join("");
  return { linije: linije + `<text x="4" y="${gore - 2}" class="osa">${esc(jedinica)}</text>`, y };
}

function oznakeX(tacke: Tacka[], x: (i: number) => number, koliko = 6): string {
  const korak = Math.max(1, Math.ceil(tacke.length / koliko));
  return tacke
    .map((t, i) =>
      i % korak === 0 || i === tacke.length - 1
        ? `<text x="${x(i).toFixed(1)}" y="${DIM.visina - 6}" text-anchor="middle" class="osa">${esc(t.oznaka)}</text>`
        : "",
    )
    .join("");
}

export function linijskiGrafikon(tacke: Tacka[], boja: string, jedinica: string, opis: string): string {
  const vrednosti = tacke.map((t) => t.vrednost).filter((v): v is number => v !== null);
  if (vrednosti.length < 2) return `<p class="prazno">Nema dovoljno podataka za grafikon.</p>`;
  const [min, max] = opseg(vrednosti, false);
  const { sirina, levo, desno } = DIM;
  const x = (i: number) => levo + (i / Math.max(1, tacke.length - 1)) * (sirina - levo - desno);
  const { linije, y } = osa(min, max, jedinica);
  let d = "";
  let novi = true;
  tacke.forEach((t, i) => {
    if (t.vrednost === null) {
      novi = true;
      return;
    }
    d += `${novi ? "M" : "L"}${x(i).toFixed(1)},${y(t.vrednost).toFixed(1)} `;
    novi = false;
  });
  const poslednja = tacke.map((t, i) => ({ t, i })).filter((p) => p.t.vrednost !== null).at(-1)!;
  return `<svg class="grafikon" viewBox="0 0 ${sirina} ${DIM.visina}" role="img" aria-label="${esc(opis)}">
    ${linije}
    <path d="${d}" fill="none" stroke="${boja}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(poslednja.i).toFixed(1)}" cy="${y(poslednja.t.vrednost!).toFixed(1)}" r="4.5" fill="${boja}" stroke="#fff" stroke-width="2"/>
    ${oznakeX(tacke, x)}
  </svg>`;
}

export function stubicastiGrafikon(tacke: Tacka[], jedinica: string, opis: string): string {
  const vrednosti = tacke.map((t) => t.vrednost).filter((v): v is number => v !== null);
  if (vrednosti.length === 0) return `<p class="prazno">Nema podataka za poslednja 24 h.</p>`;
  const [min, max] = opseg(vrednosti, true);
  const { sirina, levo, desno } = DIM;
  const sirinaKolone = (sirina - levo - desno) / tacke.length;
  const x = (i: number) => levo + sirinaKolone * (i + 0.5);
  const { linije, y } = osa(min, max, jedinica);
  const stubici = tacke
    .map((t, i) => {
      if (t.vrednost === null) return "";
      const vrh = y(t.vrednost);
      const s = Math.max(2, sirinaKolone * 0.62);
      return `<rect x="${(x(i) - s / 2).toFixed(1)}" y="${vrh.toFixed(1)}" width="${s.toFixed(1)}" height="${(y(min) - vrh).toFixed(1)}" rx="3" fill="${t.boja ?? "#3b82f6"}"><title>${esc(t.opis ?? `${t.oznaka}: ${fmt(t.vrednost)} ${jedinica}`)}</title></rect>`;
    })
    .join("");
  return `<svg class="grafikon" viewBox="0 0 ${sirina} ${DIM.visina}" role="img" aria-label="${esc(opis)}">
    ${linije}${stubici}${oznakeX(tacke, x, 8)}
  </svg>`;
}
