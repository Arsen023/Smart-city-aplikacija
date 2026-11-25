/**
 * Naš A2UI katalog za CopilotKit renderer (React): osnovni katalog v0.9 + iste sopstvene komponente
 * kao izvorni A2UI (src/a2ui/komponente/) – KategorijaBadge, Grafikon24h, GrafikonNiz, PrognozaSati, MapaSenzora.
 * Isti ID kataloga i ista imena, pa AI koristi isti raspored u obe varijante verzije B.
 * Komponente samo crtaju vrednosti iz data modela (server ih je izračunao i formatirao).
 */
import { createCatalog } from "@copilotkit/a2ui-renderer";
import L from "leaflet";
import { useEffect, useRef, type ReactElement } from "react";
// CopilotKit renderer radi sa Zod 3 šemama – isti API kao zod/v3.
import { z } from "zod/v3";
import {
  KATALOG_ID,
  KOMPONENTA_GRAFIKON,
  KOMPONENTA_KATEGORIJA,
  KOMPONENTA_MAPA,
  KOMPONENTA_NIZ,
  KOMPONENTA_PROGNOZA,
  type SatPrognoze,
  type TackaMape,
  type TackaNiza,
} from "../../../zajednicko/a2ui-katalog.js";
import { bojeKategorije, EAQI_BOJE } from "../../../zajednicko/boje-eaqi.js";
import { BOJA_PM10, BOJA_PM25, geometrija, PODRAZUMEVANE as D } from "../../../zajednicko/geometrija.js";

/**
 * Polje koje može biti vezano na data model ({path}). Renderer razrešava {path} samo za polja čija šema
 * dozvoljava taj oblik. Ove šeme CopilotKit šalje i modelu, ali ih server izbacuje iz zahteva
 * (src/chat/copilotkit.ts, prilagodiZahtev) – AI oblik komponenti dobija u opisu alata prikazi_ekran.
 */
const Vezano = z.union([z.string(), z.number(), z.object({ path: z.string() })]);
const VezanNiz = z.union([z.array(z.unknown()), z.object({ path: z.string() })]);

const definicije = {
  [KOMPONENTA_KATEGORIJA]: { description: "EAQI kategorija vazduha", props: z.object({ naziv: Vezano, nivo: Vezano }) },
  [KOMPONENTA_GRAFIKON]: { description: "PM2.5/PM10 za 24 h", props: z.object({ tacke: VezanNiz }) },
  [KOMPONENTA_NIZ]: {
    description: "grafikon jednog niza",
    props: z.object({ tacke: VezanNiz, jedinica: Vezano.optional(), naslov: Vezano.optional() }),
  },
  [KOMPONENTA_PROGNOZA]: { description: "prognoza po satima", props: z.object({ sati: VezanNiz }) },
  [KOMPONENTA_MAPA]: { description: "mapa senzora", props: z.object({ tacke: VezanNiz }) },
};

const niz = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const tekst = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });

export function Znacka({ naziv, nivo }: { naziv: string; nivo: number }): ReactElement {
  const b = bojeKategorije(nivo);
  return (
    <span className="ck-znacka" role="status" style={{ background: b.pozadina, color: b.tekst }}>
      {naziv} <small>nivo {nivo}/6</small>
    </span>
  );
}

export function GrafikonPm({ tacke }: { tacke: unknown[] }): ReactElement | null {
  const t = tacke.filter((x): x is { vreme: string; pm25: number | null; pm10: number | null } => typeof x === "object" && x !== null && "vreme" in x);
  if (!t.length) return null;
  const g = geometrija(t);
  return (
    <figure className="ck-grafikon">
      <svg viewBox={`0 0 ${D.sirina} ${D.visina}`} role="img" aria-label="PM2.5 i PM10 za poslednja 24 h">
        {g.oznakeY.map((o) => (
          <g key={o.y}>
            <line x1={D.levo} x2={D.sirina - D.desno} y1={o.y} y2={o.y} stroke="currentColor" strokeOpacity={0.12} />
            <text x={D.levo - 4} y={o.y + 3} textAnchor="end" className="osa">{o.tekst}</text>
          </g>
        ))}
        {g.oznakeX.map((o) => (
          <text key={o.x} x={o.x} y={D.visina - D.dole + 14} textAnchor="middle" className="osa">{o.tekst}h</text>
        ))}
        {g.pm10 && <path d={g.pm10} fill="none" stroke={BOJA_PM10} strokeWidth={2} strokeDasharray="5 3" />}
        {g.pm25 && <path d={g.pm25} fill="none" stroke={BOJA_PM25} strokeWidth={2} />}
      </svg>
      <figcaption>PM2.5 (puna linija) i PM10 (isprekidana), µg/m³</figcaption>
    </figure>
  );
}

const BOJE_NIZA: Record<string, string> = { "°C": "#f97316", "%": "#8b5cf6", "mg/L": "#2563eb", pH: "#0891b2" };

export function GrafikonNizova({ tacke, jedinica, naslov }: { tacke: unknown[]; jedinica: string; naslov: string }): ReactElement {
  const t = tacke.filter((x): x is TackaNiza => typeof x === "object" && x !== null && "oznaka" in x);
  const v = t.map((x) => x.vrednost).filter((x): x is number => typeof x === "number");
  if (v.length < 2) return <p className="ck-sitno">Nema dovoljno podataka za grafikon.</p>;
  const W = 560, H = 170, l = 40, r = 10, g = 10, d = 24;
  let [min, max] = [Math.min(...v), Math.max(...v)];
  if (min === max) [min, max] = [min - 1, max + 1];
  const zazor = (max - min) * 0.1;
  [min, max] = [min - zazor, max + zazor];
  const x = (i: number) => l + (i / Math.max(1, t.length - 1)) * (W - l - r);
  const y = (n: number) => g + (1 - (n - min) / (max - min)) * (H - g - d);
  let put = "";
  let novi = true;
  t.forEach((p, i) => {
    if (typeof p.vrednost !== "number") return void (novi = true);
    put += `${novi ? "M" : "L"}${x(i).toFixed(1)},${y(p.vrednost).toFixed(1)} `;
    novi = false;
  });
  const korak = Math.max(1, Math.ceil(t.length / 6));
  return (
    <figure className="ck-grafikon">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${naslov || "Grafikon"} ${jedinica}`}>
        {[0, 1, 2, 3].map((k) => {
          const n = min + ((max - min) * k) / 3;
          return (
            <g key={k}>
              <line x1={l} x2={W - r} y1={y(n)} y2={y(n)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={l - 4} y={y(n) + 3} textAnchor="end" className="osa">{broj.format(n)}</text>
            </g>
          );
        })}
        {t.map((p, i) =>
          i % korak === 0 || i === t.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="osa">{p.oznaka}</text>
          ) : null,
        )}
        <path d={put} fill="none" stroke={BOJE_NIZA[jedinica] ?? "#2563eb"} strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
      {(naslov || jedinica) && <figcaption>{[naslov, jedinica].filter(Boolean).join(", ")}</figcaption>}
    </figure>
  );
}

export function Prognoza({ sati }: { sati: unknown[] }): ReactElement {
  const s = sati.filter((x): x is SatPrognoze => typeof x === "object" && x !== null && "sat" in x);
  if (!s.length) return <p className="ck-sitno">Prognoza nije dostupna.</p>;
  return (
    <ul className="ck-prognoza" aria-label="Prognoza po satima">
      {s.map((p) => (
        <li key={p.sat} title={p.opis}>
          <span className="ck-sitno">{p.sat}</span>
          <span aria-hidden="true">{p.ikona}</span>
          <b>{p.temperatura}</b>
        </li>
      ))}
    </ul>
  );
}

export function Mapa({ tacke }: { tacke: unknown[] }): ReactElement {
  const el = useRef<HTMLDivElement>(null);
  const t = tacke.filter((x): x is TackaMape => typeof x === "object" && x !== null && "lat" in x && "lon" in x);
  const kljuc = JSON.stringify(t);
  useEffect(() => {
    if (!el.current) return;
    const mapa = L.map(el.current, { scrollWheelZoom: false }).setView([45.255, 19.845], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    for (const s of t) {
      const krug = L.circleMarker([s.lat, s.lon], {
        radius: s.model ? 12 : 8,
        color: s.model ? "#1e293b" : "#ffffff",
        weight: 2,
        dashArray: s.model ? "4 3" : undefined,
        fillColor: s.nivo ? (EAQI_BOJE[s.nivo] ?? "#94a3b8") : "#94a3b8",
        fillOpacity: 0.9,
      }).addTo(mapa);
      // textContent umesto HTML-a: nazivi stižu sa servera, ne ubacuju se kao kod
      const popup = document.createElement("div");
      popup.append(Object.assign(document.createElement("strong"), { textContent: s.naziv }), document.createElement("br"), s.kategorija, document.createElement("br"), s.opis);
      krug.bindPopup(popup).bindTooltip(s.naziv);
    }
    if (t.length > 1) mapa.fitBounds(t.map((s) => [s.lat, s.lon] as [number, number]), { padding: [28, 28], maxZoom: 13 });
    const odlozeno = setTimeout(() => mapa.invalidateSize(), 60);
    return () => {
      clearTimeout(odlozeno);
      mapa.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kljuc]);
  return <div ref={el} className="ck-mapa" role="region" aria-label="Mapa senzora kvaliteta vazduha" />;
}

type P = { props: Record<string, unknown> };

export const katalogCopilot = createCatalog(
  definicije as never,
  {
    [KOMPONENTA_KATEGORIJA]: ({ props }: P) =>
      props.naziv ? <Znacka naziv={tekst(props.naziv)} nivo={Number(props.nivo)} /> : null,
    [KOMPONENTA_GRAFIKON]: ({ props }: P) => <GrafikonPm tacke={niz(props.tacke)} />,
    [KOMPONENTA_NIZ]: ({ props }: P) => (
      <GrafikonNizova tacke={niz(props.tacke)} jedinica={tekst(props.jedinica)} naslov={tekst(props.naslov)} />
    ),
    [KOMPONENTA_PROGNOZA]: ({ props }: P) => <Prognoza sati={niz(props.sati)} />,
    [KOMPONENTA_MAPA]: ({ props }: P) => <Mapa tacke={niz(props.tacke)} />,
  } as never,
  { catalogId: KATALOG_ID, includeBasicCatalog: true },
);
