-- Šema baze za merenja kvaliteta vode (FishNET, DunavNET).
-- Pokreće se jednom, u praznoj bazi (npr. "smartcity"). Ponovno pokretanje ne briše podatke.
--
-- Imena kolona prate polja iz API-ja (historydata / currentdata), osim:
--   doxsaturation -> dox_zasicenje, dc02 -> dco2 (u API-ju piše nula umesto slova O), time -> vreme.
-- Jedinice su pretpostavka po uobičajenim senzorima – POTVRDITI sa DunavNET-om.

CREATE TABLE IF NOT EXISTS uredjaj (
    id          text PRIMARY KEY,            -- deviceId iz API-ja
    naziv       text NOT NULL,
    tip         text NOT NULL,               -- npr. 'kvalitet vode'
    lokacija    text,                        -- opis, kad saznamo
    napravljeno timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merenje_vode (
    id             bigserial PRIMARY KEY,
    uredjaj_id     text NOT NULL REFERENCES uredjaj(id),
    vreme          timestamptz NOT NULL,     -- "time"
    temperatura_c  numeric(5,2),             -- "temperature_c", °C
    ph             numeric(4,2),             -- "ph", 0–14
    orp            numeric(6,1),             -- "orp", oksido-redukcioni potencijal, mV
    dox            numeric(5,2),             -- "dox", rastvoreni kiseonik, mg/L
    con            numeric(7,2),             -- "con", provodljivost (mS/cm?)
    dox_zasicenje  numeric(5,2),             -- "doxsaturation", zasićenje kiseonikom, %
    dco2           numeric(7,1),             -- "dc02", rastvoreni CO2 (ppm?)
    -- Jedno merenje po uređaju i trenutku: ponovni uvoz ne pravi duplikate.
    CONSTRAINT merenje_vode_jedinstveno UNIQUE (uredjaj_id, vreme),
    -- Prazan zapis (sve null) se ne čuva – to nije merenje.
    CONSTRAINT merenje_vode_ima_vrednost CHECK (
        num_nonnulls(temperatura_c, ph, orp, dox, con, dox_zasicenje, dco2) > 0
    ),
    CONSTRAINT merenje_vode_ph CHECK (ph IS NULL OR ph BETWEEN 0 AND 14)
);

-- Najčešći upit: merenja jednog uređaja za period, najnovija prva (grafikon, istorija).
CREATE INDEX IF NOT EXISTS merenje_vode_uredjaj_vreme
    ON merenje_vode (uredjaj_id, vreme DESC);

COMMENT ON TABLE merenje_vode IS 'Istorija merenja kvaliteta vode sa FishNET uređaja (historydata).';
