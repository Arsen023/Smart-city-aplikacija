Smart-city-aplikacija
Prototip koji za izabranu mernu stanicu preuzima merenja sa DunavNET platforme ekoNET/enviroNET i odgovara na pitanje: „Da li je sada dobro vreme za šetnju ili trening napolju?“

Dve verzije istog scenarija, sa ISTIM izvorom podataka i ISTOM logikom preporuke:

Verzija A: MCP App, interfejs u HTML/TypeScript (app-a/)
Verzija B: MCP App čiji se interfejs crta pomoću A2UI (app-b/)
Specifikacija: https://claude.ai/artifact/1QxTUCGoYPhrSPBfhNPu3L Tim: Sara Živanović, Luka. Mentor: Srđan Krčo.

Komande
npm install          # zavisnosti
npm start            # build ekrana u watch modu + MCP server na http://localhost:3001/mcp
npm run build        # produkcijski build
npm test             # Vitest testovi
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc bez emitovanja
Test host (u drugom terminalu, iz kloniranog ext-apps repoa, van ovog projekta): cd ext-apps/examples/basic-host && npm start → http://localhost:8080

Razvojno okruženje je Windows + PowerShell. Komande koje predlažeš moraju da rade u PowerShell-u.

Arhitektura
Komponenta	Folder	Odgovornost
K1 ekoNET klijent	src/ekonet/	Poziva API, vraća normalizovane podatke (stanica, veličina, vrednost, jedinica, vreme)
K2 Modul pravila	src/rules/	EAQI kategorija i provera svežine. Deterministički, bez LLM-a
K3 LLM korak	src/llm/	Iz rezultata K2 pravi kratak savet na srpskom i osnov saveta
K4 MCP server	server.ts	Registruje alate i ui:// resurse, koristi K1–K3
Prikaz A	app-a/	ui:// HTML/TS ekran
Prikaz B	app-b/	A2UI renderer unutar MCP App-a
Zajednički tipovi	src/types.ts	AirQualityResult i ostali tipovi koje dele sve komponente
Test podaci	src/fixtures/	Snimljeni ili izmišljeni odgovori API-ja za testove i demo režim
Tok: alat assess_air_quality → K1 preuzme merenja → K2 proveri svežinu i izračuna kategoriju → K3 (samo ako je status ok) napiše savet → server vraća kratak tekst u content i ceo rezultat u structuredContent → prikaz A ili B ga iscrtava.

MCP alati: get_stations, get_latest, get_history, assess_air_quality. status je uvek jedno od: ok, stale, no_data, error.

Pravila koja se ne krše
Kategoriju kvaliteta vazduha NIKAD ne računa LLM. Računa je samo src/rules/.
Ako su podaci zastareli ili ih nema, nema preporuke: category i advice su null, LLM se ne poziva, korisnik dobija jasnu poruku sa vremenom poslednjeg merenja.
Tip AirQualityResult u src/types.ts se ne menja bez dogovora Sare i Luke. Ako zadatak traži izmenu tipa, stani i pitaj.
Obe verzije koriste iste module K1–K3. Nikakvo dupliranje logike u app-a/ ili app-b/. Prikazi samo crtaju ono što server vrati.
Nedostajuća veličina se prikazuje kao „nije dostupno“, nikad kao 0.
Pragove EAQI ne izmišljaj. Uzimaju se iz zvanične EEA tabele i stoje u jednoj konfiguraciji u src/rules/. Ako nisu upisani, ostavi TODO i reci to.
LLM ne sme da izmišlja brojeve ni da menja kategoriju. Izlaz LLM-a je JSON { "savet": string, "osnov": string } i server ga proverava pre prikaza.
Stil koda
TypeScript strict, ESM moduli. Bez any. Gde tip nije poznat, koristi unknown i Zod.
Ulaz alata i odgovori spoljnih API-ja se uvek proveravaju Zod šemom.
Male, čiste funkcije. Logika (src/rules/) bez I/O-a, da bi se lako testirala.
Vreme je uvek ISO 8601 sa zonom Europe/Belgrade. Prikaz: 16.11.2026. 09:00.
Tekst za korisnika je na srpskom, latinicom. Imena u kodu na engleskom.
Bez novih zavisnosti bez razloga. Ako dodaješ paket, objasni zašto.
Biblioteke za ekran (npr. Chart.js) idu kroz Vite build, ne preko CDN linka (CSP u iframe-u).
Testovi
Svaka funkcija u src/rules/ ima Vitest test, uključujući granice svake kategorije i statuse stale, no_data, i slučaj kad postoji samo PM2.5 ili samo PM10.
Testovi koriste podatke iz src/fixtures/, nikad pravi API ni pravi LLM.
Pre nego što kažeš da je zadatak gotov: npm run typecheck, npm run lint i npm test moraju da prođu.
Git
Nikad direktno na main. Grana po zadatku: sara/<opis> ili luka/<opis>.
Commit poruke kratko, na srpskom, npr. K2: provera svezine podataka.
Spajanje samo preko Pull Request-a, posle zelenog CI-ja i pregleda drugog člana tima.
Ne commit-uj .env, node_modules/, dist/, ext-apps/, generisane main.js i server.js.
Bezbednost
Ključevi (ekoNET, LLM) su samo u .env. U repou je .env.example sa imenima promenljivih, bez vrednosti.
Ključeve nikad ne loguj i ne šalji u structuredContent ni u prompt.
ui:// resurs deklariše CSP sa najmanjim potrebnim domenima.
Otvoreno (ne pretpostavljaj, pitaj)
Pravi URL i autentifikacija ekoNET API-ja (do tada radimo sa src/fixtures/).
Prag svežine (predlog 2 h) i period usrednjavanja (predlog: satne vrednosti, EAQI 2024).
Koji LLM koristimo za K3 (predlog: Gemini besplatni nivo).
Verzija A2UI kataloga (v0.9 ili v1.0).