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

    // P3-QA-01: all-sites mode can be activated through URL-driven global filter.
    await page.goto(`${BASE_URL}/overview?site_id=all`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    assert(page.url().includes("site_id=all"), "All-sites URL filter did not persist.");
    record("P3-QA-01", true, "All-sites mode can be activated via global URL filter.");

    // P3-QA-02: analytics cross-site rendering + export actions.
    await page.goto(`${BASE_URL}/analytics?site_id=all`, { waitUntil: "domcontentloaded" });
    assert((await page.getByText(/Cross-site comparison/i).count()) > 0, "Cross-site comparison card missing on analytics page.");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    await page.getByRole("button", { name: /Export PDF summary/i }).click();
    record("P3-QA-02", true, "Analytics all-sites mode and export actions rendered.");

    // P3-QA-03: settings RBAC + alerting workflow smoke.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
    assert((await page.getByText(/Role scope matrix/i).count()) > 0, "Role scope matrix section missing.");
    await page.getByRole("button", { name: /Apply override/i }).click();
    await page.getByRole("button", { name: /Create policy/i }).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /^Create rule$/i }).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /Test route/i }).click();
    record("P3-QA-03", true, "Settings RBAC overrides and alert policy/rule/test controls executed.");

    // P3-QA-04: incidents alert escalation timeline panel.
    await page.goto(`${BASE_URL}/incidents`, { waitUntil: "domcontentloaded" });
    await page.locator("tbody tr").first().click();
    assert((await page.getByText(/Alert escalation timeline/i).count()) > 0, "Incident alert escalation timeline panel missing.");
    record("P3-QA-04", true, "Incident detail shows alert escalation timeline.");

    // P3-QA-05: developer pipeline status + alerts channel logs.
    await page.goto(`${BASE_URL}/developer`, { waitUntil: "domcontentloaded" });
    assert((await page.getByText(/Pipeline status/i).count()) > 0, "Developer pipeline status panel missing.");
    assert((await page.getByText(/NATS/i).count()) > 0, "Developer pipeline status did not include NATS tile.");
    record("P3-QA-05", true, "Developer pipeline status panel rendered.");

    // P3-QA-06: accessibility smoke.
    const a11yPages = ["/analytics?site_id=all", "/settings", "/incidents", "/developer"];
    for (const route of a11yPages) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blockers = results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));
      const blockerSummary = blockers.map((blocker) => ({
        id: blocker.id,
        impact: blocker.impact,
        help: blocker.help,
        nodes: blocker.nodes.slice(0, 3).map((node) => ({
          target: node.target,
          summary: node.failureSummary
        }))
      }));
      assert(
        blockers.length === 0,
        `${route}: accessibility blockers found (${blockers.length}). details=${JSON.stringify(blockerSummary)}`
      );
    }
    record("P3-QA-06", true, "A11y smoke passed for key Phase 3 routes.");

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
