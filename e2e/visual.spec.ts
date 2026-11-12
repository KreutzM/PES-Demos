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
  await expect(page.getByRole("heading", { name: /Warum teilt PSC = 3/ })).toBeVisible();
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Woher bekommt der Timer seinen Takt?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warum immer „+ 1“?" })).toBeVisible();
  await capture(page, info.project.name, "timer-overview");
  expect(errors, "Keine ungefangenen Browser-JavaScriptfehler").toEqual([]);
});

test("Taktbaum: TIM2 zunächst halb so schnell, mit TIMPRE wieder gleich schnell", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await page.getByRole("button", { name: /1 Hz · Blinken/ }).click();
  await expect(page.locator(".metric.featured strong")).toHaveText("1 Hz");
  await page.locator("#timer").selectOption("TIM2");
  await expect(page.locator(".metric.featured strong")).toHaveText("0,5 Hz");
  await page.locator(".clock-checkbox input").check();
  await expect(page.locator(".metric.featured strong")).toHaveText("1 Hz");
  await page.locator(".clock-tree-panel").scrollIntoViewIfNeeded();
  await capture(page, info.project.name, "clock-tree");
});

test("Vier Eingangstaktimpulse bei PSC=3 ergeben erst einen CNT-Zählschritt", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  const upperButton = page.getByRole("button", { name: /Beispiel: PSC = 3/ });
  await expect(upperButton.locator(".divider-preset-warning")).toBeVisible();
  await expect(upperButton).toContainText("zurückgesetzt");
  await upperButton.click();
  const cnt = page.locator(".counter-number");
  const phase = page.locator(".divider-phase-number strong");
  const step = page.getByRole("button", { name: "+1 Eingangstaktimpuls" });

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
  await expect(page.locator(".divider-psc-status")).toContainText("CNT-Zählschritt erzeugt");
  await page.getByRole("button", { name: /nächsten CNT-Zählschritt/ }).click();
  await expect(cnt).toHaveText("2");
  await capture(page, info.project.name, "prescaler-after-tick");
});

test("Keine horizontale Überbreite bei Desktop- und Mobilansicht", async ({ page }) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await expect(page.locator(".divider-lab")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
});

test("Isolierte ARR-Änderung lässt CCR2 stabil; CCR2 über ARR erzeugt 100 % ohne Abschaltflanke", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await expect(page.locator("#arr")).toHaveValue("9");
  await expect(page.locator("#ccr")).toHaveValue("3");
  await page.locator("#arr").fill("19");
  await expect(page.locator("#ccr")).toHaveValue("3");
  await expect(page.locator("label[for='duty']")).toContainText("15,0 %");
  await expect(page.locator(".divider-equations")).toContainText("15 %");
  await capture(page, info.project.name, "arr-isolated-change");

  await page.locator("#arr").fill("9");
  await page.locator("#ccr").fill("12");
  await expect(page.locator("#ccr")).toHaveValue("12");
  await expect(page.locator("label[for='duty']")).toContainText("100,0 %");
  await expect(page.getByRole("button", { name: /Zur Abschaltschwelle/ })).toBeDisabled();
  await expect(page.locator(".register-compare-note")).toContainText("100 %");
  await expect(page.locator(".timeline-hint")).toContainText("keine Abschaltschwelle");
  await capture(page, info.project.name, "ccr-greater-than-arr");
});

test("Voreinstellung beschreibt Nebenwirkungen und stellt Timer, RCC, Register, Zählerstand wieder her", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await page.locator("#timer").selectOption("TIM2");
  const apb1 = page.locator(".clock-controls .clock-select").nth(2).locator("select");
  const apb2 = page.locator(".clock-controls .clock-select").nth(3).locator("select");
  await apb1.selectOption("8");
  await apb2.selectOption("4");
  await page.locator(".clock-checkbox input").check();
  await page.locator("#psc").fill("7");
  await page.locator("#arr").fill("19");
  await page.locator("#ccr").fill("12");
  await page.locator(".transport-buttons").getByRole("button", { name: "+1 CNT-Zählschritt" }).click();
  await page.getByRole("button", { name: "+1 Eingangstaktimpuls" }).click();
  await expect(page.locator(".counter-number")).toHaveText("1");
  await expect(page.locator(".divider-phase-number strong")).toHaveText("1 / 8");

  const presetWarning = page.locator(".preset-effects");
  const firstPreset = page.locator(".preset-buttons button").first();
  await expect(presetWarning).toBeVisible();
  const [warningRect, presetRect] = await Promise.all([presetWarning.boundingBox(), firstPreset.boundingBox()]);
  expect(warningRect && presetRect && warningRect.y + warningRect.height <= presetRect.y + 2).toBeTruthy();
  await expect(presetWarning).toContainText("RCC-Praktikumsprofil");
  await page.getByRole("button", { name: /1 Hz · Blinken/ }).click();
  await expect(page.locator("#timer")).toHaveValue("TIM1");
  await expect(page.locator("#psc")).toHaveValue("16799");
  await expect(page.locator("#arr")).toHaveValue("9999");
  await expect(page.locator("#ccr")).toHaveValue("5000");
  await expect(page.locator(".counter-number")).toHaveText("0");
  await expect(page.locator(".preset-status")).toContainText("geladen");
  await capture(page, info.project.name, "preset-loaded");

  await page.getByRole("button", { name: /Vorherige Konfiguration wiederherstellen/ }).click();
  await expect(page.locator("#timer")).toHaveValue("TIM2");
  await expect(page.locator("#psc")).toHaveValue("7");
  await expect(page.locator("#arr")).toHaveValue("19");
  await expect(page.locator("#ccr")).toHaveValue("12");
  await expect(page.locator(".counter-number")).toHaveText("1");
  await expect(apb1).toHaveValue("8");
  await expect(apb2).toHaveValue("4");
  await expect(page.locator(".clock-checkbox input")).toBeChecked();
  await expect(page.locator("#playback")).toHaveValue("ticks");
  await expect(page.locator(".divider-phase-number strong")).toHaveText("1 / 8");
  await expect(page.locator(".transport-buttons").getByRole("button", { name: /Start/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Vorherige Konfiguration wiederherstellen/ })).toHaveCount(0);
});

test("Registeränderungen setzen CNT und Prescalerphase kontrolliert zurück", async ({ page }) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await page.getByRole("button", { name: /Beispiel: PSC = 3/ }).click();
  const step = page.getByRole("button", { name: "+1 Eingangstaktimpuls" });
  for (let i = 0; i < 4; i++) await step.click();
  await expect(page.locator(".counter-number")).toHaveText("1");
  await page.locator("#psc").fill("4");
  await expect(page.locator(".counter-number")).toHaveText("0");
  await expect(page.locator(".divider-phase-number strong")).toHaveText("0 / 5");
  await expect(page.locator(".register-reset-note")).toContainText("pausieren");
});

test("PWM-Grenzen: kein falscher 100-%-Wert, keine Abschaltmarkierung ohne Ereignis", async ({ page }) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  const marker = page.locator(".counter-progress i");
  const compareGuide = page.locator(".waveform .compare-guide");
  await page.locator("#ccr").fill("0");
  await expect(marker).toHaveCount(0);
  await expect(compareGuide).toHaveCount(0);
  await expect(page.locator("label[for='duty']")).toContainText("0,0 %");

  await page.locator("#ccr").fill("10"); // ARR=9 -> exact 100 %
  await expect(marker).toHaveCount(0);
  await expect(compareGuide).toHaveCount(0);
  await expect(page.locator("label[for='duty']")).toContainText("100,0 %");

  await page.locator("#arr").fill("65535");
  await page.locator("#ccr").fill("65535"); // compare at last possible count
  await expect(marker).toHaveCount(1);
  await expect(compareGuide).toHaveCount(1);
  await expect(page.locator("label[for='duty']")).toContainText("< 100 %");
  await expect(page.locator(".duty-limit-note")).toContainText("Exakt 100 %");
  await expect(page.locator(".range-labels")).toContainText("max. < 100 %");

  await page.locator("#psc").fill("0");
  await page.locator("#arr").fill("0");
  await expect(page.locator(".metric").last()).toContainText("ns");
  await expect(page.locator(".waveform")).toContainText("ns");

  await page.locator("#timer").selectOption("TIM2");
  await page.locator("#arr").fill("65536");
  await expect(page.locator(".clock-comparison")).toContainText("nicht möglich");
  await page.locator("#psc").fill("65535");
  await page.locator("#arr").fill("4294967295");
  await page.locator("#ccr").fill("4294967295");
  await expect(page.locator("label[for='duty']")).toContainText("< 100 %");
  await expect(page.locator(".metric.featured strong")).not.toHaveText("0 Hz");
});

test("Geführter Einstieg: PSC, ARR, CCR2, Frequenz als Vorhersage–Experiment–Erklärung", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await expect(page.getByRole("heading", { name: /Warum teilt PSC = 3/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Woher bekommt der Timer seinen Takt/ })).toHaveCount(0);
  await expect(page.getByTestId("guided-cnt")).toHaveText("0");
  await expect(page.getByRole("button", { name: /Timer-Eingangstaktimpuls/ })).toBeDisabled();
  await capture(page, info.project.name, "guided-psc-start");

  await page.getByRole("radio", { name: "4 Impulse" }).check();
  const inputStep = page.getByRole("button", { name: "+1 Timer-Eingangstaktimpuls" });
  for (let i = 1; i <= 3; i++) {
    await inputStep.click();
    await expect(page.getByTestId("guided-cnt")).toHaveText("0");
    await expect(page.locator(".guided-state")).toContainText(i + " / 4");
  }
  await inputStep.click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("1");
  await expect(page.locator(".guided-result")).toContainText("Deine Vorhersage war richtig");
  await capture(page, info.project.name, "guided-psc-observed");
  await page.getByRole("button", { name: /Nächstes Experiment/ }).click();

  await expect(page.getByRole("heading", { name: /Warum zählt ARR = 9/ })).toBeVisible();
  await page.getByRole("radio", { name: "0", exact: true }).check();
  await page.getByRole("button", { name: "Bis CNT = 9" }).click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("9");
  await page.getByRole("button", { name: "+1 CNT-Zählschritt" }).click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("0");
  await expect(page.getByTestId("guided-wraps")).toHaveText("1");
  await expect(page.locator(".guided-result")).toContainText("ARR → 0");
  await page.getByRole("button", { name: /Nächstes Experiment/ }).click();

  await expect(page.getByRole("heading", { name: "Wann wird OC2REF inaktiv?" })).toBeVisible();
  await page.getByRole("radio", { name: "CNT = 3" }).check();
  await expect(page.getByTestId("guided-oc2ref")).toContainText("1 · aktiv");
  await page.getByRole("button", { name: "Bis CNT = CCR2" }).click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("3");
  await expect(page.getByTestId("guided-oc2ref")).toContainText("0 · inaktiv");
  await expect(page.locator(".guided-result")).toContainText("30 %");
  await capture(page, info.project.name, "guided-compare-observed");
  await page.getByRole("button", { name: /Nächstes Experiment/ }).click();

  await expect(page.getByRole("heading", { name: /Wie beeinflussen PSC und ARR/ })).toBeVisible();
  await expect(page.getByTestId("guided-frequency")).toHaveText("4,2 MHz");
  await page.getByRole("radio", { name: "Sie halbiert sich" }).check();
  await page.getByRole("button", { name: "PSC auf 7 setzen" }).click();
  await expect(page.getByTestId("guided-frequency")).toHaveText("2,1 MHz");
  await page.getByRole("button", { name: "ARR auf 19 setzen" }).click();
  await expect(page.getByTestId("guided-frequency")).toHaveText("1,05 MHz");
  await expect(page.getByTestId("guided-ccr")).toHaveText("3");
  await expect(page.locator(".guided-result")).toContainText("die Frequenz halbiert sich erneut");
  await capture(page, info.project.name, "guided-frequency-observed");
});

test("Geführter Modus erhält die vorherige Konfiguration des freien Labors", async ({ page }) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await expect(page.locator("#psc")).toHaveValue("16799");
  await page.locator("#timer").selectOption("TIM2");
  await page.locator("#psc").fill("7");
  await page.locator("#arr").fill("19");
  await page.locator("#ccr").fill("4");
  await page.locator(".clock-checkbox input").check();
  await page.getByRole("button", { name: "Geführter Einstieg", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Warum teilt PSC = 3/ })).toBeVisible();
  await expect(page.locator("#psc")).toHaveCount(0);
  await page.getByRole("button", { name: "4. Frequenz" }).click();
  await expect(page.getByTestId("guided-frequency")).toHaveText("4,2 MHz");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  await expect(page.locator("#timer")).toHaveValue("TIM2");
  await expect(page.locator("#psc")).toHaveValue("7");
  await expect(page.locator("#arr")).toHaveValue("19");
  await expect(page.locator("#ccr")).toHaveValue("4");
  await expect(page.locator(".clock-checkbox input")).toBeChecked();
});
