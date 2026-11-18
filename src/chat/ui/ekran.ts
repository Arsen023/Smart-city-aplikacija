/**
 * Prikaz ekrana A ili B u razgovoru (MCP App u iframe-u), preko AppBridge iz ext-apps.
 * Prilagođeno iz ext-apps/examples/basic-host/src/implementation.ts.
 *
 * Ekran sam poziva alate (npr. „Osveži“) – AppBridge to prosleđuje MCP serveru preko klijenta.
 */
import {
  AppBridge,
  getToolUiResourceUri,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
  type McpUiResourceCsp,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

const HOST = { name: "Smart City chat", version: "1.0.0" };

export interface EkranOpcije {
  klijent: Client;
  alat: Tool;
  argumenti: Record<string, unknown>;
  rezultat: Promise<CallToolResult>;
  sandboxUrl: string;
  /** Gde se ekran ubacuje (kontejner u razgovoru). */
  kontejner: HTMLElement;
  /** Ekran javlja šta korisnik gleda (ui/update-model-context) – ide modelu uz sledeće pitanje. */
  naKontekst?: (tekst: string | null) => void;
}

export function imaEkran(alat: Tool): boolean {
  return getToolUiResourceUri(alat) !== undefined;
}

async function procitajEkran(klijent: Client, uri: string): Promise<{ html: string; csp?: McpUiResourceCsp }> {
  const resurs = await klijent.readResource({ uri });
  const sadrzaj = resurs.contents[0];
  if (!sadrzaj || sadrzaj.mimeType !== RESOURCE_MIME_TYPE) throw new Error("Ekran nije u očekivanom formatu.");
  const html = "text" in sadrzaj && typeof sadrzaj.text === "string" ? sadrzaj.text : atob(String((sadrzaj as { blob?: string }).blob ?? ""));
  const meta = (sadrzaj as { _meta?: { ui?: { csp?: McpUiResourceCsp } } })._meta;
  return { html, csp: meta?.ui?.csp };
}

function ucitajSandbox(iframe: HTMLIFrameElement, sandboxUrl: string, csp?: McpUiResourceCsp): Promise<void> {
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  const spreman = new Promise<void>((resolve) => {
    const slusaj = ({ source, data }: MessageEvent) => {
      if (source === iframe.contentWindow && (data as { method?: string })?.method === "ui/notifications/sandbox-proxy-ready") {
        window.removeEventListener("message", slusaj);
        resolve();
      }
    };
    window.addEventListener("message", slusaj);
  });
  const url = new URL(sandboxUrl);
  if (csp) url.searchParams.set("csp", JSON.stringify(csp));
  iframe.src = url.href;
  return spreman;
}

/** Ubacuje ekran u kontejner i prosleđuje mu ulaz i rezultat alata. */
export async function prikaziEkran(o: EkranOpcije): Promise<void> {
  const uri = getToolUiResourceUri(o.alat);
  if (!uri) return;

  const iframe = document.createElement("iframe");
  iframe.className = "ekran";
  iframe.title = "Ekran sa podacima o kvalitetu vazduha";
  o.kontejner.appendChild(iframe);

  const [ekran] = await Promise.all([procitajEkran(o.klijent, uri), ucitajSandbox(iframe, o.sandboxUrl)]);

  const mogucnosti = o.klijent.getServerCapabilities();
  const most = new AppBridge(
    o.klijent,
    HOST,
    { openLinks: {}, serverTools: mogucnosti?.tools, serverResources: mogucnosti?.resources, updateModelContext: { text: {} } },
    {
      hostContext: {
        theme: "light",
        platform: "web",
        containerDimensions: { maxHeight: 6000 },
        displayMode: "inline",
        availableDisplayModes: ["inline"],
      },
    },
  );

  most.onsizechange = async ({ height }) => {
    if (height !== undefined) iframe.style.height = `${height}px`;
  };
  most.onupdatemodelcontext = async (p) => {
    const tekst = (p.content ?? [])
      .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
    o.naKontekst?.(tekst || null);
    return {};
  };
  most.onmessage = async () => ({});
  most.onopenlink = async ({ url }) => {
    window.open(url, "_blank", "noopener,noreferrer");
    return {};
  };

  const inicijalizovan = new Promise<void>((resolve) => {
    most.oninitialized = () => resolve();
  });

  const prozor = iframe.contentWindow;
  if (!prozor) throw new Error("Ekran nije mogao da se učita.");
  await most.connect(new PostMessageTransport(prozor, prozor));
  await most.sendSandboxResourceReady({ html: ekran.html, csp: ekran.csp });
  await inicijalizovan;

  most.sendToolInput({ arguments: o.argumenti });
  o.rezultat.then(
    (r) => most.sendToolResult(r),
    (e: unknown) => most.sendToolCancelled({ reason: e instanceof Error ? e.message : "Greška alata" }),
  );
}
