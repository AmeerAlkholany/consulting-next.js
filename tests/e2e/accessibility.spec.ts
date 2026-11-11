import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("WCAG 2.2 AA Automated Accessibility Checks (Step 20)", () => {
  const publicRoutes = [
    { name: "Home Landing", path: "/" },
    { name: "Consultants Directory", path: "/consultants" },
    { name: "Login Page", path: "/login" },
    { name: "Registration Page", path: "/register" },
    { name: "Crisis Resources", path: "/crisis-resources" },
  ];

  for (const route of publicRoutes) {
    test(`route ${route.name} (${route.path}) passes axe WCAG 2.2 AA audit with zero critical/serious violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      expect(
        seriousOrCritical,
        `Expected 0 critical/serious a11y violations on ${route.path}, found:\n${JSON.stringify(
          seriousOrCritical.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
          })),
          null,
          2,
        )}`,
      ).toEqual([]);
    });
  }

  test("skip-to-content link is the first focusable interactive element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const activeText = await page.evaluate(() => document.activeElement?.textContent);
    expect(activeText?.trim()).toBe("Skip to main content");

    const activeHref = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    expect(activeHref).toBe("#main-content");
  });
});
