-- Šema za kvalitet vazduha i vreme iz javnih izvora (Open-Meteo, Sensor.Community).
-- Pokreće se posle 01-sema.sql. Ponovno pokretanje ne briše podatke.
-- Podatke upisuje `npm run baza:uvoz` (src/core/baza/uvoz/), ne ovaj fajl.

-- Uređaj dobija izvor i koordinate (za mapu). Postojeći FishNET uređaj ostaje isti.
ALTER TABLE uredjaj ADD COLUMN IF NOT EXISTS izvor text;          -- 'fishnet' | 'open-meteo' | 'sensor-community'
ALTER TABLE uredjaj ADD COLUMN IF NOT EXISTS lat   numeric(8,5);  -- geografska širina
ALTER TABLE uredjaj ADD COLUMN IF NOT EXISTS lon   numeric(8,5);  -- geografska dužina

UPDATE uredjaj SET izvor = 'fishnet' WHERE id LIKE 'fishnet-%' AND izvor IS NULL;

-- Kvalitet vazduha, µg/m³. Vrednost koja nije izmerena je NULL, nikad 0.
CREATE TABLE IF NOT EXISTS merenje_vazduha (
    id          bigserial PRIMARY KEY,
    uredjaj_id  text NOT NULL REFERENCES uredjaj(id),
    vreme       timestamptz NOT NULL,
    pm25        numeric(7,2),             -- PM2.5
    pm10        numeric(7,2),             -- PM10
    no2         numeric(7,2),             -- azot-dioksid
    o3          numeric(7,2),             -- ozon
    eaqi_izvor  smallint,                 -- EAQI koji je izračunao izvor (Open-Meteo); naša kategorija se i dalje računa u src/core/pravila
    prognoza    boolean NOT NULL DEFAULT false,  -- true = vrednost za budući sat (prognoza modela), ne merenje
    CONSTRAINT merenje_vazduha_jedinstveno UNIQUE (uredjaj_id, vreme),
    CONSTRAINT merenje_vazduha_ima_vrednost CHECK (num_nonnulls(pm25, pm10, no2, o3) > 0),
    CONSTRAINT merenje_vazduha_nenegativno CHECK (
        coalesce(pm25, 0) >= 0 AND coalesce(pm10, 0) >= 0 AND coalesce(no2, 0) >= 0 AND coalesce(o3, 0) >= 0
    )
);

CREATE INDEX IF NOT EXISTS merenje_vazduha_uredjaj_vreme
    ON merenje_vazduha (uredjaj_id, vreme DESC);

COMMENT ON TABLE merenje_vazduha IS 'Kvalitet vazduha: Sensor.Community (merenja senzora) i Open-Meteo (model CAMS, satno, uz prognozu).';

-- Vreme (meteorologija).
CREATE TABLE IF NOT EXISTS merenje_vremena (
    id             bigserial PRIMARY KEY,
    uredjaj_id     text NOT NULL REFERENCES uredjaj(id),
    vreme          timestamptz NOT NULL,
    temperatura_c  numeric(5,2),          -- °C
    vlaznost_proc  numeric(5,2),          -- relativna vlažnost, %
    vetar_kmh      numeric(6,2),          -- brzina vetra, km/h
    padavine_mm    numeric(6,2),          -- padavine u tom satu, mm
    vreme_kod      smallint,              -- WMO kod (0 vedro, 3 oblačno, 61 kiša…)
    prognoza       boolean NOT NULL DEFAULT false,
    CONSTRAINT merenje_vremena_jedinstveno UNIQUE (uredjaj_id, vreme),
    CONSTRAINT merenje_vremena_ima_vrednost CHECK (
        num_nonnulls(temperatura_c, vlaznost_proc, vetar_kmh, padavine_mm, vreme_kod) > 0
    ),
    CONSTRAINT merenje_vremena_vlaznost CHECK (vlaznost_proc IS NULL OR vlaznost_proc BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS merenje_vremena_uredjaj_vreme
    ON merenje_vremena (uredjaj_id, vreme DESC);

COMMENT ON TABLE merenje_vremena IS 'Vreme sa Open-Meteo (satno, poslednja 24 h i prognoza).';
