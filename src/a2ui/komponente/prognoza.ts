/**
 * Sopstvena A2UI komponenta: prognoza po satima (sat, ikona, temperatura) u jednom redu.
 * Sati dolaze iz data modela (/meteo/prognoza) – tekst je već formatirao server.
 */
import { A2uiLitElement } from "@a2ui/lit/v0_9";
import { CommonSchemas, type ComponentApi } from "@a2ui/web_core/v0_9";
import { css, html, nothing } from "lit";
import { z } from "zod/v3";
import { KOMPONENTA_PROGNOZA, type SatPrognoze } from "../../zajednicko/a2ui-katalog.js";

const S = CommonSchemas as unknown as Record<"DynamicValue", z.ZodTypeAny>;

export const PrognozaApi: ComponentApi = {
  name: KOMPONENTA_PROGNOZA,
  schema: z.object({ sati: S.DynamicValue }) as unknown as ComponentApi["schema"],
};

function jeSat(x: unknown): x is SatPrognoze {
  return typeof x === "object" && x !== null && "sat" in x && "temperatura" in x;
}

export class PrognozaElement extends A2uiLitElement<ComponentApi, { sati?: unknown }> {
  protected readonly api = PrognozaApi;

  static styles = css`
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(3.2em, 1fr);
      gap: 0.25em;
      overflow-x: auto;
      text-align: center;
    }
    li {
      display: flex;
      flex-direction: column;
      gap: 0.2em;
      font-size: 0.82rem;
      padding: 0.4em 0.1em;
      border-radius: 10px;
    }
    .sat {
      opacity: 0.7;
    }
    .ikona {
      font-size: 1.3rem;
    }
    b {
      font-weight: 700;
    }
  `;

  render() {
    const p = this.controller?.props;
    if (!p) return nothing;
    const sati = Array.isArray(p.sati) ? p.sati.filter(jeSat) : [];
    if (!sati.length) return html`<p>Prognoza nije dostupna.</p>`;
    return html`<ul aria-label="Prognoza po satima">
      ${sati.map(
        (s) => html`<li title=${s.opis}>
          <span class="sat">${s.sat}</span><span class="ikona" aria-hidden="true">${s.ikona}</span><b>${s.temperatura}</b>
        </li>`,
      )}
    </ul>`;
  }
}

export const TAG_PROGNOZA = "sc-prognoza-sati";
if (!customElements.get(TAG_PROGNOZA)) customElements.define(TAG_PROGNOZA, PrognozaElement);

export const PrognozaSati = { ...PrognozaApi, tagName: TAG_PROGNOZA };
