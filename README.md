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
- **Playwright mit Chrome Stable auf GitHub Actions** (lokal: Chromium): Desktop (1440 × 900) und Mobilgerät (Pixel-7-Profil), Smoke-Tests der Startseite, Timer-/PWM-Interaktionen, Taktbaum/TIMPRE, Prescaler und horizontale Layout-Überbreite.
- **Screenshots:** vollständige PNGs im Actions-Artefakt `visual-screenshots`. Kompakte JPEG-Previews liegen im selben Artefakt unter `previews/` und können über den GitHub-Connector für eine optische Prüfung heruntergeladen werden. Screenshots werden bei jedem Lauf erzeugt, nicht nur bei Fehlern.
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

Der GitHub-Runner bringt **Google Chrome Stable** bereits mit. Der Playwright-Job verwendet ihn dort direkt, statt Chromium erneut herunterzuladen. Lokal verwendet Playwright nach `npx playwright install chromium` die eigene Chromium-Version.

## Review-Korrekturen: Issue #7 / Timer-Register und Begriffe

- **Registertreue:** ARR-Änderungen verändern CCR2 **nicht**. Beispiel ARR 9→19 bei CCR2=3: 30 %→15 % Tastverhältnis.
- **Unabhängiges CCR2:** Der Vergleichswert ist innerhalb seiner 16-/32-Bit-Registerbreite unabhängig von ARR. Bei CCR2>ARR bleibt OC2REF im hier betrachteten aufwärtszählenden PWM-Modus 1 durchgehend aktiv; das Zeitdiagramm zeigt keine fingierte Abschaltflanke.
- **Eindeutige Sprache:** »Timer-Eingangstaktimpuls« für den Eingang, »CNT-Zählschritt« für den geteilten Zähler, »periodischer CNT-Rücksprung ARR→0« und »OC2REF« für das interne Referenzsignal. Ereignisse und Frequenzen werden getrennt benannt.
- **Transparentes Reset-Verhalten:** Register-/RCC-Änderungen pausieren und starten die Simulation mit CNT/Prescalerphase=0. Voreinstellungen überschreiben zusätzlich Timer, RCC-Profil, Register und Wiedergabemodus; die unmittelbar vorherige Konfiguration mit Zählerstand kann wiederhergestellt werden.
- **Regressionstests:** Neue Unit-Tests und Playwright-End-to-end-Szenarien prüfen ARR-/CCR2-Unabhängigkeit, PWM-Grenzfälle, Reset und Preset-Rückkehr.

Diese Anpassungen betreffen die bestehende Laboransicht. Der geplante geführte Lernmodus folgt als separates Issue/PR.

## Geführter Timer-Einstieg (Issue #9)

Der Timer/PWM-Demonstrator startet mit einem **geführten Einstiegsmodus**. Vier kurze Experimente behandeln in der Reihenfolge **Prescaler (PSC)**, **periodischen CNT-Rücksprung (ARR)**, **internes PWM-Referenzsignal OC2REF (CCR2)** und **PWM-Frequenz**. Eine Antwortauswahl regt jeweils zur Vorhersage an; nach der anschließenden Simulation folgt die Beobachtung und eine Erklärung.

Die Lernkonfiguration verwendet **TIM1, Standard-RCC, PSC=3, ARR=9, CCR2=3**. Die Simulation selbst verwendet dieselbe Timer- und Prescalerberechnung wie das freie Labor (keine zweite Hardware-Engine). Ein Wechsel zum **freien Labor** stellt dessen zuvor eingestellte Register und das RCC-Profil wieder her. Im freien Labor bleiben RCC-Taktbaum, Prescaler-Pipeline, Register-/PWM-Steuerung, LED-Modell, Zeitdiagramm und HAL-Ausschnitt erhalten.

Der geführte Modus ist ein didaktisches Angebot, keine Speicherung oder Benotung persönlicher Lernfortschritte. Abgebildet sind weiterhin die im freien Labor dokumentierten Hardwarevereinfachungen.

## Free-Lab-Navigation und Responsive-Verhalten (Issue #11)

Im **freien Labor** erscheinen Registersteuerung, CNT-Zähler, Zeitdiagramm und Kennwerte zuerst. Danach folgen die vollständigen Vertiefungen für **RCC-Taktbaum** und **Prescaler**; ihre Rechen- und Eingabefunktionen bleiben unverändert. Die Sprungnavigation bedient die Bereiche ohne Routenwechsel (die Anwendung nutzt Hash-Routing) und bewegt den Tastaturfokus zum gewählten Abschnitt. Aus den Vertiefungen gibt es einen direkten Rückweg zu den Registern.

Register-Eingaben referenzieren ihre Erklärtexte über `aria-describedby`; mobile Layouts, Textgrößen und Tasten sind auf **320 bis 1280 px** ausgerichtet. E2E prüft die Navigation, die unabhängige ARR/CCR2-Bearbeitung und die horizontale Breite in beiden Modi. Diese Änderungen betreffen Layout/Bedienbarkeit, **nicht** die Timer-Berechnungen.

## Virtuelles DOT an PE11: Signalweg (Issue #5)

Der Abschnitt „Virtuelles DOT · PE11“ besitzt ein **standardmäßig geschlossenes, per Tastatur zugängliches Ausklappfeld** mit einem dynamischen **Signalweg und einer Zustandstabelle**. Er trennt das **interne OC2REF-Signal**, die Ausgangspolarität `TIM_OCPOLARITY_LOW`, den **elektrischen PE11-Pegel** und die **low-aktive DOT-Anzeige**.

- PWM Mode 1: `OC2REF = 1` für `CNT < CCR2` (gemeinsamer Berechnungspfad `pwmActive`).
- Bei `TIM1_CH2` mit `OCPolarity LOW` entspricht OC2REF=1 einem **LOW-Pegel an PE11**; eine low-aktive DOT-Leitung lässt das gewählte Segment dann leuchten.
- Die physikalische Darstellung gilt nur bei **TIM1** und unter Annahme aktivierter Ausgangsfreigaben **CC2E/MOE**, AF1-Konfiguration sowie einer aktivierten Anzeigenstelle über **CNTL1…CNTL4**. Diese Voraussetzungen sind in der Website nicht dynamisch modelliert. **TIM2_CH2 ist nicht mit DOT/PE11 verbunden.**
- Das Blockschaltbild ist eine **didaktische Funktionsdarstellung, kein elektrischer Stromlaufplan** und behauptet keine zusätzlichen physischen Inverter. Der tatsächliche Treiber-/Multiplex-Strompfad des 8-Segment-Adapterboards ist nicht rekonstruiert.
- **Primärquelle der Praktikumshardware:** *Praktikum Eingebettete Systeme – Praktikumsanleitung*, Technische Hochschule Mittelhessen, **Version 1.6 vom 13.10.2026**, Kap. **7.1.1**, Druckseiten **28–29/79** (low-aktive Segmentleitungen, CNTL1…CNTL4, Verweis auf das 8-Segment-Board-Schematic), sowie Kap. **7.6.3**, Druckseiten **51–52/79** (TIM1_CH2 → AF1 → PE11 → DOT). Die konkrete Kurs-PDF liegt in den Praktikumsressourcen, **nicht als öffentlich verlinkte Kopie** in diesem Repository.
- **Offizielle Hardwaredokumente:** [ST STM32F429-Datenblatt, Pin-/AF-Tabelle (PE11 / TIM1_CH2)](https://www.st.com/resource/en/datasheet/stm32f429zg.pdf), [Waveshare Open429Z-D – Ressourcen inkl. Basisschaltplan](https://www.waveshare.com/wiki/Open429Z-D) und [Waveshare 8 SEG LED Board – Ressourcen inkl. Adapterschaltplan](https://www.waveshare.com/wiki/8_SEG_LED_Board). Das vorliegende Open429Z-D-Basisschaltbild von 2014 belegt **nicht** den vollständigen Strompfad des Adapterboards; dieser wurde für die Demo nicht elektrisch rekonstruiert.

Das vorhandene OC2REF-Zeitdiagramm und die Simulations-Engine bleiben unverändert; die Tabelle bietet die alternative synchrone Darstellung der drei Pegel-/LED-Ebenen und reagiert auf CNT, CCR2 und Timerwechsel.

**TIM2-Darstellung:** Das geschlossene Ausklappfeld und beide LED-Widgets weisen ausdrücklich auf die fehlende Verbindung zu DOT/PE11 hin. Die TIM1-Pegeltabelle wird bei ausgewähltem TIM2 nicht angezeigt, damit keine hypothetischen PE11-HIGH-/LOW-Werte als aktueller TIM2-Pegel missverstanden werden.
