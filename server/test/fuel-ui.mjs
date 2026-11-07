// All API traffic is intercepted. These fixtures never reach an ADMABS server.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
const root = new URL("../../", import.meta.url).pathname;
const vite = spawn(
  process.execPath,
  [
    root + "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
await new Promise((resolve, reject) => {
  vite.stdout.on("data", (d) => {
    if (String(d).includes("5174")) resolve();
  });
  vite.on("error", reject);
  vite.on("exit", (code) => reject(new Error(`Vite exited ${code}`)));
});
let browser;
const station = {
  _id: "TEST-STATION",
  name: "TEST ONLY STATION",
  code: "TEST-A",
  timeZone: "Africa/Accra",
  active: true,
};
const company = {
  _id: "TEST-COMPANY",
  name: "TEST ONLY TRANSPORT",
  accountCode: "TEST-CO",
  debtCents: 10000,
  advanceCents: 5000,
  limitCents: 100000,
  availableCents: 90000,
  status: "active",
  stations: [station._id],
  fuelTypes: ["diesel"],
};
const period = {
  _id: "TEST-PERIOD",
  number: "TEST ONLY PERIOD",
  station: station._id,
  pumpCode: "TEST-P1",
  nozzleCode: "TEST-N1",
  fuelType: "diesel",
  mode: "summary",
  businessDate: "2026-10-18",
  status: "draft",
  openingMl: 0,
  segments: [],
  openedAt: "2026-10-18T12:00:00Z",
};
const permissions = Object.fromEntries(
  [
    "view",
    "sales.record",
    "readings.enter",
    "readings.approve",
    "payments.receive",
    "credit.override",
    "accounts.adjust",
    "reports.company",
    "equipment.configure",
    "periods.post",
    "records.reverse",
    "stock.manage",
  ].map((p) => ["fuel." + p, true]),
);
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.FUEL_UI_BROWSER_PATH
      ? { executablePath: process.env.FUEL_UI_BROWSER_PATH }
      : {}),
  });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    let needsPreparation = false;
    let demoPayload;
    let demoActive = false, demoSummary = null, scenarioPayload;
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/site/content", route => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({companyName:"ADMABS Investments Limited",address:"TEST ONLY OFFICE",phone:"TEST PHONE"})}));
    await page.route("**/api/fuel/operations/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith("/bootstrap"))
        data = {
          stations: [station],
          outlets: [],
          permissions,
          transactionsSupported: true,
          schemaReady: !needsPreparation,
          canManageDemo: true,
          demoActive,
          demoSummary,
        };
      else if (path.endsWith("/demo/seed")) { demoPayload = route.request().postDataJSON(); data = { purchases: 20 }; demoActive = true; }
      else if (path.endsWith("/demo/scenarios")) {
        scenarioPayload = route.request().postDataJSON();
        demoSummary = { version: 1, note: "TEST ONLY starting scenario figures", stations: [] };
        data = demoSummary;
      }
      else if (path.endsWith("/prepare")) { needsPreparation = false; data = { ready: true }; }
      else if (path.endsWith("/companies/TEST-COMPANY/statement"))
        data = {
          company,
          invoices: [],
          payments: [],
          entries: [],
          vehicles: [
            {
              _id: "TEST-VEHICLE",
              registration: "TEST ONLY VEHICLE",
              active: true,
            },
          ],
          drivers: [],
          adjustments: [],
          balanceDueCents: 10000,
          advanceCreditCents: 5000,
          availableCents: 90000,
          ageing: {
            notDue: 10000,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            over90: 0,
          },
          scope: "TEST ONLY",
        };
      else if (path.endsWith("/companies")) data = [company];
      else if (path.endsWith("/interstation/tanks")) data = [];
      else if (path.endsWith("/interstation")) data = { loans: [], transfers: [] };
      else if (path.endsWith("/connections")) data = [];
      else if (path.endsWith("/reports"))
        data = {
          periods: [period],
          sales: [],
          payments: [],
          movements: [],
          dips: [],
          audits: [],
          salesByNozzleShift: [],
          companyVehicleConsumption: [],
          exposure: [],
          warning: "TEST ONLY REPORT",
        };
      else if (path.endsWith("/stations/TEST-STATION"))
        data = {
          station,
          tanks: [
            {
              _id: "TEST-TANK",
              code: "TEST-T1",
              name: "TEST ONLY TANK",
              fuelType: "diesel",
              bookMl: 1000000,
              capacityMl: 2000000,
              openingEstablished: true,
            },
          ],
          nozzles: [
            {
              _id: "TEST-NOZZLE",
              pumpCode: "TEST-P1",
              code: "TEST-N1",
              fuelType: "diesel",
              active: true,
              lastClosingMl: 0,
              meterPrecision: 3,
            },
          ],
          prices: [],
          periods: [period],
          sales: [],
          movements: [],
          dips: [],
          payments: [],
        };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto("http://127.0.0.1:5174/server/test/fuel-ui.html");
    await page
      .getByRole("heading", { name: "Fuel Station Operations" })
      .waitFor();
    await page.getByText("TEST ONLY PERIOD", { exact: true }).waitFor();
    const fuelToggle = page.getByRole("button", { name: "Fuel Station", exact: true });
    assert.equal(await fuelToggle.getAttribute("aria-expanded"), "false");
    await fuelToggle.click();
    assert.equal(await fuelToggle.getAttribute("aria-expanded"), "true");
    assert.equal(await page.getByRole("list", { name: "Fuel Station sections" }).getByRole("button").count(), 12);
    await fuelToggle.click();
    assert.equal(await page.getByRole("button", { name: "Fuel Sales", exact: true }).isVisible(), false);
    await fuelToggle.click();

    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "page must fit viewport",
    );
    await page.getByRole("button", { name: "Inter-station Fuel", exact: true }).click();
    await page.getByRole("heading", { name: "Fuel owed and fuel receivable" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Inter-station Fuel", exact: true }).getAttribute("aria-current"), "page");
    assert.equal(await page.getByLabel("Station", { exact: true }).inputValue(), "TEST-STATION");

    await page.getByRole("button", { name: "+ Record fuel loan", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel(/^Confirmed litres delivered(?: \*)?$/).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Fuel Sales", exact: true }).click();
    await page
      .getByLabel("Company account", { exact: true })
      .selectOption(company._id);
    await page
      .getByText("Available credit GH₵ 900.00", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "+ Fuel Purchase", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    assert.ok(
      await page
        .getByRole("dialog")
        .getByText(
          "Any amount not paid now or prepaid becomes company credit.",
          { exact: false },
        )
        .count(),
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Statements and Invoices", exact: true })
      .click();
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Print / PDF", exact: true })
      .click();
    const download = await downloading;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.ok(
      Buffer.concat(chunks).subarray(0, 5).equals(Buffer.from("%PDF-")),
      "PDF export must produce a real PDF",
    );
    for (const name of [
      "Meter Readings",
      "Shift Reconciliation",
      "Company Accounts",
      "Vehicles and Drivers",
      "Payments",
      "Statements and Invoices",
      "Tanks and Stock",
      "Reports",
      "Integration Settings",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        name + " must fit viewport",
      );
    }
    await page
      .getByRole("button", { name: "Meter Readings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Open period", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({
      path: `/tmp/admabs-fuel-ui-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    needsPreparation = true;
    await page.reload();
    await page.getByRole("button", { name: "Prepare fuel module", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "+ Station", exact: true }).isEnabled(), false);
    await page.getByRole("button", { name: "Prepare fuel module", exact: true }).click();
    await page.getByRole("button", { name: "Create 20 demo purchases", exact: true }).waitFor({state: "visible"});
    await page.getByRole("button", { name: "Create 20 demo purchases", exact: true }).click();
    await page.getByRole("dialog", { name: "Create fuel training records", exact: true }).waitFor();
    const demoSave = page.getByRole("dialog").getByRole("button", { name: "Save record", exact: true });
    assert.equal(await demoSave.isEnabled(), false);
    await page.getByRole("checkbox", { name: "I confirm creation of fictional fuel training records", exact: true }).check();
    await demoSave.click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(demoPayload, { confirmation: "CREATE TEST FUEL DATA" });
    await page.getByRole("button", { name: "Add 50 scenario purchases per station", exact: true }).click();
    const scenarioSave = page.getByRole("dialog").getByRole("button", { name: "Save record", exact: true });
    assert.equal(await scenarioSave.isEnabled(), false);
    await page.getByRole("checkbox", { name: "I confirm adding fictional scenarios to the training stations", exact: true }).check();
    await scenarioSave.click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(scenarioPayload, { confirmation: "CREATE TEST FUEL DATA" });
    assert.equal(await page.getByRole("button", { name: "Add 50 scenario purchases per station", exact: true }).count(), 0);
    await page.getByText("Training scenario pack: starting figures and practice steps", { exact: true }).click();
    await page.getByText("TEST ONLY starting scenario figures", { exact: true }).waitFor();

    assert.deepEqual(errors, []);
    console.log(
      `PASS ${viewport.width}px: all navigation tabs, company exposure, sale/opening forms, no page errors or page overflow`,
    );
    // Verify the real application shells, not just the standalone fuel view.
    await page.route("**/api/**", route => {
      if (route.request().url().includes("/fuel/operations/")) return route.fallback();
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith("/auth/me") ? { user: { _id: "TEST-USER", role: "super_admin", name: "TEST ONLY Owner", active: true } }
        : path.endsWith("/sessions/heartbeat") ? { serverTime: new Date().toISOString() } : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.evaluate(() => {
      const user = JSON.stringify({ _id: "TEST-USER", role: "super_admin", name: "TEST ONLY Owner", active: true });
      localStorage.setItem("admabs_token", "TEST-ONLY");
      localStorage.setItem("admabs_session_user", user);
      localStorage.setItem("admabs_active_module", "fuel");
      localStorage.setItem("admabs_mobile_token", "TEST-ONLY");
      localStorage.setItem("admabs_mobile_user", user);
      localStorage.setItem("admabs_mobile_screen", "fuel");
    });
    const shell = viewport.width > 880 ? "desktop" : "mobile";
    await page.goto(`http://127.0.0.1:5174/server/test/fuel-ui.html?shell=${shell}`);
    await page.getByRole("heading", { name: "Fuel Station Operations", exact: true }).waitFor();
    if (shell === "mobile") await page.getByRole("button", { name: /More$/ }).click();
    const shellToggle = page.getByRole("button", { name: "Fuel Station", exact: true });
    if (await shellToggle.getAttribute("aria-expanded") === "false") await shellToggle.click();
    const sections = page.getByRole("list", { name: "Fuel Station sections" });
    assert.equal(await sections.getByRole("button").count(), 12);
    const names = await sections.getByRole("button").allTextContents();
    for (const name of names) {
      if (shell === "mobile" && !await sections.isVisible()) await page.getByRole("button", { name: /More$/ }).click();
      await sections.getByRole("button", { name, exact: true }).click();
      await page.getByRole("heading", { name, exact: true }).first().waitFor();
      assert.equal(await page.getByLabel("Station", { exact: true }).inputValue(), "TEST-STATION");
    }
    if (shell === "mobile") await page.getByRole("button", { name: /More$/ }).click();
    await shellToggle.click();
    assert.equal(await sections.isVisible(), false);
    await shellToggle.click();
    if (shell === "desktop") {
      await page.getByRole("button", { name: "Collapse", exact: true }).click();
      assert.equal(await sections.isVisible(), false);
      await shellToggle.click();
      assert.equal(await sections.isVisible(), true);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${shell}: twelve sidebar sections, active section and station retained, collapse/reopen`);
    await page.context().addInitScript(() => { window.print = () => { document.body.dataset.printed = "true"; }; });
    await page.goto("http://127.0.0.1:5174/server/test/fuel-ui.html?shell=documents");
    const brandedDownload = page.waitForEvent("download");
    await page.getByRole("button", {name:"Download branded fixture",exact:true}).click();
    const brandedFile = await brandedDownload, brandedChunks=[];
    const brandedStream = await brandedFile.createReadStream(); for await(const chunk of brandedStream)brandedChunks.push(chunk);
    const brandedBytes=Buffer.concat(brandedChunks).toString("latin1");
    const pages=Number(await page.locator("body").getAttribute("data-pdf-pages"));
    assert.ok(pages>=3,"long descriptions must paginate");
    assert.ok((brandedBytes.match(/TEST COMPANY LTD/g)||[]).length>=pages,"company name repeats on every PDF page");
    assert.ok((brandedBytes.match(/DOCUMENT PAGINATION CHECK/g)||[]).length>=pages,"document title repeats on every PDF page");
    assert.ok(brandedBytes.includes(`Page ${pages} of ${pages}`),"last PDF page is numbered");
    const popupEvent=page.waitForEvent("popup");
    await page.getByRole("button",{name:"Print branded fixture",exact:true}).click();
    const printed=await popupEvent;
    await printed.locator('body[data-printed="true"]').waitFor();
    assert.equal(await printed.locator(".document-brand strong").innerText(),"TEST COMPANY LTD");
    const printedText=await printed.locator("body").innerText();
    assert.ok(printedText.includes("TEST INVOICE 123"));
    assert.ok(printedText.includes("2026-11-07"));
    assert.ok(!printedText.includes("DO NOT PRINT"),"application menus and buttons stay out of printed documents");
    assert.equal(await printed.locator("[data-company-letterhead]").count(),0,"no duplicate letterhead inside printed content");
    await printed.close();
    console.log(`PASS ${viewport.width}px: branded multipage PDFs and isolated receipt print preview`);
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  vite.kill("SIGTERM");
}
