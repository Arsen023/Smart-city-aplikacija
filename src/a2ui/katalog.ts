/**
 * Naš A2UI katalog (renderer): osnovni katalog v0.9 + KategorijaBadge + Grafikon24h.
 * Zajednički za ekran verzije B (MCP App, src/ui-b/) i izvorni A2UI u chatu (src/chat/ui/).
 * ID mora biti isti kao u createSurface na serveru (katalog-id.ts).
 */
import { basicCatalog } from "@a2ui/lit/v0_9";
import { Catalog } from "@a2ui/web_core/v0_9";
import { BASIC_FUNCTIONS } from "@a2ui/web_core/v0_9/basic_catalog";
import { KATALOG_ID } from "../zajednicko/a2ui-katalog.js";
import { Grafikon } from "./komponente/grafikon.js";
import { Kategorija } from "./komponente/kategorija.js";

export const katalog = new Catalog(KATALOG_ID, "0.9", [...basicCatalog.components.values(), Kategorija, Grafikon], BASIC_FUNCTIONS);
