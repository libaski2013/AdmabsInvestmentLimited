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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/fuel/operations/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith("/bootstrap"))
        data = {
          stations: [station],
          outlets: [],
          permissions,
          transactionsSupported: true,
          schemaReady: true,
        };
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
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "page must fit viewport",
    );
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
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${viewport.width}px: all navigation tabs, company exposure, sale/opening forms, no page errors or page overflow`,
    );
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  vite.kill("SIGTERM");
}
