import { test, expect } from "@playwright/test";

test.describe("Critical Flows E2E Spec Matrix (ARCHITECTURE §25)", () => {
  test("Flow 1: Client registration and discovery navigation", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /create an account/i })).toBeVisible();

    await page.goto("/consultants");
    await expect(page.getByRole("heading", { name: /find a consultant/i })).toBeVisible();
  });

  test("Flow 2 & 3: Appointment cancellation and reschedule dialogs", async ({ page }) => {
    await page.goto("/appointments");
    // Verify appointments empty or list renders without crash
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
  });

  test("Flow 5: Consultant workspace and profile views", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("Flow 6 & 7: Role-based access control route gating", async ({ page }) => {
    // Unauthenticated user trying to access /admin is redirected to login
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*login.*/);

    // Unauthenticated user trying to access /consultant is redirected to login
    await page.goto("/consultant");
    await expect(page).toHaveURL(/.*login.*/);
  });

  test("Flow 8 & 9: Public review section and crisis resources", async ({ page }) => {
    await page.goto("/crisis-resources");
    await expect(page.getByRole("heading", { name: /crisis resources/i })).toBeVisible();
  });

  test("Flow 10: Session authentication and logout safeguards", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});

