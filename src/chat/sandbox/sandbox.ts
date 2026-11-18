/**
 * Sandbox proxy za ekran A/B u chat aplikaciji (spoljni iframe, drugi origin).
 * Prilagođeno iz ext-apps/examples/basic-host/src/sandbox.ts.
 *
 *   chat stranica (3010) ↔ ovaj sandbox (3011) ↔ unutrašnji iframe sa HTML-om ekrana
 *
 * Prosleđuje poruke u oba smera i jedino on upisuje HTML ekrana u unutrašnji iframe.
 */
import {
  buildAllowAttribute,
  type McpUiSandboxProxyReadyNotification,
  type McpUiSandboxResourceReadyNotification,
} from "@modelcontextprotocol/ext-apps/app-bridge";

const DOZVOLJEN_HOST = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/;

if (window.self === window.top) throw new Error("Ova stranica radi samo unutar iframe-a.");
if (!document.referrer || !DOZVOLJEN_HOST.test(document.referrer)) {
  throw new Error(`Nedozvoljen host: ${document.referrer || "(nema referrer-a)"}`);
}

const HOST_ORIGIN = new URL(document.referrer).origin;
const SVOJ_ORIGIN = new URL(window.location.href).origin;

// Provera izolacije: pristup window.top MORA da baci SecurityError.
try {
  window.top?.alert("Sandbox nije bezbedno podešen.");
  throw new Error("FAIL");
} catch (e) {
  if (e instanceof Error && e.message === "FAIL") throw new Error("Sandbox nije bezbedno podešen.");
}

const unutrasnji = document.createElement("iframe");
unutrasnji.style.cssText = "width:100%; height:100%; border:none;";
unutrasnji.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
document.body.appendChild(unutrasnji);

const RESURS_SPREMAN: McpUiSandboxResourceReadyNotification["method"] = "ui/notifications/sandbox-resource-ready";
const PROXY_SPREMAN: McpUiSandboxProxyReadyNotification["method"] = "ui/notifications/sandbox-proxy-ready";

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source === window.parent) {
    if (event.origin !== HOST_ORIGIN) return;
    const data = event.data as { method?: string; params?: { html?: unknown; sandbox?: unknown; permissions?: unknown } };
    if (data?.method === RESURS_SPREMAN) {
      const { html, sandbox, permissions } = data.params ?? {};
      if (typeof sandbox === "string") unutrasnji.setAttribute("sandbox", sandbox);
      const allow = buildAllowAttribute(permissions as Parameters<typeof buildAllowAttribute>[0]);
      if (allow) unutrasnji.setAttribute("allow", allow);
      if (typeof html === "string") {
        const doc = unutrasnji.contentDocument ?? unutrasnji.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        } else {
          unutrasnji.srcdoc = html;
        }
      }
    } else {
      unutrasnji.contentWindow?.postMessage(event.data, "*");
    }
  } else if (event.source === unutrasnji.contentWindow) {
    if (event.origin !== SVOJ_ORIGIN) return;
    window.parent.postMessage(event.data, HOST_ORIGIN);
  }
});

window.parent.postMessage({ jsonrpc: "2.0", method: PROXY_SPREMAN, params: {} }, HOST_ORIGIN);
