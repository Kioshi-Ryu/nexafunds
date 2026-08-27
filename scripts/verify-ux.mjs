import { chromium } from "playwright";

const baseUrl = "http://localhost:3000";
const email = `ux-check-${Date.now()}@example.test`;
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Create an account" }).click();
await page.getByLabel("Full name").fill("UX Review");
await page.getByLabel("Email address").fill(email);
await page.getByLabel("Password").fill("ux-review-2026");
await page.getByRole("button", { name: "Create account" }).click();
await page.getByRole("button", { name: "Budgets" }).click();
await page.getByRole("button", { name: "Create budget" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/ubuntu/ux-budget-modal-desktop.png", fullPage: true });
await page.getByLabel(/Monthly limit/).fill("450");
await page.getByRole("button", { name: "Create budget" }).last().click();
await page.getByText("Groceries").or(page.getByText("Food & dining")).first().waitFor({ timeout: 8000 });
await page.screenshot({ path: "/home/ubuntu/ux-budgets-desktop.png", fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".mobile-menu").click();
await page.getByRole("button", { name: "Budgets" }).click();
await page.getByRole("button", { name: "Create budget" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/ubuntu/ux-budget-modal-mobile.png", fullPage: true });

console.log("UX_BROWSER_FLOW_OK");
await browser.close();
