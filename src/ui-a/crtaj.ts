/**
 * Upisuje ModelEkrana u DOM. Samo textContent i hidden – podaci nikad ne idu kroz innerHTML.
 */
import { BOJA_PM10, BOJA_PM25 } from "../zajednicko/geometrija.js";
import type { ModelEkrana, ModelGrafikona } from "./prikaz.js";
import type { StanicaZaIzbor } from "./sema.js";

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Nedostaje element #${id} u index.html`);
  return e as T;
}

export const dom = {
  koren: el("koren"),
  naslov: el("naslov"),
  izbor: el<HTMLSelectElement>("izbor"),
  osvezi: el<HTMLButtonElement>("osvezi"),
  vrednosti: el<HTMLUListElement>("vrednosti"),
  vreme: el("vreme"),
  grafikon: el("grafikon"),
  grafikonSvg: document.getElementById("grafikon-svg") as unknown as SVGSVGElement,
  grafikonPotpis: el("grafikon-potpis"),
  legPm25: el("leg-pm25"),
  legPm10: el("leg-pm10"),
  kategorija: el("kategorija"),
  kategorijaNaziv: el("kategorija-naziv"),
  kategorijaOpis: el("kategorija-opis"),
  napomena: el("napomena"),
  poruka: el("poruka"),
  pokusajPonovo: el<HTMLButtonElement>("pokusaj-ponovo"),
  savetBlok: el("savet-blok"),
  savet: el("savet"),
  osnov: el("osnov"),
  pravilo: el("pravilo"),
};

function tekst(e: HTMLElement, t: string | null) {
  e.textContent = t ?? "";
  e.hidden = t === null;
}

export function crtaj(m: ModelEkrana): void {
  dom.koren.dataset.stanje = m.stanje;
  dom.naslov.textContent = m.naslov;

  dom.vrednosti.replaceChildren(
    ...(m.vrednosti ?? []).map((v) => {
      const li = document.createElement("li");
      li.textContent = v;
      return li;
    }),
  );
  dom.vrednosti.hidden = m.vrednosti === null;

  tekst(dom.vreme, m.vreme);
  crtajGrafikon(m.grafikon);

  dom.kategorija.hidden = m.kategorija === null;
  if (m.kategorija) {
    dom.kategorija.style.backgroundColor = m.kategorija.pozadina;
    dom.kategorija.style.color = m.kategorija.tekst;
    dom.kategorijaNaziv.textContent = m.kategorija.naziv;
    dom.kategorijaOpis.textContent = m.kategorija.opis;
  }

  tekst(dom.napomena, m.napomena);
  tekst(dom.poruka, m.poruka);
  dom.pokusajPonovo.hidden = !m.pokusajPonovo;

  tekst(dom.savet, m.savet);
  tekst(dom.osnov, m.osnov);
  tekst(dom.pravilo, m.pravilo);
  dom.savetBlok.hidden = m.savet === null && m.pravilo === null;
}

const SVG = "http://www.w3.org/2000/svg";

function svgEl(ime: string, atributi: Record<string, string | number>, tekstSadrzaj?: string): SVGElement {
  const e = document.createElementNS(SVG, ime);
  for (const [k, v] of Object.entries(atributi)) e.setAttribute(k, String(v));
  if (tekstSadrzaj !== undefined) e.textContent = tekstSadrzaj;
  return e;
}

/** Element 5: isti crtež kao komponenta grafikona u verziji B (geometrija i boje iz src/zajednicko/). */
function crtajGrafikon(m: ModelGrafikona | null): void {
  dom.grafikon.hidden = m === null;
  if (!m) {
    dom.grafikonSvg.replaceChildren();
    return;
  }
  const { dim: D, g } = m;
  const dnoX = D.visina - D.dole;
  const svg = dom.grafikonSvg;
  svg.setAttribute("viewBox", `0 0 ${D.sirina} ${D.visina}`);
  svg.setAttribute("aria-label", m.opis);

  const deca: SVGElement[] = [];
  for (const o of g.oznakeY) {
    deca.push(svgEl("line", { x1: D.levo, x2: D.sirina - D.desno, y1: o.y, y2: o.y, stroke: "currentColor", "stroke-opacity": 0.15 }));
    deca.push(svgEl("text", { class: "osa", x: D.levo - 4, y: o.y + 3, "text-anchor": "end" }, o.tekst));
  }
  for (const o of g.oznakeX) {
    deca.push(svgEl("text", { class: "osa", x: o.x, y: dnoX + 14, "text-anchor": "middle" }, `${o.tekst}h`));
  }
  if (g.pm10) {
    deca.push(svgEl("path", { d: g.pm10, fill: "none", stroke: BOJA_PM10, "stroke-width": 2, "stroke-dasharray": "5 3" }));
  }
  if (g.pm25) deca.push(svgEl("path", { d: g.pm25, fill: "none", stroke: BOJA_PM25, "stroke-width": 2 }));
  svg.replaceChildren(...deca);
  dom.grafikonPotpis.textContent = m.potpis;
  dom.legPm25.style.setProperty("--b", BOJA_PM25);
  dom.legPm10.style.setProperty("--b", BOJA_PM10);
}

/** Popunjava izbor stanice; izabrana je ona koja se prikazuje. */
export function crtajStanice(stanice: StanicaZaIzbor[], izabrana: string | null): void {
  const lista = stanice.length > 0 || !izabrana ? stanice : [{ id: izabrana, naziv: izabrana }];
  dom.izbor.replaceChildren(
    ...lista.map((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.naziv;
      return o;
    }),
  );
  if (izabrana) dom.izbor.value = izabrana;
  dom.izbor.disabled = lista.length < 2;
}

/** Tokom poziva alata: sadržaj ostaje (bez skakanja visine), kontrole su onemogućene. */
export function crtajZauzeto(zauzeto: boolean, brojStanica: number): void {
  dom.koren.setAttribute("aria-busy", String(zauzeto));
  dom.osvezi.disabled = zauzeto;
  dom.pokusajPonovo.disabled = zauzeto;
  dom.izbor.disabled = zauzeto || brojStanica < 2;
  dom.osvezi.textContent = zauzeto ? "Osvežavanje…" : "Osveži";
}
