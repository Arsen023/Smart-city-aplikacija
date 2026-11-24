/**
 * Sopstvena A2UI komponenta: linijski grafikon jednog niza (temperatura, vlažnost, kiseonik u vodi, pH…).
 * Tačke ({oznaka, vrednost}) dolaze iz data modela preko path – komponenta ništa ne računa, samo crta.
 */
import { A2uiLitElement } from "@a2ui/lit/v0_9";
import { CommonSchemas, type ComponentApi } from "@a2ui/web_core/v0_9";
import { css, html, nothing, svg } from "lit";
import { z } from "zod/v3";
import { KOMPONENTA_NIZ, type TackaNiza } from "../../zajednicko/a2ui-katalog.js";

const S = CommonSchemas as unknown as Record<"DynamicString" | "DynamicValue", z.ZodTypeAny>;

export const NizApi: ComponentApi = {
  name: KOMPONENTA_NIZ,
  schema: z.object({
    tacke: S.DynamicValue,
    jedinica: S.DynamicString.optional(),
    naslov: S.DynamicString.optional(),
  }) as unknown as ComponentApi["schema"],
};

/** Boja po jedinici, da temperatura, vlažnost i voda ne izgledaju isto. */
const BOJE: Record<string, string> = { "°C": "#f97316", "%": "#8b5cf6", "mg/L": "#2563eb", pH: "#0891b2" };

function jeTacka(x: unknown): x is TackaNiza {
  return typeof x === "object" && x !== null && "oznaka" in x && "vrednost" in x;
}

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });
const DIM = { w: 560, h: 180, l: 40, r: 10, t: 10, b: 24 };

export class NizElement extends A2uiLitElement<ComponentApi, { tacke?: unknown; jedinica?: string; naslov?: string }> {
  protected readonly api = NizApi;

  static styles = css`
    figure {
      margin: 0.25em 0;
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .osa {
      font-size: 11px;
      fill: currentColor;
      opacity: 0.7;
    }
    figcaption {
      font-size: 0.8rem;
      opacity: 0.8;
    }
  `;

  render() {
    const p = this.controller?.props;
    if (!p) return nothing;
    const tacke = Array.isArray(p.tacke) ? p.tacke.filter(jeTacka) : [];
    const vrednosti = tacke.map((t) => t.vrednost).filter((v): v is number => typeof v === "number");
    if (vrednosti.length < 2) return html`<figure><figcaption>Nema dovoljno podataka za grafikon.</figcaption></figure>`;
    const jedinica = p.jedinica ?? "";
    const boja = BOJE[jedinica] ?? "#2563eb";

    let min = Math.min(...vrednosti);
    let max = Math.max(...vrednosti);
    if (max === min) [min, max] = [min - 1, max + 1];
    const zazor = (max - min) * 0.1;
    [min, max] = [min - zazor, max + zazor];
    const x = (i: number) => DIM.l + (i / Math.max(1, tacke.length - 1)) * (DIM.w - DIM.l - DIM.r);
    const y = (v: number) => DIM.t + (1 - (v - min) / (max - min)) * (DIM.h - DIM.t - DIM.b);

    let d = "";
    let novi = true;
    tacke.forEach((t, i) => {
      if (typeof t.vrednost !== "number") return void (novi = true);
      d += `${novi ? "M" : "L"}${x(i).toFixed(1)},${y(t.vrednost).toFixed(1)} `;
      novi = false;
    });
    const oznakeY = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
    const korak = Math.max(1, Math.ceil(tacke.length / 6));

    return html`<figure>
      <svg viewBox="0 0 ${DIM.w} ${DIM.h}" role="img" aria-label=${`${p.naslov ?? "Grafikon"}${jedinica ? `, ${jedinica}` : ""}`}>
        ${oznakeY.map(
          (v) => svg`<line x1=${DIM.l} x2=${DIM.w - DIM.r} y1=${y(v)} y2=${y(v)} stroke="currentColor" stroke-opacity="0.12" />
            <text class="osa" x=${DIM.l - 4} y=${y(v) + 3} text-anchor="end">${broj.format(v)}</text>`,
        )}
        ${tacke.map((t, i) =>
          i % korak === 0 || i === tacke.length - 1
            ? svg`<text class="osa" x=${x(i)} y=${DIM.h - 6} text-anchor="middle">${t.oznaka}</text>`
            : nothing,
        )}
        <path d=${d} fill="none" stroke=${boja} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      </svg>
      ${p.naslov || jedinica ? html`<figcaption>${p.naslov ?? ""}${p.naslov && jedinica ? ", " : ""}${jedinica}</figcaption>` : nothing}
    </figure>`;
  }
}

export const TAG_NIZ = "sc-grafikon-niz";
if (!customElements.get(TAG_NIZ)) customElements.define(TAG_NIZ, NizElement);

export const GrafikonNiz = { ...NizApi, tagName: TAG_NIZ };
