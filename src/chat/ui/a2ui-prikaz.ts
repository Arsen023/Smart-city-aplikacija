/**
 * Verzija B u chatu – IZVORNI A2UI: ekran se crta direktno u stranici (bez iframe-a),
 * zvaničnim rendererom (@a2ui/lit) i našim katalogom (src/a2ui/).
 *
 * Komponente (raspored) sastavlja AI u chatu; podaci (data model) dolaze iz MCP alata
 * assess_air_quality_a2ui – isti K1–K3 kao verzija A. Ako AI ne napravi ispravan ekran, crta se
 * fiksni (rezervni) raspored koji vraća isti alat.
 */
import { A2uiSurface } from "@a2ui/lit/v0_9";
import { injectBasicCatalogStyles } from "@a2ui/web_core/v0_9/basic_catalog";
import { MessageProcessor, type ActionPayload, type ProcessableMessagePayload } from "@a2ui/web_core/v0_9";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { html, render } from "lit";
import { katalog } from "../../a2ui/katalog.js";
import { KATALOG_ID } from "../../zajednicko/a2ui-katalog.js";

void A2uiSurface; // registruje <a2ui-surface>
injectBasicCatalogStyles();

const A2UI_MIME = "application/a2ui+json";
const VERZIJA = "v0.9";

type Komponenta = { id: string; component: string } & Record<string, unknown>;

/** Ono što chat uzima iz rezultata MCP alata za verziju B. */
export interface A2uiIzAlata {
  /** Fiksni (rezervni) raspored koji je napravio server. */
  komponente: Komponenta[];
  /** Data model – SVE vrednosti koje ekran prikazuje (sa servera, K1–K3). */
  podaci: Record<string, unknown>;
  /** status iz Rezultat-a; za sve osim "ok" crta se fiksni ekran sa porukom (FR-09). */
  status: string;
}

/** Izvlači raspored i podatke iz rezultata alata (A2UI resurs koji vraća server). */
export function a2uiIzRezultata(r: CallToolResult): A2uiIzAlata | null {
  for (const c of r.content ?? []) {
    if (c.type !== "resource" || c.resource.mimeType !== A2UI_MIME || !("text" in c.resource)) continue;
    const poruke = JSON.parse(String(c.resource.text)) as Array<Record<string, unknown>>;
    const uc = poruke.find((p) => "updateComponents" in p)?.updateComponents as { components?: Komponenta[] } | undefined;
    const dm = poruke.find((p) => "updateDataModel" in p)?.updateDataModel as { value?: Record<string, unknown> } | undefined;
    if (!uc?.components || !dm?.value) return null;
    const status = (r.structuredContent as { status?: unknown } | undefined)?.status;
    return { komponente: uc.components, podaci: dm.value, status: typeof status === "string" ? status : "error" };
  }
  return null;
}

export interface A2uiEkran {
  /** Zamenjuje podatke na istom ekranu („Osveži“) – bez LLM-a. */
  azurirajPodatke(podaci: Record<string, unknown>): void;
}

let brojac = 0;

/**
 * Crta A2UI ekran u kontejneru. Komponente: od AI-ja (ili rezervne), podaci: iz MCP alata.
 * @param naAkciju dugmad iz fiksnog rasporeda („Osveži“, „Prikaži“) – chat ponovo zove alat
 */
export function prikaziA2ui(
  kontejner: HTMLElement,
  komponente: Komponenta[],
  podaci: Record<string, unknown>,
  naAkciju: (akcija: ActionPayload) => void | Promise<void>,
): A2uiEkran {
  const surfaceId = `odgovor-${++brojac}`;
  const procesor = new MessageProcessor([katalog], naAkciju);
  procesor.onSurfaceCreated((s) => render(html`<a2ui-surface .surface=${s}></a2ui-surface>`, kontejner));
  procesor.processMessages([
    { version: VERZIJA, createSurface: { surfaceId, catalogId: KATALOG_ID } },
    { version: VERZIJA, updateComponents: { surfaceId, components: komponente } },
    { version: VERZIJA, updateDataModel: { surfaceId, value: podaci } },
  ] as ProcessableMessagePayload);
  return {
    azurirajPodatke(novi) {
      procesor.processMessages([{ version: VERZIJA, updateDataModel: { surfaceId, value: novi } }] as ProcessableMessagePayload);
    },
  };
}
