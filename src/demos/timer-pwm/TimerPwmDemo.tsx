import { useEffect, useState } from "react";
import Waveform from "./components/Waveform";
import ClockTree from "./components/ClockTree";
import PrescalerPipeline from "./components/PrescalerPipeline";
import {
  advanceTimerClocks, INITIAL_CLOCKED_COUNTER, type ClockedCounterState,
} from "./model/prescaler";
import { calculateClockTree, DEFAULT_CLOCK_CONFIG, type ClockConfig } from "./model/clockTree";
import {
  calculateTimer, pwmActive, ticksUntilCompare, ticksUntilOverflow,
  TIMER_ARR_MAX, type TimerId,
} from "./model/timer";

type Preset = "divider" | "steps" | "blink" | "dim";
type Playback = "ticks" | "period";

function formatFrequency(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " Hz";
}

function formatPeriod(seconds: number): string {
  return (seconds * 1000).toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " ms";
}

export default function TimerPwmDemo() {
  const [timer, setTimer] = useState<TimerId>("TIM1");
  const [clockConfig, setClockConfig] = useState<ClockConfig>({ ...DEFAULT_CLOCK_CONFIG });
  const [psc, setPsc] = useState(16799);
  const [arr, setArr] = useState(9);
  const [ccr, setCcr] = useState(3);
  const [counter, setCounter] = useState<ClockedCounterState>({ ...INITIAL_CLOCKED_COUNTER });
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState<Playback>("ticks");
  const [showCode, setShowCode] = useState(false);

  // Ein didaktischer Zeitraffer, ausdrücklich KEINE Echtzeit-Hardwaresimulation.
  // Große ARR-Werte werden in Schritten bearbeitet; Counter-Ereignisse bleiben exakt.
  useEffect(() => {
    if (!playing) return;
    const ticksPerFrame = playback === "ticks" ? 1 : Math.max(1, Math.ceil((arr + 1) / 20));
    const interval = window.setInterval(() => {
      setCounter((previous) => advanceTimerClocks(previous, psc, arr, ticksPerFrame * (psc + 1)));
    }, 250);
    return () => window.clearInterval(interval);
  }, [playing, playback, arr, psc]);

  const clock = calculateClockTree(clockConfig);
  const timerClockHz = timer === "TIM1" ? clock.tim1Hz : clock.tim2Hz;
  const maxArr = TIMER_ARR_MAX[timer];
  const maxCcr = Math.min(arr + 1, maxArr);

  let result: ReturnType<typeof calculateTimer> | null = null;
  let error = "";
  try {
    result = calculateTimer(timer, { psc, arr, ccr }, timerClockHz);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Ungültige Timer-Konfiguration.";
  }

  const active = result !== null && pwmActive(counter.cnt, ccr);
  const compareDistance = result ? ticksUntilCompare(counter.cnt, arr, ccr) : null;
  const overflowDistance = result ? ticksUntilOverflow(counter.cnt, arr) : null;
  const pe11Connected = timer === "TIM1";
  const phasePercent = result ? ((counter.cnt + 0.5) / (arr + 1)) * 100 : 0;

  function resetCounter() {
    setPlaying(false);
    setCounter({ ...INITIAL_CLOCKED_COUNTER });
  }

  function changeTimer(next: TimerId) {
    resetCounter();
    const boundedArr = Math.min(arr, TIMER_ARR_MAX[next]);
    setArr(boundedArr);
    setCcr(Math.min(ccr, boundedArr + 1, TIMER_ARR_MAX[next]));
    setTimer(next);
  }

  function changePrescaler(value: number) {
    resetCounter();
    setPsc(Math.max(0, Math.min(65535, Math.trunc(value) || 0)));
  }

  function changePeriod(value: number) {
    resetCounter();
    const boundedArr = Math.max(0, Math.min(maxArr, Math.trunc(value) || 0));
    const previousDuty = ccr / (arr + 1);
    setArr(boundedArr);
    setCcr(Math.min(maxArr, Math.round(previousDuty * (boundedArr + 1))));
  }

  function changeCompare(value: number) {
    resetCounter();
    setCcr(Math.max(0, Math.min(maxCcr, Math.trunc(value) || 0)));
  }

  function applyPreset(preset: Preset) {
    resetCounter();
    setTimer("TIM1");
    setClockConfig({ ...DEFAULT_CLOCK_CONFIG }); // Presets refer to the documented RCC example.
    if (preset === "divider") {
      setPsc(3);
      setArr(9);
      setCcr(3);
      setPlayback("ticks");
    } else if (preset === "steps") {
      setPsc(16799);
      setArr(9);
      setCcr(3);
      setPlayback("ticks");
    } else if (preset === "blink") {
      setPsc(16799);
      setArr(9999);
      setCcr(5000);
      setPlayback("period");
    } else {
      setPsc(167);
      setArr(999);
      setCcr(500);
      setPlayback("period");
    }
  }

  function advance(ticks: number) {
    setPlaying(false);
    setCounter((previous) => advanceTimerClocks(previous, psc, arr, ticks * (psc + 1)));
  }

  function advanceInputCycles(cycles: number) {
    setPlaying(false);
    setCounter((previous) => advanceTimerClocks(previous, psc, arr, cycles));
  }

  let observation: string;
  if (counter.cnt === 0 && counter.overflows > 0) {
    observation = "Überlauf / Update: Der Zähler ist von ARR auf 0 zurückgesprungen. Die nächste PWM-Periode beginnt.";
  } else if (counter.cnt === ccr && compareDistance !== null) {
    observation = "Compare-Schwelle erreicht: CNT = CCR2. Bei PWM Mode 1 wird OCxREF jetzt inaktiv.";
  } else if (active) {
    observation = "CNT < CCR2: Das interne PWM-Referenzsignal OCxREF ist aktiv.";
  } else {
    observation = "CNT ≥ CCR2: Das interne PWM-Referenzsignal OCxREF ist inaktiv.";
  }

  const code = [
    "// Ausschnitt: Takt/GPIO/MSP-Initialisierung fehlen!",
    "htim.Instance = " + timer + ";",
    "htim.Init.Prescaler = " + psc + ";",
    "htim.Init.Period = " + arr + ";",
    "htim.Init.CounterMode = TIM_COUNTERMODE_UP;",
    "",
    "oc.OCMode = TIM_OCMODE_PWM1;",
    "oc.Pulse = " + ccr + ";",
    "oc.OCPolarity = TIM_OCPOLARITY_LOW;",
    "",
    "HAL_TIM_PWM_ConfigChannel(&htim, &oc, TIM_CHANNEL_2);",
    "HAL_TIM_PWM_Start(&htim, TIM_CHANNEL_2);",
    "// CNT-Wert abfragen:",
    "uint32_t cnt = __HAL_TIM_GET_COUNTER(&htim);",
  ].join("\n");

  return (
    <main id="inhalt" className="container demo-main">
      <a className="breadcrumb" href="#/">← Alle Demos</a>
      <div className="demo-heading">
        <div>
          <div className="eyebrow">STM32F429 · TIMER-PERIPHERIE</div>
          <h1>Timer &amp; <span className="accent">PWM</span></h1>
          <p className="lead">Sieh dem Zähler beim Arbeiten zu: Verändere Register, schalte Tick für Tick weiter und beobachte unmittelbar den PWM-Ausgang.</p>
        </div>
        <span className="version-pill">Lernlabor · Version 0.4</span>
      </div>

      <div className="lesson-note" role="note">
        <strong>Praktikumsprofil:</strong> SYSCLK 168 MHz, AHB ÷1, APB1 ÷4 und APB2 ÷2, TIMPRE = 0.
        Die Timer erhalten ihren Eingangstakt aus dem RCC-Taktbaum, <strong>nicht automatisch aus SYSCLK</strong>.
        Stelle unten andere Prescaler ein und beobachte die Auswirkung auf beide Timer.
      </div>

      <div className="learning-intro">
        <div className="intro-icon" aria-hidden="true">01</div>
        <div>
          <h2>Zwei Fragen, zwei Zähler: Warum steht bei PSC und ARR jeweils „+1“?</h2>
          <p>Wähle zunächst <strong>PSC = 3</strong> im Prescaler-Labor. Wie viele Eingangstakte
          vergehen, bis sich CNT von 0 auf 1 erhöht? Untersuche anschließend <strong>ARR = 9,
          CCR2 = 3</strong>: Bei welchem CNT-Wert wird PWM inaktiv?
          Mit den Einzelschritt-Schaltflächen kannst du beides überprüfen.</p>
        </div>
      </div>

      <ClockTree config={clockConfig} clock={clock} activeTimer={timer} psc={psc} arr={arr}
        onChange={(next) => { resetCounter(); setClockConfig(next); }} />
      <PrescalerPipeline timclkHz={timerClockHz} psc={psc} arr={arr} ccr={ccr}
        state={counter} onClockStep={advanceInputCycles} onSmallExample={() => applyPreset("divider")} />

      <div className="demo-layout">
        <section className="panel controls-panel" aria-labelledby="settings-title">
          <div className="panel-header">
            <div className="eyebrow">01 / KONFIGURATION</div>
            <h2 id="settings-title">Timer-Register</h2>
          </div>
          <div className="field">
            <label htmlFor="timer">Timer</label>
            <select id="timer" value={timer} onChange={(event) => changeTimer(event.target.value as TimerId)}>
              <option value="TIM1">TIM1 · 16 Bit, APB2</option>
              <option value="TIM2">TIM2 · 32 Bit, APB1</option>
            </select>
            <p className="field-hint">Beim Wechsel bleiben PSC und die zulässigen ARR/CCR-Werte erhalten; die Zählung startet neu.</p>
          </div>
          <div className="field">
            <label htmlFor="psc">PSC <span>Prescaler</span></label>
            <input id="psc" type="number" min="0" max="65535" step="1" value={psc} onChange={(event) => changePrescaler(Number(event.target.value))}/>
            <p className="field-hint">Zähltakt = f<sub>TIM</sub> / (PSC + 1)</p>
          </div>
          <div className="field">
            <label htmlFor="arr">ARR <span>Auto-Reload-Register</span></label>
            <input id="arr" type="number" min="0" max={maxArr} step="1" value={arr} onChange={(event) => changePeriod(Number(event.target.value))}/>
            <p className="field-hint">CNT läuft von 0 bis ARR, also ARR + 1 Zählschritte.</p>
          </div>
          <div className="field">
            <label htmlFor="ccr">CCR2 <span>Compare-Register</span></label>
            <input id="ccr" type="number" min="0" max={maxCcr} step="1" value={ccr} onChange={(event) => changeCompare(Number(event.target.value))}/>
            <p className="field-hint">PWM Mode 1: OCxREF aktiv, solange CNT &lt; CCR2.</p>
          </div>
          <div className="field slider-field">
            <label htmlFor="duty">Duty-Cycle <strong>{result ? (result.duty * 100).toFixed(1) : "–"} %</strong></label>
            <input id="duty" type="range" min="0" max="100" step="1"
              value={result ? result.duty * 100 : 0}
              onChange={(event) => changeCompare(Math.round(Number(event.target.value) / 100 * (arr + 1)))}
              aria-label="Aktiver Duty-Cycle"/>
            <div className="range-labels"><span>0 %</span><span>100 %</span></div>
          </div>
          <div className="preset-buttons">
            <button type="button" className="button button-ghost" onClick={() => applyPreset("divider")}>↺ PSC = 3 · ÷4</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("steps")}>↺ 10 Ticks · 30 %</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("blink")}>↺ 1 Hz · Blinken</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("dim")}>↺ 1 kHz · Dimmen</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section className="output-column" aria-label="Timer-Simulation">
          <section className="panel simulator-panel" aria-labelledby="sim-title">
            <div className="panel-header">
              <div className="eyebrow">02 / ZÄHLWERK</div>
              <h2 id="sim-title">Live-Zustand des Counters</h2>
              <p>Der Timer wird hier didaktisch verlangsamt. Du kannst sowohl <strong>TIMxCLK-Eingangstakte</strong> im Prescaler-Labor als auch komplette <strong>CNT-Ticks</strong> weiterschalten. Die Browser-Wiedergabe läuft nicht in Echtzeit.</p>
            </div>
            <div className="counter-display">
              <div>
                <span className="counter-label">CNT</span>
                <strong className="counter-number">{counter.cnt.toLocaleString("de-DE")}</strong>
                <span className="counter-limits">0 … {arr.toLocaleString("de-DE")}</span>
              </div>
              <div className="counter-status">
                <span className={active ? "state-indicator state-active" : "state-indicator state-inactive"} aria-hidden="true" />
                <strong>{active ? "OCxREF = 1" : "OCxREF = 0"}</strong>
                <small>{active ? "CNT < CCR2" : "CNT ≥ CCR2"}</small>
              </div>
            </div>
            <div className="counter-progress" role="progressbar" aria-valuemin={0} aria-valuemax={arr} aria-valuenow={counter.cnt} aria-label="Zählerposition in der PWM-Periode">
              <span style={{ width: phasePercent + "%" }} />
              <i style={{ left: Math.min(100, ccr / (arr + 1) * 100) + "%" }} title="CCR2-Schwelle" />
            </div>
            <div className="counter-extras">
              <span>Überläufe: <strong>{counter.overflows.toLocaleString("de-DE")}</strong></span>
              <span>Nächster Überlauf: <strong>{overflowDistance?.toLocaleString("de-DE") ?? "–"} Tick(s)</strong></span>
            </div>

            <div className="playback-control">
              <label htmlFor="playback">Wiedergabe</label>
              <select id="playback" value={playback} onChange={(event) => setPlayback(event.target.value as Playback)}>
                <option value="ticks">Tickweise · 4 Ticks/s</option>
                <option value="period">Zeitraffer · ca. 5 s/Periode</option>
              </select>
            </div>
            <div className="transport-buttons">
              <button type="button" className="button button-primary" onClick={() => setPlaying((before) => !before)} disabled={!result}>
                {playing ? "❚❚ Pause" : "▶ Start"}
              </button>
              <button type="button" className="button button-ghost" onClick={() => advance(1)} disabled={!result}>+1 Tick</button>
              <button type="button" className="button button-ghost" onClick={() => advance(compareDistance ?? 0)} disabled={compareDistance === null} title={compareDistance === null ? "Bei 0 % oder 100 % gibt es keinen Compare-Flankenwechsel." : "Zum nächsten CNT=CCR2 springen"}>→ Compare</button>
              <button type="button" className="button button-ghost" onClick={() => advance(overflowDistance ?? 0)} disabled={overflowDistance === null}>↻ Überlauf</button>
              <button type="button" className="button button-ghost" onClick={resetCounter}>Reset</button>
            </div>
            <p className="observation" aria-label="Erklärung des aktuellen Zählerzustands">{observation}</p>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="eyebrow">03 / SYNCHRONISIERTES ZEITDIAGRAMM</div>
              <h2>CNT, CCR2 und PWM Mode 1</h2>
              <p>Die orange Compare-Linie markiert den Umschaltwert. Der weiße Cursor zeigt den aktuellen Zählschritt.</p>
            </div>
            {result ? <Waveform arr={arr} ccr={ccr} cnt={counter.cnt} periodSeconds={result.periodSeconds}/> : <p>Korrigiere die Registerwerte, um das Signal zu sehen.</p>}
            <div className="wave-legend"><span className="legend-dot"/> Logisch aktives PWM-Referenzsignal <span className="wave-secondary">· Bei OCPolarity LOW liegt währenddessen physikalisch LOW am Ausgang an.</span></div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="eyebrow">04 / BERECHNUNG</div>
              <h2>Vom Timer-Takt zur PWM-Frequenz</h2>
            </div>
            <div className="metrics">
              <div className="metric"><span>Timer-Eingang</span><strong>{(timerClockHz / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 5 })} <small>MHz</small></strong></div>
              <div className="metric"><span>Zähltakt</span><strong>{result ? formatFrequency(result.counterHz) : "–"}</strong></div>
              <div className="metric featured"><span>PWM-Frequenz</span><strong>{result ? formatFrequency(result.pwmHz) : "–"}</strong></div>
              <div className="metric"><span>Periodendauer</span><strong>{result ? formatPeriod(result.periodSeconds) : "–"}</strong></div>
            </div>
            <p className="formula-line">f<sub>CNT</sub> = f<sub>TIM</sub> / (PSC + 1) &nbsp;·&nbsp; f<sub>PWM</sub> = f<sub>CNT</sub> / (ARR + 1)</p>
          </section>

          <section className="panel physical-panel">
            <div>
              <div className="eyebrow">05 / HARDWAREBEZUG</div>
              <h2>Virtuelles DOT · PE11</h2>
              <p>{pe11Connected
                ? "TIM1_CH2 → AF1 → PE11. Die LED ist low-aktiv. Wir setzen eine aktivierte Anzeigenstelle und freigeschalteten TIM1-Ausgang voraus (CC2E/MOE)."
                : "TIM2_CH2 liegt nicht auf PE11. Deshalb bleibt das virtuelle DOT-Segment unverbunden; oben wird trotzdem das interne PWM-Signal simuliert."}</p>
              <p className="field-hint">Links: momentaner LED-Zustand gemäß CNT. Rechts: gemitteltes Helligkeitsmodell, nur bei ausreichend hoher PWM-Frequenz sinnvoll.</p>
            </div>
            <div className="led-pair">
              <div className="led-visual">
                <div className="led-frame" role="img" aria-label={"LED momentan " + (pe11Connected && active ? "eingeschaltet" : "ausgeschaltet")}>
                  <span className="led" style={{ opacity: pe11Connected && active ? 1 : 0.12, boxShadow: pe11Connected && active ? "0 0 25px rgba(245,65,78,.75)" : "none" }}/>
                </div>
                <span>Momentan</span>
              </div>
              <div className="led-visual">
                <div className="led-frame" role="img" aria-label="Vereinfachtes Modell der zeitlich gemittelten Helligkeit">
                  <span className="led" style={{ opacity: pe11Connected && result ? Math.max(0.12, result.duty) : 0.12, boxShadow: pe11Connected && result ? "0 0 " + (3 + 25 * result.duty) + "px rgba(245,65,78,.55)" : "none" }}/>
                </div>
                <span>Mittelwert</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="code-header">
              <div><div className="eyebrow">06 / C-TRANSFER</div><h2>HAL-Ausschnitt</h2></div>
              <button type="button" className="button button-ghost" onClick={() => setShowCode(!showCode)} aria-expanded={showCode}>{showCode ? "Ausblenden" : "Anzeigen"}</button>
            </div>
            {showCode && <>
              <pre className="code"><code>{code}</code></pre>
              <p className="field-hint">Didaktischer Ausschnitt, kein vollständiges Firmwareprojekt. Für TIM2 muss ein anderer passender Ausgangspin konfiguriert werden. Der Einzelschrittmodus der Website ist keine HAL-Funktion.</p>
            </>}
          </section>
        </section>
      </div>
      <p className="disclaimer">Der Prescaler wird für das Lernexperiment als bereits geladener Teiler behandelt. Beim realen STM32 werden PSC-Schreibzugriffe erst mit dem Update-Ereignis wirksam; die hier simulierte Phase beginnt nach jedem Registerwechsel wieder bei null. Taktbaum-Modellgrenzen: HSE/HSI/PLL-Generierung, Wechsel zur Laufzeit, Overdrive und Flash-Waitstates sind nicht simuliert. Modellgrenzen der Timer-Peripherie: idealisierter Upcounting-Betrieb mit PWM Mode 1 und sofort gültigen PSC-/ARR-/CCR-Werten nach Neustart. Register-Preload, Update-Events bei laufendem Timer, Output-Enable und das vollständige Pin-Multiplexing werden noch nicht dynamisch simuliert. Die Browser-Zeitrafferfunktion ist unabhängig von der realen Timer-Taktfrequenz.</p>
    </main>
  );
}
