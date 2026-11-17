import { App } from "@modelcontextprotocol/ext-apps";

const timeEl = document.getElementById("time") as HTMLParagraphElement;
const btn = document.getElementById("btn") as HTMLButtonElement;

const app = new App({ name: "Smart City App", version: "1.0.0" });

// Prikaži rezultat kad host pošalje rezultat poziva alata
app.ontoolresult = (result) => {
  const text = result.content?.find((c) => c.type === "text");
  if (text && "text" in text) {
    timeEl.textContent = text.text;
  }
};

// Klik na dugme ponovo poziva alat "assess_air_quality" (privremeno, pun ekran dolazi u T10)
btn.addEventListener("click", async () => {
  const result = await app.callServerTool({ name: "assess_air_quality", arguments: {} });
  const text = result.content?.find((c) => c.type === "text");
  if (text && "text" in text) {
    timeEl.textContent = text.text;
  }
});

app.connect();