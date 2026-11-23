/**
 * WMO kodovi vremena (Open-Meteo `weather_code`) → opis na srpskom i ikona.
 * Čista funkcija, koriste je server (tekst za model) i dashboard (prikaz).
 */
export interface OpisVremena {
  opis: string;
  ikona: string;
}

const NEPOZNATO: OpisVremena = { opis: "nepoznato", ikona: "🌡️" };

export function opisVremena(kod: number | null): OpisVremena {
  if (kod === null) return NEPOZNATO;
  if (kod === 0) return { opis: "Vedro", ikona: "☀️" };
  if (kod === 1) return { opis: "Pretežno vedro", ikona: "🌤️" };
  if (kod === 2) return { opis: "Delimično oblačno", ikona: "⛅" };
  if (kod === 3) return { opis: "Oblačno", ikona: "☁️" };
  if (kod === 45 || kod === 48) return { opis: "Magla", ikona: "🌫️" };
  if (kod >= 51 && kod <= 57) return { opis: "Rosulja", ikona: "🌦️" };
  if (kod >= 61 && kod <= 67) return { opis: "Kiša", ikona: "🌧️" };
  if (kod >= 71 && kod <= 77) return { opis: "Sneg", ikona: "🌨️" };
  if (kod >= 80 && kod <= 82) return { opis: "Pljuskovi", ikona: "🌧️" };
  if (kod === 85 || kod === 86) return { opis: "Snežni pljuskovi", ikona: "🌨️" };
  if (kod >= 95) return { opis: "Grmljavina", ikona: "⛈️" };
  return NEPOZNATO;
}
