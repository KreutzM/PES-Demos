import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function capture(page: import("@playwright/test").Page, project: string, name: string) {
  await mkdir("screenshots/previews", { recursive: true });
  await page.screenshot({ path: `screenshots/${project}-${name}.png`, fullPage: true, animations: "disabled" });
  await page.screenshot({
    path: `screenshots/previews/${project}-${name}.jpg`,
    type: "jpeg",
    quality: 55,
    animations: "disabled",
  });
}

test("Landingpage und Timer-Labor sind erreichbar und sichtbar", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/PES-Demos/");
  await expect(page.locator(".hero h1")).toContainText("Hardware verstehen");
  await expect(page.getByRole("link", { name: /Timer & PWM entdecken/ })).toBeVisible();
  await capture(page, info.project.name, "landing");

  await page.getByRole("link", { name: /Timer & PWM entdecken/ }).click();
  await expect(page.getByRole("heading", { name: "Timer & PWM" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Woher bekommt der Timer seinen Takt?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warum immer „+ 1“?" })).toBeVisible();
  await capture(page, info.project.name, "timer-overview");
  expect(errors, "Keine ungefangenen Browser-JavaScriptfehler").toEqual([]);
});

test("Taktbaum: TIM2 zunächst halb so schnell, mit TIMPRE wieder gleich schnell", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: /1 Hz · Blinken/ }).click();
  await expect(page.locator(".metric.featured strong")).toHaveText("1 Hz");
  await page.locator("#timer").selectOption("TIM2");
  await expect(page.locator(".metric.featured strong")).toHaveText("0,5 Hz");
  await page.locator(".clock-checkbox input").check();
  await expect(page.locator(".metric.featured strong")).toHaveText("1 Hz");
  await page.locator(".clock-tree-panel").scrollIntoViewIfNeeded();
  await capture(page, info.project.name, "clock-tree");
});

test("Vier TIMxCLK-Flanken bei PSC=3 ergeben erst einen CNT-Tick", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: /Beispiel: PSC = 3/ }).click();
  const cnt = page.locator(".counter-number");
  const phase = page.locator(".divider-phase-number strong");
  const step = page.getByRole("button", { name: "+1 TIMxCLK-Flanke" });

  await expect(cnt).toHaveText("0");
  await expect(phase).toHaveText("0 / 4");
  for (let i = 1; i <= 3; i++) {
    await step.click();
    await expect(cnt).toHaveText("0");
    await expect(phase).toHaveText(`${i} / 4`);
  }
  await page.locator(".divider-interactive").scrollIntoViewIfNeeded();
  await capture(page, info.project.name, "prescaler-before-tick");

  await step.click();
  await expect(cnt).toHaveText("1");
  await expect(phase).toHaveText("0 / 4");
  await expect(page.locator(".divider-psc-status")).toContainText("CNT-Tick erzeugt");
  await page.getByRole("button", { name: /Nächster CNT-Tick/ }).click();
  await expect(cnt).toHaveText("2");
  await capture(page, info.project.name, "prescaler-after-tick");
});

test("Keine horizontale Überbreite bei Desktop- und Mobilansicht", async ({ page }) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await expect(page.locator(".divider-lab")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
});
