/**
 * Javni izvori za vreme i kvalitet vazduha → redovi za bazu (db/03-vazduh-vreme.sql).
 * Čiste funkcije, bez mreže: dobijaju već preuzet JSON i trenutak `sada`, pa se testiraju na fixtures/izvori/.
 *
 * - Open-Meteo (vreme): satno, model; prošli sati i prognoza.
 * - Open-Meteo (vazduh): model CAMS, PM2.5, PM10, NO2, O3 i EAQI koji računa izvor.
 * - Sensor.Community: stvarni senzori građana (PM sa SDS011/PMS…, temperatura i vlažnost sa BME280…).
 *
 * Vrednost koje nema ostaje `null`, nikad 0. Kategoriju kvaliteta vazduha i dalje računa samo src/core/pravila.
 */
import { z } from "zod";

export type IzvorPodataka = "open-meteo" | "sensor-community";
export type TipUredjaja = "kvalitet vazduha" | "vreme";

export interface NoviUredjaj {
  id: string;
  naziv: string;
  tip: TipUredjaja;
  izvor: IzvorPodataka;
  lokacija: string | null;
  lat: number;
  lon: number;
}

export interface RedVazduha {
  uredjajId: string;
  vreme: Date;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  eaqiIzvor: number | null;
  prognoza: boolean;
}

export interface RedVremena {
  uredjajId: string;
  vreme: Date;
  temperaturaC: number | null;
  vlaznostProc: number | null;
  vetarKmh: number | null;
  padavineMm: number | null;
  vremeKod: number | null;
  prognoza: boolean;
}

/** Sve što jedan izvor donese u jednom uvozu. */
export interface PaketUvoza {
  uredjaji: NoviUredjaj[];
  vazduh: RedVazduha[];
  vreme: RedVremena[];
}

/** Mesto za koje se preuzimaju podaci. */
export interface Lokacija {
  /** Kratka oznaka za id uređaja, npr. "ns". */
  oznaka: string;
  naziv: string;
  lat: number;
  lon: number;
  /** Poluprečnik za senzore Sensor.Community, km. */
  radiusKm: number;
}

export const NOVI_SAD: Lokacija = { oznaka: "ns", naziv: "Novi Sad", lat: 45.25, lon: 19.84, radiusKm: 5 };

// ---------- adrese ----------

const SATI_UNAZAD = 24;
const SATI_UNAPRED = 48;

export function adresaOpenMeteoVreme(l: Lokacija): string {
  const p = new URLSearchParams({
    latitude: String(l.lat),
    longitude: String(l.lon),
    hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
    past_hours: String(SATI_UNAZAD),
    forecast_hours: String(SATI_UNAPRED),
    timezone: "UTC",
    timeformat: "unixtime",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

export function adresaOpenMeteoVazduh(l: Lokacija): string {
  const p = new URLSearchParams({
    latitude: String(l.lat),
    longitude: String(l.lon),
    hourly: "pm10,pm2_5,nitrogen_dioxide,ozone,european_aqi",
    past_hours: String(SATI_UNAZAD),
    forecast_hours: String(SATI_UNAPRED),
    timezone: "UTC",
    timeformat: "unixtime",
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${p}`;
}

export function adresaSensorCommunity(l: Lokacija): string {
  return `https://data.sensor.community/airrohr/v1/filter/area=${l.lat},${l.lon},${l.radiusKm}`;
}

// ---------- pomoćne ----------

/** Broj ili `null`; tekst "7.00" postaje 7, a nebroj, prazno i negativno (greška senzora) postaju `null`. */
function broj(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Celobrojni kod (WMO, EAQI) ili `null`. */
function ceoBroj(v: unknown): number | null {
  const n = broj(v);
  return n === null ? null : Math.round(n);
}

export class GreskaIzvora extends Error {
  constructor(izvor: string, options?: ErrorOptions) {
    super(`Odgovor izvora „${izvor}“ nije očekivanog oblika.`, options);
    this.name = "GreskaIzvora";
  }
}

function proveri<T>(sema: z.ZodType<T>, json: unknown, izvor: string): T {
  const r = sema.safeParse(json);
  if (!r.success) throw new GreskaIzvora(izvor, { cause: r.error });
  return r.data;
}

const niz = z.array(z.union([z.number(), z.null()]));

// ---------- Open-Meteo ----------

const OpenMeteoVreme = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z.object({
    time: z.array(z.number()),
    temperature_2m: niz,
    relative_humidity_2m: niz,
    wind_speed_10m: niz,
    precipitation: niz,
    weather_code: niz,
  }),
});

const OpenMeteoVazduh = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z.object({
    time: z.array(z.number()),
    pm10: niz,
    pm2_5: niz,
    nitrogen_dioxide: niz,
    ozone: niz,
    european_aqi: niz,
  }),
});

export function izOpenMeteoVremena(json: unknown, l: Lokacija, sada: Date): PaketUvoza {
  const d = proveri(OpenMeteoVreme, json, "Open-Meteo vreme");
  const id = `open-meteo-vreme-${l.oznaka}`;
  const h = d.hourly;
  const vreme = h.time
    .map((t, i): RedVremena => {
      const vremeMerenja = new Date(t * 1000);
      return {
        uredjajId: id,
        vreme: vremeMerenja,
        temperaturaC: h.temperature_2m[i] ?? null,
        vlaznostProc: broj(h.relative_humidity_2m[i]),
        vetarKmh: broj(h.wind_speed_10m[i]),
        padavineMm: broj(h.precipitation[i]),
        vremeKod: ceoBroj(h.weather_code[i]),
        prognoza: vremeMerenja.getTime() > sada.getTime(),
      };
    })
    .filter(imaVrednostVremena);
  return {
    uredjaji: [
      { id, naziv: `Open-Meteo vreme – ${l.naziv}`, tip: "vreme", izvor: "open-meteo", lokacija: `${l.naziv} (model)`, lat: d.latitude, lon: d.longitude },
    ],
    vazduh: [],
    vreme,
  };
}

export function izOpenMeteoVazduha(json: unknown, l: Lokacija, sada: Date): PaketUvoza {
  const d = proveri(OpenMeteoVazduh, json, "Open-Meteo vazduh");
  const id = `open-meteo-vazduh-${l.oznaka}`;
  const h = d.hourly;
  const vazduh = h.time
    .map((t, i): RedVazduha => {
      const vremeMerenja = new Date(t * 1000);
      return {
        uredjajId: id,
        vreme: vremeMerenja,
        pm25: broj(h.pm2_5[i]),
        pm10: broj(h.pm10[i]),
        no2: broj(h.nitrogen_dioxide[i]),
        o3: broj(h.ozone[i]),
        eaqiIzvor: ceoBroj(h.european_aqi[i]),
        prognoza: vremeMerenja.getTime() > sada.getTime(),
      };
    })
    .filter(imaVrednostVazduha);
  return {
    uredjaji: [
      { id, naziv: `Open-Meteo vazduh – ${l.naziv}`, tip: "kvalitet vazduha", izvor: "open-meteo", lokacija: `${l.naziv} (model CAMS)`, lat: d.latitude, lon: d.longitude },
    ],
    vazduh,
    vreme: [],
  };
}

// ---------- Sensor.Community ----------

const SensorCommunity = z.array(
  z.object({
    timestamp: z.string(),
    location: z.object({
      latitude: z.union([z.string(), z.number()]),
      longitude: z.union([z.string(), z.number()]),
      indoor: z.union([z.number(), z.boolean()]).optional(),
    }),
    sensor: z.object({
      id: z.number(),
      sensor_type: z.object({ name: z.string() }),
    }),
    sensordatavalues: z.array(z.object({ value_type: z.string(), value: z.union([z.string(), z.number(), z.null()]) })),
  }),
);

/** "2026-11-23 09:56:49" je UTC (Sensor.Community API). */
function vremeSensorCommunity(s: string): Date | null {
  const d = new Date(`${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Senzori u krugu oko lokacije. Svaki senzor je poseban uređaj (`sc-<id>`).
 * P1 = PM10, P2 = PM2.5 (P0 = PM1 se ne čuva); temperature/humidity idu u vreme.
 * Senzori u zatvorenom prostoru (indoor) se preskaču – ne govore ništa o vazduhu napolju.
 */
export function izSensorCommunity(json: unknown, l: Lokacija, sada: Date): PaketUvoza {
  const zapisi = proveri(SensorCommunity, json, "Sensor.Community");
  const uredjaji = new Map<string, NoviUredjaj>();
  const vazduh: RedVazduha[] = [];
  const vreme: RedVremena[] = [];

  for (const zapis of zapisi) {
    if (zapis.location.indoor === 1 || zapis.location.indoor === true) continue;
    const t = vremeSensorCommunity(zapis.timestamp);
    const lat = broj(zapis.location.latitude);
    const lon = broj(zapis.location.longitude);
    if (t === null || lat === null || lon === null) continue;

    const v = new Map(zapis.sensordatavalues.map((x) => [x.value_type, x.value]));
    const id = `sc-${zapis.sensor.id}`;
    const prognoza = t.getTime() > sada.getTime();
    const tip = zapis.sensor.sensor_type.name;

    const redVazduha: RedVazduha = {
      uredjajId: id, vreme: t, pm25: broj(v.get("P2")), pm10: broj(v.get("P1")), no2: null, o3: null, eaqiIzvor: null, prognoza,
    };
    const temperatura = v.get("temperature");
    const redVremena: RedVremena = {
      uredjajId: id,
      vreme: t,
      // temperatura sme biti negativna, pa ne ide kroz broj()
      temperaturaC: temperatura === undefined || temperatura === null || temperatura === "" ? null : finiteIliNull(Number(temperatura)),
      vlaznostProc: uOpsegu(broj(v.get("humidity")), 0, 100),
      vetarKmh: null,
      padavineMm: null,
      vremeKod: null,
      prognoza,
    };

    let tipUredjaja: TipUredjaja | null = null;
    if (imaVrednostVazduha(redVazduha)) {
      vazduh.push(redVazduha);
      tipUredjaja = "kvalitet vazduha";
    } else if (imaVrednostVremena(redVremena)) {
      vreme.push(redVremena);
      tipUredjaja = "vreme";
    }
    if (tipUredjaja && !uredjaji.has(id)) {
      uredjaji.set(id, {
        id,
        naziv: `Sensor.Community ${tip} #${zapis.sensor.id}`,
        tip: tipUredjaja,
        izvor: "sensor-community",
        lokacija: l.naziv,
        lat,
        lon,
      });
    }
  }
  return { uredjaji: [...uredjaji.values()], vazduh, vreme };
}

function finiteIliNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

function uOpsegu(n: number | null, od: number, doV: number): number | null {
  return n !== null && n >= od && n <= doV ? n : null;
}

function imaVrednostVazduha(r: RedVazduha): boolean {
  return [r.pm25, r.pm10, r.no2, r.o3].some((x) => x !== null);
}

function imaVrednostVremena(r: RedVremena): boolean {
  return [r.temperaturaC, r.vlaznostProc, r.vetarKmh, r.padavineMm, r.vremeKod].some((x) => x !== null);
}
