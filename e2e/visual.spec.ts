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
  await expect(page.getByRole("heading", { name: /Wie wirkt PSC = 3 auf den Zähler/ })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: /Wie wirkt PSC = 3 auf den Zähler/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Woher bekommt der Timer seinen Takt/ })).toHaveCount(0);
  await expect(page.getByTestId("guided-cnt")).toHaveText("0");
  await expect(page.getByTestId("guided-impulses")).toHaveText("0");
  await expect(page.locator(".guided-pulses span")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Timer-Eingangstaktimpuls/ })).toBeDisabled();
  await capture(page, info.project.name, "guided-psc-start");

  await page.getByRole("radio", { name: "4 Impulse" }).check();
  const inputStep = page.getByRole("button", { name: "+1 Timer-Eingangstaktimpuls" });
  for (let i = 1; i <= 3; i++) {
    await inputStep.click();
    await expect(page.getByTestId("guided-cnt")).toHaveText("0");
    await expect(page.getByTestId("guided-impulses")).toHaveText(String(i));
    await expect(page.locator(".guided-pulses span")).toHaveCount(i);
  }
  await inputStep.click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("1");
  await expect(page.getByTestId("guided-impulses")).toHaveText("4");
  await expect(page.locator(".guided-pulses span")).toHaveCount(4);
  await expect(page.locator(".guided-observation")).toContainText("4. Eingangstaktimpuls");
  await expect(page.locator(".guided-result")).toContainText("Deine Vorhersage war richtig");
  await capture(page, info.project.name, "guided-psc-observed");
  await page.getByRole("button", { name: /Nächstes Experiment/ }).click();

  await expect(page.getByRole("heading", { name: /Was passiert am Zählerendwert ARR = 9/ })).toBeVisible();
  await expect(page.getByTestId("guided-question")).toBeFocused();
  await page.getByRole("radio", { name: "0", exact: true }).check();
  await page.getByRole("button", { name: "Bis CNT = 9" }).click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("9");
  await expect(page.locator(".guided-observation")).not.toContainText("zurück zu 0");
  await page.getByRole("button", { name: "+1 CNT-Zählschritt" }).click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("0");
  await expect(page.getByTestId("guided-wraps")).toHaveText("1");
  await expect(page.locator(".guided-result")).toContainText("ARR → 0");
  await page.getByRole("button", { name: /Nächstes Experiment/ }).click();

  await expect(page.getByRole("heading", { name: "Wann wird OC2REF inaktiv?" })).toBeVisible();
  await page.getByRole("radio", { name: "CNT = 3" }).check();
  await expect(page.getByTestId("guided-oc2ref")).toContainText("1 · aktiv");
  await expect(page.locator(".guided-waveform")).toHaveCount(0);
  const cntStep = page.getByRole("button", { name: "+1 CNT-Zählschritt" });
  await cntStep.click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("1");
  await expect(page.getByTestId("guided-oc2ref")).toContainText("1 · aktiv");
  await expect(page.locator(".guided-waveform")).toHaveCount(0);
  await cntStep.click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("2");
  await expect(page.locator(".guided-waveform")).toHaveCount(0);
  await cntStep.click();
  await expect(page.getByTestId("guided-cnt")).toHaveText("3");
  await expect(page.getByTestId("guided-oc2ref")).toContainText("0 · inaktiv");
  await expect(page.locator(".guided-waveform")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: /Wie wirkt PSC = 3 auf den Zähler/ })).toBeVisible();
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

test("Geführter Einstieg verrät Lösungen nicht vorab und erklärt auch eine falsche Vorhersage", async ({ page }) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await expect(page.getByRole("heading", { name: /Wie wirkt PSC = 3/ })).toBeVisible();
  await expect(page.getByTestId("guided-impulses")).toHaveText("0");
  await expect(page.locator(".guided-pulses span")).toHaveCount(0);
  await expect(page.locator(".guided-result")).toContainText("Die Erklärung erscheint");
  await expect(page.locator(".guided-result")).not.toContainText("vier Eingangstaktimpulsen");

  await page.getByRole("radio", { name: "1 Impuls" }).check();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "+1 Timer-Eingangstaktimpuls" }).click();
  }
  await expect(page.locator(".guided-result")).toContainText("Deine Vorhersage war anders");
  await expect(page.locator(".guided-result")).toContainText("vier Eingangstaktimpulsen");

  // Navigation intentionally starts an experiment over, as signposted.
  await expect(page.locator(".guided-reset-notice")).toContainText("Antwort und Zähler");
  await page.getByRole("button", { name: "2. ARR" }).click();
  await expect(page.getByTestId("guided-question")).toBeFocused();
  await page.getByRole("button", { name: "1. PSC" }).click();
  await expect(page.getByTestId("guided-question")).toBeFocused();
  await expect(page.getByTestId("guided-impulses")).toHaveText("0");
  await expect(page.getByRole("radio", { name: "1 Impuls" })).not.toBeChecked();

  await page.getByRole("button", { name: "3. CCR2" }).click();
  await expect(page.getByTestId("guided-question")).toBeFocused();
  await expect(page.locator(".guided-waveform")).toHaveCount(0);
  await expect(page.locator(".guided-observation")).not.toContainText("CNT < 3");
  await expect(page.locator(".guided-result")).not.toContainText("30 %");
});

test("Geführter Einstieg bleibt bei 360 px ohne horizontales Scrollen, Frage im Blick", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/PES-Demos/#/timer-pwm");
  await expect(page.getByTestId("guided-question")).toBeInViewport();
  await expect(page.getByRole("radio", { name: "4 Impulse" })).toBeInViewport();
  let horizontal = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontal).toBeLessThanOrEqual(2);
  await capture(page, info.project.name, "guided-360-start");

  await page.getByRole("button", { name: "3. CCR2" }).click();
  await expect(page.getByTestId("guided-question")).toBeFocused();
  await expect(page.getByTestId("guided-question")).toBeInViewport();
  horizontal = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontal).toBeLessThanOrEqual(2);
});

test("Freies Labor: Register zuerst, Sprungnavigation per Tastatur und Hinweise verknüpft", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();

  const registers = page.locator("#lab-register");
  const clock = page.locator("#lab-clock");
  const prescaler = page.locator("#lab-prescaler");
  const wave = page.locator("#lab-waveform");
  const y = async (selector: import("@playwright/test").Locator) =>
    selector.evaluate(el => el.getBoundingClientRect().top + window.scrollY);

  expect(await y(registers)).toBeLessThan(await y(clock));
  expect(await y(wave)).toBeLessThan(await y(prescaler));
  await expect(page.locator("#arr")).toHaveAttribute("aria-describedby", /arr-hint/);
  await expect(page.locator("#ccr")).toHaveAttribute("aria-describedby", /ccr-hint/);
  await expect(page.locator("#duty")).toHaveAttribute("aria-describedby", /duty-hint/);
  await expect(page.locator(".preset-buttons")).toHaveAttribute("aria-describedby", "preset-effects");

  await page.locator("#arr").fill("19");
  await expect(page.locator("#ccr")).toHaveValue("3");
  await expect(page.locator("label[for='duty']")).toContainText("15,0 %");
  await expect(page.locator(".lab-local-feedback")).toContainText("15,0 %");
  await expect(page.locator(".lab-local-feedback")).toContainText("CCR2 = 3");
  await capture(page, info.project.name, "free-lab-interaction-first");
  await page.getByRole("button", { name: "→ CNT ansehen" }).click();
  await expect(page.locator("#lab-counter")).toBeFocused();

  const navigation = page.getByRole("navigation", { name: "Direkt zu einem Bereich im freien Labor" });
  const toClock = navigation.getByRole("button", { name: "RCC-Taktbaum" });
  await toClock.focus();
  await page.keyboard.press("Enter");
  await expect(clock).toBeFocused();
  await expect(clock).toBeInViewport();
  await expect(clock.getByRole("heading", { name: /Woher bekommt der Timer/ })).toBeVisible();

  await page.getByRole("button", { name: "↑ Zur Registersteuerung", exact: true }).click();
  await expect(registers).toBeFocused();
  await expect(registers).toBeInViewport();

  await navigation.getByRole("button", { name: "Prescaler-Labor" }).click();
  await expect(prescaler).toBeFocused();
  await expect(prescaler).toBeInViewport();
  await expect(prescaler.getByRole("button", { name: "+1 Eingangstaktimpuls" })).toBeVisible();
});

test("320–1280 px: beide Lernmodi ohne horizontale Dokument-Überbreite", async ({ page }, info) => {
  for (const width of [320, 360, 393, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/PES-Demos/#/timer-pwm");
    // Changing viewport on the same hash route does not remount the React app.
    await page.getByRole("button", { name: "Geführter Einstieg", exact: true }).click();
    await expect(page.getByTestId("guided-question")).toBeVisible();

    let excess = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(excess, "Geführter Modus bei " + width + " px").toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
    await expect(page.locator("#lab-register")).toBeVisible();
    await page.locator("#lab-clock").scrollIntoViewIfNeeded();
    excess = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(excess, "Freies Labor bei " + width + " px").toBeLessThanOrEqual(2);
    await expect(page.locator("#lab-clock .clock-controls select").first()).toBeVisible();
    if (width === 320 || width === 768) {
      await capture(page, info.project.name, "free-lab-" + width + "px");
    }
  }
});

test("Mobile RCC-Texte bleiben lesbar, selbst bei großen TIM2-Werten", async ({ page }, info) => {
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/PES-Demos/#/timer-pwm");
    await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
    await page.locator("#timer").selectOption("TIM2");
    await page.locator("#arr").fill("4294967295");
    await page.locator("#ccr").fill("4294967295");
    await page.locator(".clock-controls .clock-select").nth(2).locator("select").selectOption("8");
    await page.locator(".clock-checkbox input").check();

    await expect(page.locator("#arr")).toHaveValue("4294967295");
    const lab = page.locator(".free-lab");
    const sizes = await lab.locator(".clock-node small").evaluateAll(elements =>
      elements.map(el => parseFloat(getComputedStyle(el).fontSize)));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes), "RCC-Labelgröße bei " + width + " px").toBeGreaterThanOrEqual(12);

    // Detect local clipping in the most important clock/result/controls containers.
    const clipping = await page.locator(
      ".free-lab .clock-node, .free-lab .clock-node-value, .free-lab .divider-equations, " +
      ".free-lab .field input[type=number], .free-lab .transport-buttons .button"
    ).evaluateAll(elements =>
      elements.filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2)
        .map(el => ({ className: el.className, text: el.textContent?.slice(0,40) ?? "" })));
    expect(clipping, "Knoten/Bedienelemente bei " + width + " px").toEqual([]);
    const touchHeights = await lab.locator(
      ".lab-jump-nav button, .lab-local-jumps button, .transport-buttons button, .clock-controls select"
    ).evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
    expect(Math.min(...touchHeights)).toBeGreaterThanOrEqual(43);
    const documentExcess = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(documentExcess).toBeLessThanOrEqual(2);
    await capture(page, info.project.name, "free-lab-rcc-long-tim2-" + width + "px");
  }
});

test("Sprungziele bleiben bei Desktop und 320 px unterhalb des Sticky Headers sichtbar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/PES-Demos/#/timer-pwm");
    await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Direkt zu einem Bereich im freien Labor" });
    const targets = [
      { button: "Registern", id: "lab-register" },
      { button: "CNT & Steuerung", id: "lab-counter" },
      { button: "Zeitdiagramm", id: "lab-waveform" },
      { button: "RCC-Taktbaum", id: "lab-clock" },
      { button: "Prescaler-Labor", id: "lab-prescaler" },
    ];
    for (const {button, id} of targets) {
      await nav.getByRole("button", { name: button, exact: true }).click();
      const target = page.locator("#" + id);
      await expect(target).toBeFocused();
      const positions = await page.evaluate((targetId) => ({
        headingTop: document.querySelector("#" + targetId + " h2")!.getBoundingClientRect().top,
        headerBottom: document.querySelector(".site-header")!.getBoundingClientRect().bottom,
      }), id);
      expect(positions.headingTop, id + " bei " + width + " px")
        .toBeGreaterThanOrEqual(positions.headerBottom - 2);
      await expect(target.locator("h2").first()).toBeInViewport();
    }
  }
});

test("DOT-Signalweg: interne Referenz, PE11-Pegel und low-aktive LED bleiben synchron", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  const details = page.getByTestId("dot-signal-path");
  const summary = details.locator("summary");
  await expect(details).not.toHaveAttribute("open", "");
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await expect(details.getByTestId("path-oc2ref")).toContainText("OC2REF = 1");
  await expect(details.getByTestId("path-pe11")).toContainText("PE11: LOW (0)");
  await expect(details.getByTestId("path-dot")).toContainText("DOT: AN");
  await expect(details.locator(".dot-path-row-active")).toContainText("LOW (0)");
  await expect(details).toContainText("CC2E / MOE");
  await expect(details).toContainText("kein verifizierter elektrischer Schaltplan");
  await details.scrollIntoViewIfNeeded();
  await capture(page, info.project.name, "dot-path-tim1-on");

  const counterStep = page.locator(".transport-buttons")
    .getByRole("button", { name: "+1 CNT-Zählschritt" });
  for (let i = 0; i < 3; i++) await counterStep.click();
  await expect(page.locator(".counter-number")).toHaveText("3");
  await expect(details).toHaveAttribute("open", "");
  await expect(details.getByTestId("path-oc2ref")).toContainText("OC2REF = 0");
  await expect(details.getByTestId("path-pe11")).toContainText("PE11: HIGH (1)");
  await expect(details.getByTestId("path-dot")).toContainText("DOT: AUS");
  await expect(details.locator(".dot-path-row-active")).toContainText("HIGH (1)");
  await details.scrollIntoViewIfNeeded();
  await capture(page, info.project.name, "dot-path-tim1-off");

  await page.locator(".transport-buttons").getByRole("button", { name: /Zum Rücksprung/ }).click();
  await expect(page.locator(".counter-number")).toHaveText("0");
  await expect(details.getByTestId("path-dot")).toContainText("DOT: AN");

  // Boundary cases: no active step at CCR2=0 and always active when CCR2>ARR.
  await page.locator("#ccr").fill("0");
  await expect(details.getByTestId("path-dot")).toContainText("DOT: AUS");
  await expect(details.getByTestId("path-pe11")).toContainText("PE11: HIGH (1)");
  await page.locator("#ccr").fill("12");
  await expect(details.getByTestId("path-dot")).toContainText("DOT: AN");
  await expect(details.getByTestId("path-pe11")).toContainText("PE11: LOW (0)");

  await page.locator("#timer").selectOption("TIM2");
  await expect(details.getByTestId("path-oc2ref")).toContainText("OC2REF = 1");
  await expect(details.getByTestId("path-pe11")).toContainText("PE11: nicht verbunden");
  await expect(details.getByTestId("path-dot")).toContainText("DOT: nicht verbunden");
  await expect(details.getByTestId("path-current-state")).toContainText("keine Verbindung");
  await expect(page.locator(".led-visual").first().getByRole("img")).toHaveAttribute(
    "aria-label", "LED momentan ausgeschaltet");
  await details.scrollIntoViewIfNeeded();
  await capture(page, info.project.name, "dot-path-tim2-disconnected");

  // A native details/summary is operable with a keyboard, no separate button needed.
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).not.toHaveAttribute("open", "");
});

test("DOT-Signalweg ist mobil aufklappbar ohne horizontale Überbreite", async ({ page }, info) => {
  await page.goto("/PES-Demos/#/timer-pwm");
  await page.getByRole("button", { name: "Freies Labor", exact: true }).click();
  const details = page.getByTestId("dot-signal-path");
  await details.locator("summary").click();
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(details.getByTestId("path-dot")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stageOverflow: [...document.querySelectorAll(".dot-path-stage")]
        .map(el => el.scrollWidth - el.clientWidth),
    }));
    expect(dimensions.documentOverflow, "Dokument bei " + width + "px").toBeLessThanOrEqual(2);
    expect(Math.max(...dimensions.stageOverflow), "Signalweg-Knoten bei " + width + "px").toBeLessThanOrEqual(2);
    await details.scrollIntoViewIfNeeded();
    await capture(page, info.project.name, "dot-path-mobile-" + width);
  }
});
