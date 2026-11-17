/** Javni API modula pravila (K2). Server uvozi samo odavde. */
import type { ProceniFn, SatneVrednostiFn } from "../tipovi.js";
import { proceni, satneVrednosti } from "./eaqi.js";

// Provera da implementacije odgovaraju dogovorenim potpisima iz tipovi.ts
const _proceni: ProceniFn = proceni;
const _satne: SatneVrednostiFn = satneVrednosti;
void _proceni;
void _satne;

export { podindeks, proceni, satneVrednosti } from "./eaqi.js";
export {
  EAQI_GORNJE_GRANICE,
  NAZIVI_KATEGORIJA,
  PODRAZUMEVANA_KONFIGURACIJA,
  type KonfiguracijaPravila,
  type PeriodUsrednjavanja,
} from "./pragovi.js";
