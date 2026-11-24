/**
 * Katalog za izvorni A2UI u chatu: naš osnovni katalog (KategorijaBadge, Grafikon24h) + komponente za
 * podatke iz baze – GrafikonNiz (vreme, voda), PrognozaSati i MapaSenzora (Leaflet).
 * Isti ID kataloga; ekran verzije B kao MCP App (src/ui-b/) i dalje koristi samo src/a2ui/katalog.ts,
 * da bi ostao bez Leaflet-a i spoljnih domena u CSP-u.
 */
import { Catalog } from "@a2ui/web_core/v0_9";
import { KATALOG_ID } from "../zajednicko/a2ui-katalog.js";
import { katalog } from "./katalog.js";
import { MapaSenzora } from "./komponente/mapa.js";
import { GrafikonNiz } from "./komponente/niz.js";
import { PrognozaSati } from "./komponente/prognoza.js";

export const katalogChata = new Catalog(
  KATALOG_ID,
  "0.9",
  [...katalog.components.values(), GrafikonNiz, PrognozaSati, MapaSenzora],
  [...katalog.functions.values()],
);
