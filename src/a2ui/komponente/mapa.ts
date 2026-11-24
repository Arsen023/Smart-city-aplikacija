/**
 * Sopstvena A2UI komponenta: mapa senzora (Leaflet + OpenStreetMap podloga), tačke obojene po EAQI nivou.
 * Senzori dolaze iz data modela (/senzori); kategoriju je izračunao server (modul pravila), mapa je samo crta.
 *
 * Koristi se samo u chatu (izvorni A2UI, src/a2ui/katalog-chat.ts) – tamo je i Leaflet CSS, a podloga
 * mape se učitava sa tile.openstreetmap.org. Crta se u light DOM-u, jer Leaflet CSS ne ulazi u shadow DOM.
 */
import { A2uiLitElement } from "@a2ui/lit/v0_9";
import { CommonSchemas, type ComponentApi } from "@a2ui/web_core/v0_9";
import L from "leaflet";
import { html, nothing } from "lit";
import { z } from "zod/v3";
import { KOMPONENTA_MAPA, type TackaMape } from "../../zajednicko/a2ui-katalog.js";
import { EAQI_BOJE } from "../../zajednicko/boje-eaqi.js";

const S = CommonSchemas as unknown as Record<"DynamicValue", z.ZodTypeAny>;

export const MapaApi: ComponentApi = {
  name: KOMPONENTA_MAPA,
  schema: z.object({ tacke: S.DynamicValue }) as unknown as ComponentApi["schema"],
};

const NEMA_BOJE = "#94a3b8";

function jeTacka(x: unknown): x is TackaMape {
  const t = x as Partial<TackaMape> | null;
  return !!t && typeof t.lat === "number" && typeof t.lon === "number" && typeof t.naziv === "string";
}

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]!);
}

export class MapaElement extends A2uiLitElement<ComponentApi, { tacke?: unknown }> {
  protected readonly api = MapaApi;
  private mapa: L.Map | null = null;
  private sloj: L.LayerGroup | null = null;

  // Light DOM: Leaflet CSS (uvezen na chat stranici) mora da vidi elemente mape.
  protected override createRenderRoot() {
    return this;
  }

  render() {
    if (!this.controller?.props) return nothing;
    return html`<div class="sc-mapa" role="region" aria-label="Mapa senzora kvaliteta vazduha" style="height:260px;border-radius:12px;z-index:0"></div>`;
  }

  protected override updated(): void {
    const el = this.querySelector<HTMLElement>(".sc-mapa");
    const p = this.controller?.props;
    if (!el || !p) return;
    if (!this.mapa) {
      this.mapa = L.map(el, { scrollWheelZoom: false }).setView([45.255, 19.845], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.mapa);
      this.sloj = L.layerGroup().addTo(this.mapa);
    }
    const tacke = Array.isArray(p.tacke) ? p.tacke.filter(jeTacka) : [];
    this.sloj!.clearLayers();
    for (const t of tacke) {
      L.circleMarker([t.lat, t.lon], {
        radius: t.model ? 12 : 8,
        color: t.model ? "#1e293b" : "#ffffff",
        weight: 2,
        dashArray: t.model ? "4 3" : undefined,
        fillColor: t.nivo ? (EAQI_BOJE[t.nivo] ?? NEMA_BOJE) : NEMA_BOJE,
        fillOpacity: 0.9,
      })
        .bindPopup(`<strong>${esc(t.naziv)}</strong><br>${esc(t.kategorija)}<br>${esc(t.opis)}`)
        .bindTooltip(esc(t.naziv))
        .addTo(this.sloj!);
    }
    if (tacke.length > 1) this.mapa.fitBounds(tacke.map((t) => [t.lat, t.lon] as [number, number]), { padding: [28, 28], maxZoom: 13 });
    // kontejner dobije veličinu tek kad se ekran ubaci u razgovor
    setTimeout(() => this.mapa?.invalidateSize(), 50);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mapa?.remove();
    this.mapa = null;
  }
}

export const TAG_MAPA = "sc-mapa-senzora";
if (!customElements.get(TAG_MAPA)) customElements.define(TAG_MAPA, MapaElement);

export const MapaSenzora = { ...MapaApi, tagName: TAG_MAPA };
