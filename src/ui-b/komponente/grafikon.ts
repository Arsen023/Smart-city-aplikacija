/**
 * Sopstvena A2UI komponenta: linijski grafikon PM2.5 i PM10 za 24 h (spec 8.1, element 5).
 * Osnovni katalog nema grafikon (T05). Crtamo sopstveni SVG – bez nove biblioteke i bez CDN-a.
 */
import { CommonSchemas, type ComponentApi } from "@a2ui/web_core/v0_9";
import { A2uiLitElement } from "@a2ui/lit/v0_9";
import { css, html, nothing, svg } from "lit";
import { z } from "zod/v3";

// A2UI šeme kao opšti Zod tip – isti objekti u toku izvršavanja, ali TypeScript ne raspliće duboke tipove.
const S = CommonSchemas as unknown as Record<"DynamicString" | "DynamicNumber" | "DynamicValue", z.ZodTypeAny>;
import type { SatnaVrednost } from "../../core/tipovi.js";
import { KOMPONENTA_GRAFIKON } from "../katalog-id.js";
import { geometrija, PODRAZUMEVANE as D } from "./geometrija.js";

export const GrafikonApi: ComponentApi = {
  name: KOMPONENTA_GRAFIKON,
  schema: z.object({
    /** Satne vrednosti iz Rezultat.history, vezane preko path. */
    tacke: S.DynamicValue,
    jedinica: S.DynamicString.optional(),
  }) as unknown as ComponentApi["schema"],
};

const BOJA_PM25 = "#1F5FBF";
const BOJA_PM10 = "#A34700";

function jeSatnaVrednost(x: unknown): x is SatnaVrednost {
  return typeof x === "object" && x !== null && "vreme" in x;
}

export class GrafikonElement extends A2uiLitElement<ComponentApi, { tacke?: unknown; jedinica?: string }> {
  protected readonly api = GrafikonApi;

  static styles = css`
    figure {
      margin: 0.5em 0;
    }
    svg {
      width: 100%;
      max-width: 640px;
      height: auto;
      display: block;
    }
    .osa {
      font-size: 11px;
      fill: currentColor;
      opacity: 0.75;
    }
    figcaption {
      display: flex;
      gap: 1em;
      font-size: 0.8rem;
      flex-wrap: wrap;
    }
    .leg::before {
      content: "";
      display: inline-block;
      width: 1.2em;
      height: 0;
      border-top: 2px solid var(--b);
      margin-right: 0.35em;
      vertical-align: middle;
    }
    .leg.isprekidano::before {
      border-top-style: dashed;
    }
  `;

  render() {
    const p = this.controller?.props;
    if (!p) return nothing;
    const tacke = Array.isArray(p.tacke) ? p.tacke.filter(jeSatnaVrednost) : [];
    if (tacke.length === 0) return nothing;
    const jedinica = p.jedinica || "µg/m³";
    const g = geometrija(tacke);
    const dnoX = D.visina - D.dole;

    return html`<figure>
      <svg viewBox="0 0 ${D.sirina} ${D.visina}" role="img" aria-label=${`Grafikon PM2.5 i PM10 za poslednja 24 h, u ${jedinica}`}>
        ${g.oznakeY.map(
          (o) => svg`<line x1=${D.levo} x2=${D.sirina - D.desno} y1=${o.y} y2=${o.y} stroke="currentColor" stroke-opacity="0.15" />
            <text class="osa" x=${D.levo - 4} y=${o.y + 3} text-anchor="end">${o.tekst}</text>`,
        )}
        ${g.oznakeX.map((o) => svg`<text class="osa" x=${o.x} y=${dnoX + 14} text-anchor="middle">${o.tekst}h</text>`)}
        ${g.pm10 ? svg`<path d=${g.pm10} fill="none" stroke=${BOJA_PM10} stroke-width="2" stroke-dasharray="5 3" />` : nothing}
        ${g.pm25 ? svg`<path d=${g.pm25} fill="none" stroke=${BOJA_PM25} stroke-width="2" />` : nothing}
      </svg>
      <figcaption>
        <span class="leg" style="--b:${BOJA_PM25}">PM2.5</span>
        <span class="leg isprekidano" style="--b:${BOJA_PM10}">PM10</span>
        <span>${jedinica}, poslednja 24 h</span>
      </figcaption>
    </figure>`;
  }
}

export const TAG_GRAFIKON = "sc-grafikon-24h";
if (!customElements.get(TAG_GRAFIKON)) customElements.define(TAG_GRAFIKON, GrafikonElement);

export const Grafikon = { ...GrafikonApi, tagName: TAG_GRAFIKON };
