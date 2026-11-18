# CLAUDE.md – Smart-city-aplikacija

Prototip koji za izabranu mernu stanicu preuzima merenja sa DunavNET platforme ekoNET/enviroNET
i odgovara na pitanje: „Da li je sada dobro vreme za šetnju ili trening napolju?“

Dve verzije istog scenarija, sa ISTIM izvorom podataka i ISTOM logikom preporuke:
- **Verzija A:** MCP App, interfejs u HTML/TypeScript (`src/ui-a/`)
- **Verzija B:** MCP App čiji se interfejs crta pomoću A2UI (`src/ui-b/`)

Specifikacija: https://claude.ai/artifact/1QxTUCGoYPhrSPBfhNPu3L
Podela rada i git pravila: `docs/PODELA-RADA.md`
Tim: Sara Živanović, Luka. Mentor: Srđan Krčo.

## Komande

```bash
npm install          # zavisnosti
npm start            # samo MCP server na http://localhost:3001/mcp (ekrani iz dist/, prvo npm run build)
npm run build        # typecheck + build ekrana A i B (dist/ui-a, dist/ui-b) i chat aplikacije (dist/chat, dist/chat-sandbox)
npm run chat         # chat aplikacija na http://localhost:3010 (treba i npm start; Groq ključ iz .env)
npm test             # testovi (node --test + tsx), fajlovi *.test.ts
npm run dev          # watch build ekrana + server (razvoj)
npm run typecheck    # tsc bez emitovanja
```

Ako neka od ovih skripti još ne postoji u `package.json`, reci to i predloži da se doda; ne preskači proveru ćutke.

Chat aplikacija (demo): `npm start` u jednom terminalu, `npm run chat` u drugom → http://localhost:3010.
Prekidač „Verzija A / B“ bira ekran; `?mcp=http://localhost:3002/mcp` bira drugi MCP server (npr. drugi scenario),
`?verzija=B` otvara odmah verziju B.

Test host za razvoj (u drugom terminalu, iz kloniranog ext-apps repoa, van ovog projekta):
`cd ext-apps/examples/basic-host && npm start` → http://localhost:8080

Razvojno okruženje je Windows + PowerShell. Komande koje predlažeš moraju da rade u PowerShell-u.

## Arhitektura

| Komponenta | Folder | Vlasnik | Odgovornost |
|---|---|---|---|
| Zajednički tipovi | `src/core/tipovi.ts` | zajedno | `Rezultat` i ostali tipovi koje dele sve komponente |
| K1 ekoNET klijent | `src/core/ekonet/` | Sara | Poziva API, vraća normalizovane podatke (stanica, veličina, vrednost, jedinica, vreme) |
| K2 Modul pravila | `src/core/pravila/` | Luka | EAQI kategorija i provera svežine. Deterministički, bez LLM-a |
| K3 LLM korak | `src/core/llm/` | Luka | Iz rezultata K2 pravi kratak savet na srpskom i osnov saveta |
| K4 MCP server | `src/server/` | Sara | Registruje alate i `ui://` resurse, koristi K1–K3 |
| A2UI poruke | `src/server/a2ui.ts` | Luka | Pretvara `Rezultat` u A2UI poruke za verziju B |
| Prikaz A | `src/ui-a/` | Sara | `ui://` HTML/TS ekran |
| Prikaz B | `src/ui-b/` | Luka | A2UI renderer unutar MCP App-a |
| Zajedničko za prikaze | `src/zajednicko/` | zajedno | EAQI boje (`boje-eaqi.ts`), ID A2UI kataloga i imena komponenti (`a2ui-katalog.ts`) |
| Chat aplikacija (naš MCP host) | `src/chat/` | Luka | Chat sa Groq-om (`server.ts`, port 3010), stranica sa prekidačem A/B (`ui/`), sandbox za ekrane (`sandbox/`, port 3011). Ne računa ništa: alate poziva na MCP serveru |
| Pokretanje | `main.ts` | Sara | HTTP MCP server na portu 3001 |
| Test podaci | `fixtures/` | zajedno | Snimljeni ili izmišljeni odgovori API-ja za testove i demo režim |
| Dokumentacija | `docs/` | zajedno | `PODELA-RADA.md`, Stitch procena, beleške |

Pravila zavisnosti:
- `src/ui-a/` i `src/ui-b/` nikad ne uvoze jedno iz drugog. Zavise samo od `src/core/tipovi.ts` i `src/zajednicko/`.
- Prikazi smeju da uvoze i `src/core/vreme.ts` (čiste funkcije, bez I/O-a).
- `src/server/` ne uvozi ništa iz `src/ui-*` (zajedničke konstante idu u `src/zajednicko/`).
- `src/zajednicko/` sadrži samo konstante i čiste funkcije bez DOM-a i I/O-a; ne uvozi iz `src/server/` ni `src/ui-*`.
- `src/core/` ne uvozi ništa iz `src/server/` ni iz `src/ui-*`.
- `src/core/pravila/` nema I/O (bez mreže, fajlova i `Date.now()`; vreme dobija kao parametar).
- `src/chat/` ne uvozi iz `src/core/`, `src/server/` ni `src/ui-*`: sa serverom razgovara samo preko MCP-a,
  kao bilo koji host. Chat model ne računa kategoriju – prepričava rezultat alata (pravila 1 i 7).

Dogovoreni potpisi (menjaju se samo uz dogovor):

```ts
// src/core/ekonet (Sara)
getStations(): Promise<Stanica[]>
getLatest(stationId: string): Promise<Merenje[]>
getHistory(stationId: string, hours?: number): Promise<Merenje[]>   // sirova merenja; satne vrednosti pravi K2

// src/core/pravila (Luka)
proceni(merenja: Merenje[], sada: Date): ProcenaPravila
satneVrednosti(merenja: Merenje[]): SatnaVrednost[]   // za grafikon
// status ok | stale | no_data, kategorija, određujuća veličina, opis pravila

// src/core/llm (Luka)
napraviSavet(rezultat: Omit<Rezultat, "advice" | "history">): Promise<Savet | null>
// izvor istine za potpise: tipovi EkonetKlijent, ProceniFn, SatneVrednostiFn, NapraviSavetFn u src/core/tipovi.ts
// null ako LLM nije dostupan ili izlaz ne prođe proveru
```

Tok: alat `assess_air_quality` → K1 preuzme merenja → K2 proveri svežinu i izračuna kategoriju →
K3 (samo ako je status `ok`) napiše savet → server vraća kratak tekst u `content` i ceo rezultat
u `structuredContent` → prikaz A ili B ga iscrtava.

MCP alati: `get_stations`, `get_latest`, `get_history`, `assess_air_quality`.
`status` je uvek jedno od: `ok`, `stale`, `no_data`, `error`.

## Pravila koja se ne krše

1. **Kategoriju kvaliteta vazduha NIKAD ne računa LLM.** Računa je samo `src/core/pravila/`.
2. **Ako su podaci zastareli ili ih nema, nema preporuke:** `category` i `advice` su `null`,
   LLM se ne poziva, korisnik dobija jasnu poruku sa vremenom poslednjeg merenja.
3. **`src/core/tipovi.ts` (tip `Rezultat` i ostali) i dogovoreni potpisi se ne menjaju bez dogovora Sare i Luke.**
   Ako zadatak traži izmenu, stani i pitaj.
4. **Obe verzije koriste iste module K1–K3.** Nikakvo dupliranje logike u `src/ui-a/` ili `src/ui-b/`.
   Prikazi samo crtaju ono što server vrati.
5. **Nedostajuća veličina se prikazuje kao „nije dostupno“, nikad kao 0.**
6. **Pragove EAQI ne izmišljaj.** Uzimaju se iz zvanične EEA tabele i stoje u jednoj
   konfiguraciji u `src/core/pravila/`. Ako nisu upisani, ostavi TODO i reci to.
7. **LLM ne sme da izmišlja brojeve ni da menja kategoriju.** Izlaz LLM-a je JSON
   `{ "savet": string, "osnov": string }` i server ga proverava pre prikaza.

## Stil koda

- TypeScript `strict`, ESM moduli. Bez `any`. Gde tip nije poznat, koristi `unknown` i Zod.
- Ulaz alata i odgovori spoljnih API-ja se uvek proveravaju Zod šemom.
- Male, čiste funkcije. Logika (`src/core/pravila/`) bez I/O-a, da bi se lako testirala.
- Vreme je uvek ISO 8601 sa zonom Europe/Belgrade. Prikaz: `16.11.2026. 09:00`.
- Tekst za korisnika je na srpskom, latinicom. Domen u kodu je na srpskom bez dijakritika (`tipovi`, `pravila`, `proceni`, `Merenje`), a MCP alati i funkcije ekoNET klijenta na engleskom (`assess_air_quality`, `getLatest`). Novo ime prati taj obrazac.
- Bez novih zavisnosti bez razloga. Ako dodaješ paket, objasni zašto.
- Biblioteke za ekran (npr. Chart.js) idu kroz Vite build, ne preko CDN linka (CSP u iframe-u).

## Testovi

- Svaka funkcija u `src/core/pravila/` ima test (`node --test`), uključujući granice svake kategorije
  i statuse `stale`, `no_data`, i slučaj kad postoji samo PM2.5 ili samo PM10.
- Testovi koriste podatke iz `fixtures/`, nikad pravi API ni pravi LLM.
- Testovi stoje pored koda: `proceni.ts` → `proceni.test.ts`.
- Pre nego što kažeš da je zadatak gotov: `npm run typecheck`, `npm test` i `npm run build` moraju da prođu.

## Git

- Nikad direktno na `main`. Grana po zadatku: `sara/<opis>` ili `luka/<opis>`. Grana živi 2–3 dana.
- Commit poruke kratko, na srpskom, sa ID-jem zadatka, npr. `T07: provera svezine podataka`.
- Pre dodira zajedničkih fajlova (`src/core/tipovi.ts`, `src/server/server.ts`, `package.json`) javi drugom.
- Spajanje samo preko Pull Request-a, posle zelenog CI-ja i pregleda drugog člana tima.
- Ne commit-uj `.env`, `node_modules/`, `dist/`, `ext-apps/`, generisane `main.js` i `server.js`.

## Bezbednost

- Ključevi (ekoNET, LLM) su samo u `.env`. U repou je `.env.example` sa imenima promenljivih, bez vrednosti.
- Ključeve nikad ne loguj i ne šalji u `structuredContent` ni u prompt.
- `ui://` resurs deklariše CSP sa najmanjim potrebnim domenima.

## Otvoreno (ne pretpostavljaj, pitaj)

- Pravi URL i autentifikacija ekoNET API-ja (do tada radimo sa `src/fixtures/`).
- Prag svežine (predlog 2 h) i period usrednjavanja (predlog: satne vrednosti, EAQI 2024).
- Koji LLM koristimo za K3 (predlog: Gemini besplatni nivo).
- Verzija A2UI kataloga (v0.9 ili v1.0).
