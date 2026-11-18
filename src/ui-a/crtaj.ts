/**
 * Upisuje ModelEkrana u DOM. Samo textContent i hidden – podaci nikad ne idu kroz innerHTML.
 */
import type { ModelEkrana } from "./prikaz.js";
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
