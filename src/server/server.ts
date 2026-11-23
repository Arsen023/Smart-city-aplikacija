import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrujA2ui } from "./a2ui-alati.js";
import { registrujAlate, type DobijZavisnosti } from "./alati.js";
import {
  napraviBazuVazduhaIVremena,
  poveziBazu,
  poveziVezu,
  type BazaVazduhaIVremena,
  type BazaVode,
} from "../core/baza/index.js";
import { registrujAlateDashboarda, type DobijBazuVV } from "./dashboard-alati.js";
import { registrujAlateVode, type DobijBazu } from "./voda-alati.js";
import { zavisnostiIzOkruzenja, type ZavisnostiProcene } from "./procena.js";

/**
 * Zavisnosti (K1 izvor, sat, K3) se prave jednom po procesu, pri prvom pozivu alata.
 * Ako podešavanje ne valja (npr. EKONET_IZVOR=api pre T01), alati vraćaju status
 * "error" sa porukom, a server i dalje radi.
 */
let zavisnosti: Promise<ZavisnostiProcene> | undefined;
const dobijZavisnosti: DobijZavisnosti = () => (zavisnosti ??= zavisnostiIzOkruzenja());

/** Veza sa bazom (pool) – jedna po procesu, pri prvom pozivu alata za vodu. Neuspeh se ne pamti. */
let baza: Promise<BazaVode> | undefined;
const dobijBazu: DobijBazu = () =>
  (baza ??= poveziBazu().catch((e: unknown) => {
    baza = undefined;
    throw e;
  }));

/** Vazduh i vreme iz baze (db/03-vazduh-vreme.sql) – za dashboard i get_weather. Neuspeh se ne pamti. */
let bazaVV: Promise<BazaVazduhaIVremena> | undefined;
const dobijBazuVV: DobijBazuVV = () =>
  (bazaVV ??= poveziVezu()
    .then((veza) => napraviBazuVazduhaIVremena(veza.izvrsi))
    .catch((e: unknown) => {
      bazaVV = undefined;
      throw e;
    }));

/**
 * Pravi novu instancu MCP servera sa svim alatima i ui:// resursima.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "Smart City – kvalitet vazduha",
    version: "1.0.0",
  });

  // Verzija A i zajednički alati: get_stations, get_latest, get_history, assess_air_quality (Sara, T09)
  registrujAlate(server, dobijZavisnosti);

  // Verzija B (A2UI) – isti tok i zavisnosti kao verzija A; registracija je u a2ui-alati.ts (Luka)
  registrujA2ui(server, dobijZavisnosti);

  // Kvalitet vode iz PostgreSQL baze (FishNET, db/): get_water_devices, get_water_latest, get_water_history (Sara)
  registrujAlateVode(server, dobijBazu);

  // Dashboard (sve u jednom pozivu) i vreme iz baze: get_dashboard, get_weather (Luka)
  registrujAlateDashboarda(server, dobijZavisnosti, dobijBazuVV, dobijBazu);

  return server;
}
