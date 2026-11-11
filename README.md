# PES-Demos

Interaktive Technik-Demos für das THM-Modul **Praktikum Eingebettete Systeme (PES)**.

**Website (nach dem ersten erfolgreichen Deployment):**
https://kreutzm.github.io/PES-Demos/

## Enthaltene Demos

### Timer & PWM (erster Prototyp)

Interaktive Einstiegssimulation für einen STM32F429 mit einem **explizit gewählten Taktprofil**:

- TIM1 (16 Bit), Timer-Takt 168 MHz und TIM2 (32 Bit), Timer-Takt 84 MHz
- Register PSC, ARR und CCR2 sowie Frequenz und Duty-Cycle
- Visualisierung von PWM Mode 1 im Upcounting-Betrieb
- PWM-Polarität und konzeptioneller Bezug zu TIM1_CH2 / PE11 / DOT
- HAL-Konfigurationsausschnitt und Unit-Tests

**Wichtig:** Der Timer-Kern ist bewusst eine didaktische Teilsimulation. Er bildet noch keine vollständige Peripherie ab; insbesondere Preload/Update-Events, Output-Enable (CCxE, MOE), kompletter Clock-Tree und GPIO-Multiplexing sind noch nicht simuliert. Der angezeigte C-Code ist kein vollständiges lauffähiges Firmwareprojekt.

## Lokal ausführen

Voraussetzung: Node.js 22.12 oder neuer.

```bash
npm install
npm run dev
```

**Überprüfen und bauen:**

```bash
npm run typecheck
npm run test
npm run build
```

**Hinweis zum ersten Bootstrap:** In diesem ersten PR wird zunächst noch ohne eingecheckte `package-lock.json` gearbeitet. Deshalb installiert die CI vorübergehend mit `npm install`. Nach dem ersten erfolgreichen CI-Lauf sollte das erzeugte Lockfile eingecheckt und der Workflow auf `npm ci` umgestellt werden.

## Veröffentlichung

Die Website wird unter `/PES-Demos/` gebaut. Der Workflow `.github/workflows/ci-pages.yml` prüft Pull Requests und veröffentlicht bei Pushes nach `main` die Version auf GitHub Pages, wenn in den Pages-Einstellungen **GitHub Actions** als Veröffentlichungsquelle ausgewählt ist.

## Weiterentwicklung

Die Demo-Bibliothek ist bewusst in `src/demos/` modular aufgebaut, damit später ADC-, Interrupt- und weitere PES-Demos ergänzt werden können.
