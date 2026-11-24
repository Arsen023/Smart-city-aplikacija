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

// ─── Podaci iz baze za izvorni A2UI u chatu (get_dashboard → a2ui) ─────────

/** Sopstvene komponente za podatke iz baze (vreme, voda, mapa) – samo u chatu (verzija B). */
export const KOMPONENTA_NIZ = "GrafikonNiz";
export const KOMPONENTA_PROGNOZA = "PrognozaSati";
export const KOMPONENTA_MAPA = "MapaSenzora";

/** Tekstualne putanje iz get_dashboard (src/server/dashboard-a2ui.ts) koje AI sme da veže u Text. */
export const PUTANJE_DASHBOARDA: Record<string, string> = {
  "/meteo/temperatura": "trenutna temperatura vazduha (npr. „5,3 °C“)",
  "/meteo/opis": "opis vremena (npr. „Oblačno“)",
  "/meteo/ikona": "ikona vremena (emodži)",
  "/meteo/vlaznost": "relativna vlažnost vazduha",
  "/meteo/vetar": "brzina vetra",
  "/meteo/padavine": "padavine u poslednjem satu",
  "/meteo/vremeMerenja": "kada je izmereno vreme i izvor",
  "/voda/uredjaj": "naziv uređaja za kvalitet vode",
  "/voda/kiseonik": "rastvoreni kiseonik u vodi",
  "/voda/zasicenje": "zasićenje vode kiseonikom",
  "/voda/ph": "pH vode",
  "/voda/temperatura": "temperatura vode",
  "/voda/vremeMerenja": "kada je poslednji put merena voda",
  "/senzoriOpis": "koliko senzora je na mapi i odakle su",
};

/** Nizovi iz get_dashboard – vezuju ih samo sopstvene komponente (GrafikonNiz, PrognozaSati, MapaSenzora). */
export const PUTANJE_DASHBOARD_KOMPONENTI: Record<string, string> = {
  "/meteo/prognoza": `prognoza za naredne sate – ${"PrognozaSati"}(sati=…)`,
  "/meteo/temperatura24h": `temperatura vazduha za 24 h – ${"GrafikonNiz"}(tacke=…, jedinica="°C")`,
  "/meteo/vlaznost24h": `vlažnost vazduha za 24 h – ${"GrafikonNiz"}(tacke=…, jedinica="%")`,
  "/voda/kiseonik24h": `kiseonik u vodi kroz vreme – ${"GrafikonNiz"}(tacke=…, jedinica="mg/L")`,
  "/voda/ph24h": `pH vode kroz vreme – ${"GrafikonNiz"}(tacke=…, jedinica="pH")`,
  "/voda/temperatura24h": `temperatura vode kroz vreme – ${"GrafikonNiz"}(tacke=…, jedinica="°C")`,
  "/senzori": `senzori kvaliteta vazduha sa koordinatama – ${"MapaSenzora"}(tacke=…)`,
};

/** Jedna tačka za GrafikonNiz: oznaka na x osi (npr. "14:00") i vrednost (`null` = nema merenja). */
export interface TackaNiza {
  oznaka: string;
  vrednost: number | null;
}

/** Jedan sat prognoze za PrognozaSati. */
export interface SatPrognoze {
  sat: string;
  ikona: string;
  temperatura: string;
  opis: string;
}

/** Jedan senzor za MapaSenzora. */
export interface TackaMape {
  naziv: string;
  lat: number;
  lon: number;
  /** EAQI nivo (1–6) ili `null` kad nema procene. */
  nivo: number | null;
  kategorija: string;
  opis: string;
  model: boolean;
}
