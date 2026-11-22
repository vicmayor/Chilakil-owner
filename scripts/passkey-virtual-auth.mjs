/**
 * Registers a passkey and signs in with it using Chrome's virtual authenticator.
 * Requires the app on http://localhost:3000 and OWNER_EMAIL / OWNER_PASSWORD.
 *
 *   node --env-file=.env scripts/passkey-virtual-auth.mjs
 */
import pkg from "playwright-core";
import { mkdir } from "node:fs/promises";

const { chromium } = pkg;
const base = process.env.APP_URL || "http://localhost:3000";
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const shots = process.env.SHOT_DIR || "/opt/cursor/artifacts/after";

if (!email || !password) {
  console.error("OWNER_EMAIL and OWNER_PASSWORD are required.");
  process.exit(1);
}

await mkdir(shots, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});

async function shot(name) {
  await page.screenshot({ path: `${shots}/${name}.png` });
  console.log("shot", name);
}

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Sign in with Face ID" }).waitFor();
await shot("login");

await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("button", { name: "Enable Face ID" }).waitFor();
await shot("dashboard");

const registered = page.waitForResponse(
  (response) => response.url().includes("/api/passkey/register/verify") && response.ok(),
);
await page.getByRole("button", { name: "Enable Face ID" }).click();
const registeredResponse = await registered;
console.log("passkey registered", registeredResponse.status());
await page.getByText("Enable Face ID").waitFor({ state: "hidden" });

await page.goto(`${base}/sales`, { waitUntil: "networkidle" });
await page.getByText("New customers").first().waitFor();
const salesText = await page.locator("main").innerText();
if (!salesText.includes("Combined total (Glendale + Avondale)")) {
  throw new Error("ALL sales view is missing the combined total");
}
await shot("sales");
const chart = page.getByRole("img", { name: "New customers" });
await chart.scrollIntoViewIfNeeded();
await shot("sales-new-customers");

await page.getByRole("tab", { name: "Restaurant Glendale" }).click();
await page.getByText("Showing this location only").waitFor();
const glendale = await page.locator("main").innerText();
if (glendale.includes("Combined total (Glendale + Avondale)")) {
  throw new Error("Glendale view still shows a combined total");
}
if (glendale.includes("Avondale")) {
  throw new Error("Glendale view mentions Avondale");
}
await shot("sales-glendale");

await page.goto(`${base}/more`, { waitUntil: "networkidle" });
await page.getByText("Face ID is on").scrollIntoViewIfNeeded();
await shot("more-face-id");
await page.evaluate(() => window.scrollTo(0, 0));
await shot("more");

await page.getByRole("tab", { name: "Both All" }).click();
await page.getByText("Both locations").waitFor();

for (const path of ["/messages", "/employees", "/inventory", "/doordash", "/food-cost"]) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await shot(path.slice(1));
}

await page.goto(`${base}/more`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/login");
await shot("login-face-id");
const signedIn = page.waitForResponse(
  (response) => response.url().includes("/api/passkey/login/verify") && response.ok(),
);
await page.getByRole("button", { name: "Sign in with Face ID" }).click();
console.log("passkey login", (await signedIn).status());
await page.waitForURL("**/dashboard");
await page.getByRole("heading", { name: "Today" }).waitFor();
if (await page.getByRole("button", { name: "Enable Face ID" }).count()) {
  throw new Error("Face ID offer came back after a passkey login");
}
await shot("dashboard-after-face-id");
console.log("passkey login ok");

await browser.close();
