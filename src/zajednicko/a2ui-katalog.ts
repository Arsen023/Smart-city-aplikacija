/**
 * ID našeg A2UI kataloga (osnovni katalog v0.9 + KategorijaBadge + Grafikon24h), imena sopstvenih
 * komponenti i putanje podataka koje AI sme da veže. Zajedničko: koriste ga server (src/server/a2ui*.ts),
 * ekran B (src/ui-b/), renderer katalog (src/a2ui/) i chat (src/chat/), bez zavisnosti jedno od drugog.
 */
export const KATALOG_ID = "https://smart-city.local/a2ui/katalozi/kvalitet-vazduha/v1.json";

/** Imena sopstvenih komponenti – isti string na serveru i u ekranu. */
export const KOMPONENTA_KATEGORIJA = "KategorijaBadge";
export const KOMPONENTA_GRAFIKON = "Grafikon24h";

/**
 * Putanje u data modelu (PodaciEkrana iz src/server/a2ui.ts) koje AI sme da prikaže preko `path`,
 * sa opisom za prompt. Vrednosti uvek dolaze sa servera – AI ih samo vezuje (pravila 1 i 7).
 */
export const PUTANJE_PODATAKA: Record<string, string> = {
  "/stanica": "naziv stanice",
  "/pm25Broj": "vrednost PM2.5 (broj ili „nije dostupno“)",
  "/pm25Jedinica": "jedinica za PM2.5 (µg/m³)",
  "/pm10Broj": "vrednost PM10 (broj ili „nije dostupno“)",
  "/pm10Jedinica": "jedinica za PM10 (µg/m³)",
  "/pm25": "PM2.5 sa nazivom i jedinicom u jednom tekstu",
  "/pm10": "PM10 sa nazivom i jedinicom u jednom tekstu",
  "/vreme": "vreme merenja i koliko je prošlo",
  "/napomena": "napomena kad neka veličina nije dostupna",
  "/savet": "savet za šetnju i trening (uz njega uvek ide i /osnov)",
  "/osnov": "na čemu se savet zasniva",
  "/pravilo": "pravilo po kome je izračunata kategorija",
};

/** Putanje koje koriste samo sopstvene komponente (značka, grafikon) – AI ih ne piše u Text. */
export const PUTANJE_KOMPONENTI = ["/kategorija/naziv", "/kategorija/nivo", "/istorija"] as const;
