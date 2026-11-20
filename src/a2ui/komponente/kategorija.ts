/**
 * Sopstvena A2UI komponenta: EAQI kategorija sa bojom i nazivom (spec 8.1, element 4).
 * Osnovni katalog nema boju teksta (T05), pa ovo dodajemo u naš katalog.
 */
import { CommonSchemas, type ComponentApi } from "@a2ui/web_core/v0_9";
import { A2uiLitElement } from "@a2ui/lit/v0_9";
import { css, html, nothing } from "lit";
// A2UI interno koristi Zod 3 (čita _def.typeName), pa šemu pravimo sa zod/v3.
import { z } from "zod/v3";

// A2UI šeme kao opšti Zod tip – isti objekti u toku izvršavanja, ali TypeScript ne raspliće duboke tipove.
const S = CommonSchemas as unknown as Record<"DynamicString" | "DynamicNumber" | "DynamicValue", z.ZodTypeAny>;
import { KOMPONENTA_KATEGORIJA } from "../../zajednicko/a2ui-katalog.js";
import { bojeKategorije } from "../../zajednicko/boje-eaqi.js";

export const KategorijaApi: ComponentApi = {
  name: KOMPONENTA_KATEGORIJA,
  schema: z.object({
    naziv: S.DynamicString,
    nivo: S.DynamicNumber,
  }) as unknown as ComponentApi["schema"],
};

export class KategorijaElement extends A2uiLitElement<ComponentApi, { naziv?: string; nivo?: number }> {
  protected readonly api = KategorijaApi;

  static styles = css`
    .znacka {
      display: inline-flex;
      align-items: baseline;
      gap: 0.5em;
      padding: 0.4em 0.9em;
      border-radius: 999px;
      font-weight: 700;
      font-size: 1.15rem;
    }
    .nivo {
      font-weight: 400;
      font-size: 0.85rem;
    }
  `;

  render() {
    const p = this.controller?.props;
    if (!p) return nothing;
    const nivo = Number(p.nivo);
    const { pozadina, tekst } = bojeKategorije(nivo);
    // Naziv je uvek u tekstu, boja je samo dodatak (NFR-07).
    return html`<span
      class="znacka"
      role="status"
      aria-label=${`Kategorija kvaliteta vazduha: ${p.naziv}`}
      style=${`background:${pozadina};color:${tekst}`}
      >${p.naziv}<span class="nivo">nivo ${nivo}/6</span></span
    >`;
  }
}

export const TAG_KATEGORIJA = "sc-kategorija";
if (!customElements.get(TAG_KATEGORIJA)) customElements.define(TAG_KATEGORIJA, KategorijaElement);

export const Kategorija = { ...KategorijaApi, tagName: TAG_KATEGORIJA };
