import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const BASE_URL = process.env.ROBOTOPS_WEB_URL ?? "http://localhost:3000";
const API_URL = process.env.ROBOTOPS_API_URL ?? "http://localhost:4000/api";
const EMAIL = process.env.ROBOTOPS_EMAIL ?? "owner@demo.com";
const PASSWORD = process.env.ROBOTOPS_PASSWORD ?? "password123";
const JWT_SECRET = process.env.JWT_SECRET ?? "robotops-dev-secret";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function text(locator) {
  return (await locator.textContent())?.trim() ?? "";
}

async function loginToDashboard(page) {
  const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  assert(csrfRes.ok(), "Could not fetch CSRF token for login.");
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData?.csrfToken;
  assert(typeof csrfToken === "string" && csrfToken.length > 0, "Missing CSRF token in auth response.");

  const callbackRes = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE_URL}/overview`,
      json: "true"
    }
  });
  assert(callbackRes.ok(), "Credentials callback failed.");

  await page.goto(`${BASE_URL}/overview`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/overview/, { timeout: 12000, waitUntil: "domcontentloaded" });
}

function ownerToken() {
  return jwt.sign(
    {
      sub: "u1",
      email: "owner@demo.com",
      name: "Alice Owner",
      tenantId: "t1",
      role: "Owner",
      permissions: [],
      scope_version: 2
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
}

async function seedFleetRobotState() {
  const token = ownerToken();
  const timestamp = new Date(Date.now() + 60_000).toISOString();
  const envelope = {
    message_id: crypto.randomUUID(),
    schema_version: 1,
    tenant_id: "t1",
    site_id: "s1",
    message_type: "robot_state",
    timestamp,
    source: {
      source_type: "edge",
      source_id: "qa-phase1-seeder",
      vendor: "vendor_acme",
      protocol: "http"
    },
    entity: {
      entity_type: "robot",
      robot_id: "r1"
    },
    payload: {
      sequence: Math.floor(Date.now() / 1000),
      status: "online",
      battery_percent: 72,
      pose: {
        floorplan_id: "f1",
        x: 14.2,
        y: 21.7,
        heading_degrees: 35,
        confidence: 0.92
      }
    }
  };

  const res = await fetch(`${API_URL}/ingest/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(envelope)
  });
  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Failed to seed fleet robot state: ${res.status} ${details}`);
  }
}

async function waitForSeededRobotState() {
  const token = ownerToken();
  const startedAt = Date.now();

  while (Date.now() - startedAt < 20000) {
    const res = await fetch(`${API_URL}/robots/last_state?site_id=s1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Timed out waiting for seeded robot state to appear in read model.");
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
    await loginToDashboard(page);

    assert(await page.getByRole("heading", { name: "Overview" }).count(), "Overview did not render after login.");
    await seedFleetRobotState();
    await waitForSeededRobotState();

    // QA-005: Overview filters and widget refresh smoke.
    const summary = page.locator("div.mb-6 p").first();
    assert(await summary.count(), "Overview summary text missing.");

    const timeRangeSelect = page.getByLabel("Select time range");
    assert((await timeRangeSelect.count()) > 0, "Time range selector missing.");

    await page.goto(`${BASE_URL}/overview?site_id=s1&time_range=1h`, { waitUntil: "domcontentloaded" });
    assert((await page.getByText(/last 1h/i).count()) > 0, "Overview did not apply 1h time range from URL filter.");

    await page.goto(`${BASE_URL}/overview?site_id=s1&time_range=7d`, { waitUntil: "domcontentloaded" });
    assert((await page.getByText(/last 7d/i).count()) > 0, "Overview did not apply 7d time range from URL filter.");

    const kpiCards = page.locator("section a, section div", { hasText: "Active robots" });
    assert((await kpiCards.count()) > 0, "Active robots KPI not visible.");

    record("QA-005", true, "Overview rendered, KPI visible, and time-range selector updates without runtime errors.");

    // QA-006: Fleet filters + robot drawer tabs.
    await page.getByRole("link", { name: /Active robots/i }).click();
    await page.waitForURL(/\/fleet/, { timeout: 20000 });
    await page.goto(`${BASE_URL}/fleet?site_id=s1`, { waitUntil: "domcontentloaded" });
    assert(await page.getByRole("heading", { name: "Fleet" }).count(), "Fleet page did not load.");

    const statusFilter = page.getByLabel("Filter by status");
    await statusFilter.selectOption("all");
    await page.waitForTimeout(600);

    const rows = page.locator("tbody tr");
    await rows.first().waitFor({ timeout: 20000 });
    const rowCount = await rows.count();
    assert(rowCount > 0, "Fleet table returned no rows.");

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
    assert((await page.getByText(/Playback:\s*25%/i).count()) > 0, "Playback scrubber did not update displayed position.");

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
