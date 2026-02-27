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

async function text(locator) {
  return (await locator.textContent())?.trim() ?? "";
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

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
    await page.waitForTimeout(800);

    let signedIn = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByRole("button", { name: "Continue" }).click();
      try {
        await page.waitForURL(/\/overview/, { timeout: 10000, waitUntil: "domcontentloaded" });
        signedIn = true;
        break;
      } catch {
        if ((await page.getByText("Invalid credentials", { exact: false }).count()) > 0) {
          break;
        }
        await page.waitForTimeout(900);
      }
    }

    assert(signedIn, "Login did not navigate to /overview.");

    assert(await page.getByRole("heading", { name: "Overview" }).count(), "Overview did not render after login.");

    // QA-005: Overview filters and widget refresh smoke.
    const summary = page.locator("div.mb-6 p").first();
    assert(await summary.count(), "Overview summary text missing.");

    const timeRangeSelect = page.locator("header select").nth(1);
    await timeRangeSelect.selectOption("1h");
    await page.waitForTimeout(500);
    const selectedRange1h = await timeRangeSelect.inputValue();
    assert(selectedRange1h === "1h", `Time range select value did not change to 1h (got ${selectedRange1h}).`);

    await timeRangeSelect.selectOption("7d");
    await page.waitForTimeout(500);
    const selectedRange7d = await timeRangeSelect.inputValue();
    assert(selectedRange7d === "7d", `Time range select value did not change to 7d (got ${selectedRange7d}).`);

    const kpiCards = page.locator("section a, section div", { hasText: "Active robots" });
    assert((await kpiCards.count()) > 0, "Active robots KPI not visible.");

    record("QA-005", true, "Overview rendered, KPI visible, and time-range selector updates without runtime errors.");

    // QA-006: Fleet filters + robot drawer tabs.
    await page.getByRole("link", { name: /Active robots/i }).click();
    await page.waitForURL(/\/fleet/, { timeout: 20000 });
    assert(await page.getByRole("heading", { name: "Fleet" }).count(), "Fleet page did not load.");

    const statusFilter = page.locator("select").nth(2);
    await statusFilter.selectOption("online");
    await page.waitForTimeout(600);

    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    assert(rowCount > 0, "Fleet table returned no rows after status filter.");

    await rows.first().click();

    const tabAssertions = [
      ["Summary", "Robot summary"],
      ["Telemetry", "Telemetry time series"],
      ["Logs", "Structured logs"],
      ["Missions", "Mission history"],
      ["Controls", "Safe controls"],
      ["Diagnostics", "Diagnostics"],
      ["Audit", "Audit trail"]
    ];

    for (const [tab, expectedText] of tabAssertions) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(200);
      assert(await page.getByText(expectedText, { exact: false }).count(), `Fleet tab ${tab} missing expected content.`);
    }

    record("QA-006", true, `Fleet status filter returned ${rowCount} row(s), drawer opened, and all tabs rendered expected sections.`);

    // QA-009: Facility layers and toggles.
    await page.goto(`${BASE_URL}/facility`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/facility/, { timeout: 20000 });
    assert(await page.getByRole("heading", { name: "Facility" }).count(), "Facility page did not load.");

    const zoneToggle = page.locator('label:has-text("Zones") input[type="checkbox"]');
    const robotToggle = page.locator('label:has-text("Robots") input[type="checkbox"]');
    const assetToggle = page.locator('label:has-text("RTLS assets") input[type="checkbox"]');
    const proximityToggle = page.locator('label:has-text("Proximity events") input[type="checkbox"]');

    await zoneToggle.uncheck();
    await robotToggle.uncheck();
    await assetToggle.uncheck();
    await proximityToggle.uncheck();
    await page.waitForTimeout(300);

    assert((await page.getByRole("heading", { name: "Proximity events" }).count()) === 0, "Proximity card should be hidden when toggle is off.");

    await zoneToggle.check();
    await robotToggle.check();
    await assetToggle.check();
    await proximityToggle.check();
    await page.waitForTimeout(300);

    assert((await page.getByRole("heading", { name: "Proximity events" }).count()) > 0, "Proximity card should be visible when toggle is on.");

    const scrubber = page.locator('input[type="range"]').first();
    await scrubber.fill("25");
    assert((await page.getByText("Playback position: 25%", { exact: false }).count()) > 0, "Playback scrubber did not update displayed position.");

    record("QA-009", true, "Facility layer toggles and playback scrubber responded correctly.");

    // QA-012: Accessibility smoke checks (critical/serious + keyboard focus).
    const a11yPages = [
      { route: "/overview", name: "overview" },
      { route: "/fleet", name: "fleet" },
      { route: "/facility", name: "facility" }
    ];

    const a11yDetails = [];

    for (const entry of a11yPages) {
      await page.goto(`${BASE_URL}${entry.route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);

      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const activeTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? "none");
      assert(activeTag !== "body", `${entry.name}: keyboard focus did not move to interactive controls.`);

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blockers = results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));

      a11yDetails.push({
        page: entry.name,
        totalViolations: results.violations.length,
        blockers: blockers.length,
        blockerIds: blockers.map((violation) => violation.id)
      });

      const blockerSummary = blockers
        .map((violation) => {
          const firstTarget = violation.nodes[0]?.target?.join(", ") ?? "unknown-target";
          return `${violation.id}@${firstTarget}`;
        })
        .join(" | ");

      assert(
        blockers.length === 0,
        `${entry.name}: found ${blockers.length} serious/critical accessibility violations. ${blockerSummary}`
      );
    }

    record("QA-012", true, `Axe smoke checks passed without serious/critical issues: ${JSON.stringify(a11yDetails)}`);

    if (pageErrors.length > 0) {
      throw new Error(`Runtime page errors detected: ${pageErrors.join(" | ")}`);
    }

    console.log(JSON.stringify({ ok: true, report }, null, 2));
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error), report, pageErrors }, null, 2));
    await browser.close();
    process.exit(1);
  }
}

void run();
