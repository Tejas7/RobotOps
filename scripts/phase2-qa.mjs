import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.ROBOTOPS_WEB_URL ?? "http://localhost:3000";
const EMAIL = process.env.ROBOTOPS_EMAIL ?? "owner@demo.com";
const PASSWORD = process.env.ROBOTOPS_PASSWORD ?? "password123";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  const record = (id, ok, details) => {
    report.checks.push({ id, ok, details });
  };

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/overview/, { timeout: 10000, waitUntil: "domcontentloaded" });

    assert(await page.getByRole("heading", { name: "Overview" }).count(), "Overview did not render after login.");

    // P2-QA-01: Save a view from top header.
    await page.getByRole("button", { name: /Save view/i }).click();
    await page.waitForTimeout(500);
    const savedViewOptions = page.locator('select[aria-label="Saved views"] option');
    assert((await savedViewOptions.count()) >= 1, "Saved view selector did not render options.");
    record("P2-QA-01", true, "Saved view controls rendered and save action executed.");

    // P2-QA-02: Fleet telemetry controls + csv download action.
    await page.goto(`${BASE_URL}/fleet`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/fleet/, { timeout: 10000 });
    await page.locator("tbody tr").first().click();
    await page.getByRole("button", { name: "Telemetry", exact: true }).click();
    await page.locator('select').last().selectOption("6h");
    await page.getByRole("button", { name: /Download CSV/i }).click();
    assert(await page.getByText(/rendered points/i).count(), "Telemetry panel did not render downsample metadata.");
    record("P2-QA-02", true, "Telemetry metric/range controls and CSV export control rendered.");

    // P2-QA-03: Facility playback scrubber + robot path metadata.
    await page.goto(`${BASE_URL}/facility`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/facility/, { timeout: 10000 });
    const scrubber = page.locator('input[type="range"]').first();
    await scrubber.fill("35");
    assert((await page.getByText(/Playback: 35%/i).count()) > 0, "Facility playback scrubber text did not update.");
    record("P2-QA-03", true, "Facility playback controls update with selected percentage.");

    // P2-QA-04: Integrations create + test flow.
    await page.goto(`${BASE_URL}/integrations`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Connector name").fill("QA Connector");
    await page.getByRole("button", { name: /Create connector/i }).click();
    await page.waitForTimeout(700);
    const integrationCards = page.locator("button:has-text('Test connection')");
    assert((await integrationCards.count()) > 0, "Integration catalog did not render connector actions.");
    await page.getByRole("button", { name: /Test connection/i }).first().click();
    record("P2-QA-04", true, "Integrations create and test-connection actions executed.");

    // P2-QA-05: Developer audit explorer + diff.
    await page.goto(`${BASE_URL}/developer`, { waitUntil: "domcontentloaded" });
    const auditRows = page.locator("tbody tr");
    if ((await auditRows.count()) > 0) {
      await auditRows.first().click();
    }
    assert((await page.getByText(/Audit diff/i).count()) > 0, "Developer audit diff panel did not render.");
    record("P2-QA-05", true, "Developer audit explorer and diff panel render.");

    // P2-QA-06: Settings validation flow.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Validate" }).click();
    await page.waitForTimeout(300);
    assert((await page.locator("textarea").count()) > 0, "Settings editor did not render.");
    record("P2-QA-06", true, "Settings validation action executed and editor remained interactive.");

    // P2-QA-07: Analytics full page load + export actions.
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: "domcontentloaded" });
    assert((await page.getByRole("heading", { name: "Analytics" }).count()) > 0, "Analytics page did not render.");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    record("P2-QA-07", true, "Analytics page rendered and export action fired.");

    // P2-QA-08: Incidents automation hooks shows integration status cards.
    await page.goto(`${BASE_URL}/incidents`, { waitUntil: "domcontentloaded" });
    await page.locator("tbody tr").first().click();
    assert((await page.getByText(/Automation hooks/i).count()) > 0, "Incident detail automation hooks panel missing.");
    record("P2-QA-08", true, "Incident detail shows automation integration statuses.");

    // P2-QA-09: Accessibility smoke (critical/serious blockers).
    const a11yPages = ["/overview", "/analytics", "/settings", "/integrations"];
    for (const route of a11yPages) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blockers = results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));
      assert(blockers.length === 0, `${route}: accessibility blockers found (${blockers.length}).`);
    }
    record("P2-QA-09", true, "A11y smoke check passed for key Phase 2 routes.");

    console.log(JSON.stringify({ ok: true, report }, null, 2));
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error), report }, null, 2));
    await browser.close();
    process.exit(1);
  }
}

void run();
