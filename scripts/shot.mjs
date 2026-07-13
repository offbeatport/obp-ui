// Render a page to a PNG so the UI can be visually checked.
//   node scripts/shot.mjs <path> <theme> <outfile>
//   node scripts/shot.mjs /design dark /tmp/design-dark.png
// Defaults: path "/", theme "light". BASE env overrides the origin (default :3000).
import { chromium } from "playwright";

const path = process.argv[2] || "/";
const theme = process.argv[3] || "light";
const out = process.argv[4] || `shot-${theme}.png`;
const base = process.env.BASE || "http://localhost:3000";
const url = path.startsWith("http") ? path : base + path;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
if (theme === "dark") {
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("cslopslop-theme", "dark");
    } catch {}
  });
}
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: "load", timeout: 20000 });
} catch (e) {
  console.warn("goto warning:", e.message);
}
await page.waitForTimeout(700);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("saved", out, `(${url}, ${theme})`);
