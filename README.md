# PES-Demos

Interaktive Technik-Demos für das THM-Modul **Praktikum Eingebettete Systeme (PES)**.

**Website (nach dem ersten erfolgreichen Deployment):**
https://kreutzm.github.io/PES-Demos/

## Enthaltene Demos

### Timer & PWM (interaktives Lernlabor)

Interaktive Einstiegssimulation für einen STM32F429 mit einem **explizit gewählten Taktprofil**:

- Interaktiver STM32F429-RCC-Taktbaum mit SYSCLK, HPRE, PPRE1, PPRE2 und TIMPRE
- TIM1 (16 Bit, APB2) und TIM2 (32 Bit, APB1): Timer-Takte dynamisch aus dem Clock-Tree berechnet
- Register PSC, ARR und CCR2 sowie Frequenz und Duty-Cycle
- Synchronisiertes Zeitdiagramm für CNT-Zähler, CCR2 und PWM Mode 1
- Einzelschritt (+1 Tick), Sprung zur Compare-Schwelle, Überlauf, Start/Pause, Zeitraffer
- Einsteiger-Voreinstellung mit ARR=9, CCR2=3 zur Herleitung von 30 % Duty-Cycle
- Erklärung der momentanen LED-Aktivität gegenüber einer gemittelten Helligkeitsdarstellung
- PWM-Polarität und konzeptioneller Bezug zu TIM1_CH2 / PE11 / DOT
- HAL-Konfigurationsausschnitt und Unit-Tests

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
