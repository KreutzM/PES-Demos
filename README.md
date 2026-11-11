# PES-Demos

Interaktive Technik-Demos für das THM-Modul **Praktikum Eingebettete Systeme (PES)**.

**Website (nach dem ersten erfolgreichen Deployment):**
https://kreutzm.github.io/PES-Demos/

## Enthaltene Demos

### Timer & PWM (interaktives Lernlabor)

Interaktive Einstiegssimulation für einen STM32F429 mit einem **explizit gewählten Taktprofil**:

- Interaktiver STM32F429-RCC-Taktbaum mit SYSCLK, HPRE, PPRE1, PPRE2 und TIMPRE
- TIM1 (16 Bit, APB2) und TIM2 (32 Bit, APB1): Timer-Takte dynamisch aus dem Clock-Tree berechnet
- Fünfstufiger Frequenzpfad TIMxCLK → PSC → CNT → ARR → PWM mit Frequenzen und Zeitdauern
- Interaktiver PSC-Innenteiler: +1 Eingangstakt, bis zum nächsten CNT-Tick springen und ÷4-Beispiel (PSC=3)
- Register PSC, ARR und CCR2 sowie Frequenz und Duty-Cycle
- Synchronisiertes Zeitdiagramm für CNT-Zähler, CCR2 und PWM Mode 1
- Einzelschritt (+1 Tick), Sprung zur Compare-Schwelle, Überlauf, Start/Pause, Zeitraffer
- Einsteiger-Voreinstellung mit ARR=9, CCR2=3 zur Herleitung von 30 % Duty-Cycle
- Erklärung der momentanen LED-Aktivität gegenüber einer gemittelten Helligkeitsdarstellung
- PWM-Polarität und konzeptioneller Bezug zu TIM1_CH2 / PE11 / DOT
- HAL-Konfigurationsausschnitt und Unit-Tests

**Warum PSC + 1?** Der Prescaler zählt von 0 bis PSC und erzeugt nach PSC + 1 Timer-Eingangstakten einen Zählschritt. Der CNT-Zähler zählt von 0 bis ARR und erzeugt nach ARR + 1 Zählschritten eine PWM-Periode. Im Labor kannst du die einzelnen Eingangstakte durchklicken (Voreinstellung „PSC = 3“). Der interne PSC-Wert gilt als bereits geladen; echte PSC-Schreibzugriffe werden erst mit dem Timer-Update-Ereignis wirksam (STM32F429 RM0090).

**Wichtig:** Wiedergabe und Zeitraffer verwenden eine bewusst verlangsamte, von der echten Timer-Taktfrequenz unabhängige Lernzeit. Der Taktbaum geht von einer bereits korrekt konfigurierten Systemtaktquelle aus und modelliert weder PLL/Overdrive noch das Umschalten der RCC-Register zur Laufzeit. Der Timer-Kern ist eine didaktische Teilsimulation. Er bildet noch keine vollständige Peripherie ab; insbesondere Preload/Update-Events, Output-Enable (CCxE, MOE), kompletter Clock-Tree und GPIO-Multiplexing sind noch nicht simuliert. Der angezeigte C-Code ist kein vollständiges lauffähiges Firmwareprojekt.

## Lokal ausführen

Voraussetzung: Node.js 22.12 oder neuer.

```bash
npm ci
npm run dev
```

**Überprüfen und bauen:**

```bash
npm run typecheck
npm run test
npm run build
```

Die Abhängigkeiten werden über die eingecheckte `package-lock.json` festgelegt. CI und lokale reproduzierbare Builds verwenden `npm ci`.

## Veröffentlichung

Die Website wird unter `/PES-Demos/` gebaut. Der Workflow `.github/workflows/ci-pages.yml` prüft Pull Requests und veröffentlicht bei Pushes nach `main` die Version auf GitHub Pages, wenn in den Pages-Einstellungen **GitHub Actions** als Veröffentlichungsquelle ausgewählt ist.

## Weiterentwicklung

Die Demo-Bibliothek ist bewusst in `src/demos/` modular aufgebaut, damit später ADC-, Interrupt- und weitere PES-Demos ergänzt werden können.

## Qualitätssicherung / Browser-Tests

Die GitHub-Actions-CI führt nach jedem Pull Request und Push auf `main` folgende Prüfungen aus:

- `npm ci`, TypeScript, Vitest und Vite-Produktionsbuild.
- **Playwright in Chromium:** Desktop (1440 × 900) und Mobilgerät (Pixel-7-Profil), Smoke-Tests der Startseite, Timer-/PWM-Interaktionen, Taktbaum/TIMPRE, Prescaler und horizontale Layout-Überbreite.
- **Screenshots:** vollständige PNGs im Actions-Artefakt `visual-screenshots`. Kleinere JPEG-Previews erscheinen zusätzlich in den CI-Logs als kodierte Bilddaten, damit sie maschinell überprüft werden können. Screenshots werden bei jedem Lauf erzeugt, nicht nur bei Fehlern.
- **Playwright HTML-Report & Traces:** Artefakt `playwright-report`, Aufbewahrung 30 Tage.
- **Lighthouse CI:** separater, zunächst nicht blockierender Audit für Performance, Accessibility und Best Practices auf beiden Hauptansichten. HTML-/JSON-Berichte im Artefakt `lighthouse-report`.

GitHub Pages wird erst veröffentlicht, wenn **Unit-/Build- und Playwright-Browserprüfungen** erfolgreich waren. Lighthouse ist bewusst vorerst nur beratend, um durch schwankende Messwerte keine Veröffentlichungen zu blockieren.

Lokal nach `npm ci` und `npm run build`:

```bash
npx playwright install chromium
npm run test:e2e
npx playwright show-report
```

Die Playwright-Konfiguration startet dafür automatisch `vite preview` auf Port 4173. Screenshots stammen aus der **gebauten Produktionsversion**, nicht aus dem Entwicklungsserver.
