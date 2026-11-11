import { useState } from "react";
import Waveform from "./components/Waveform";
import { calculateTimer, TIMER_ARR_MAX, TIMER_CLOCKS_HZ, type TimerId } from "./model/timer";

function formatFrequency(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " Hz";
}

function formatPeriod(seconds: number): string {
  return (seconds * 1000).toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " ms";
}

export default function TimerPwmDemo() {
  const [timer, setTimer] = useState<TimerId>("TIM1");
  const [psc, setPsc] = useState(16799);
  const [arr, setArr] = useState(9999);
  const [ccr, setCcr] = useState(5000);
  const [showCode, setShowCode] = useState(false);

  let result: ReturnType<typeof calculateTimer> | null = null;
  let error = "";
  try {
    result = calculateTimer(timer, { psc, arr, ccr });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Ungültige Timer-Konfiguration.";
  }

  function setPeriod(nextArr: number) {
    const safeArr = Math.max(0, Math.min(TIMER_ARR_MAX[timer], Math.trunc(nextArr) || 0));
    const previousDuty = ccr / (arr + 1);
    setArr(safeArr);
    setCcr(Math.round(previousDuty * (safeArr + 1)));
  }

  function applyPreset(next: "blink" | "dim") {
    setTimer("TIM1");
    if (next === "blink") {
      setPsc(16799);
      setArr(9999);
      setCcr(5000);
    } else {
      setPsc(167);
      setArr(999);
      setCcr(500);
    }
  }

  const code = [
    "htim.Instance = " + timer + ";",
    "htim.Init.Prescaler = " + psc + ";",
    "htim.Init.Period = " + arr + ";",
    "",
    "oc.OCMode = TIM_OCMODE_PWM1;",
    "oc.Pulse = " + ccr + ";",
    "oc.OCPolarity = TIM_OCPOLARITY_LOW;",
    "",
    "HAL_TIM_PWM_ConfigChannel(&htim, &oc, TIM_CHANNEL_2);",
    "HAL_TIM_PWM_Start(&htim, TIM_CHANNEL_2);",
  ].join("\n");

  return (
    <main id="inhalt" className="container demo-main">
      <a className="breadcrumb" href="#/">← Alle Demos</a>
      <div className="demo-heading">
        <div>
          <div className="eyebrow">STM32F429 · TIMER-PERIPHERIE</div>
          <h1>Timer &amp; <span className="accent">PWM</span></h1>
          <p className="lead">Experimentiere mit Prescaler, Periodenregister und Compare-Wert. Beobachte, was aus deinen Registerwerten wird.</p>
        </div>
        <span className="version-pill">Demo · erster Prototyp</span>
      </div>
      <div className="lesson-note" role="note">
        <strong>Clock-Tree-Beispiel:</strong> Systemtakt 168 MHz, APB1 42 MHz, APB2 84 MHz; die Timer-Takte betragen hier 84 MHz (TIM2) bzw. 168 MHz (TIM1).
        Dies sind Werte des gewählten Konfigurationsprofils, keine fest verdrahteten Eigenschaften des STM32F429.
      </div>
      <div className="demo-layout">
        <section className="panel controls-panel" aria-labelledby="settings-title">
          <div className="panel-header">
            <div className="eyebrow">01 / KONFIGURATION</div>
            <h2 id="settings-title">Timer-Register</h2>
          </div>
          <div className="field">
            <label htmlFor="timer">Timer</label>
            <select id="timer" value={timer} onChange={(event) => setTimer(event.target.value as TimerId)}>
              <option value="TIM1">TIM1 · 16 Bit, APB2</option>
              <option value="TIM2">TIM2 · 32 Bit, APB1</option>
            </select>
            <p className="field-hint">Ein Wechsel übernimmt die Registerwerte unverändert.</p>
          </div>
          <div className="field">
            <label htmlFor="psc">PSC <span>Prescaler</span></label>
            <input id="psc" type="number" min="0" max="65535" step="1" value={psc} onChange={(event) => setPsc(Number(event.target.value))}/>
            <p className="field-hint">Timer-Tick = f<sub>TIM</sub> / (PSC + 1)</p>
          </div>
          <div className="field">
            <label htmlFor="arr">ARR <span>Auto-Reload-Register</span></label>
            <input id="arr" type="number" min="0" max={TIMER_ARR_MAX[timer]} step="1" value={arr} onChange={(event) => setPeriod(Number(event.target.value))}/>
            <p className="field-hint">Eine PWM-Periode umfasst ARR + 1 Zählschritte.</p>
          </div>
          <div className="field">
            <label htmlFor="ccr">CCR2 <span>Compare-Register</span></label>
            <input id="ccr" type="number" min="0" max={arr + 1} step="1" value={ccr} onChange={(event) => setCcr(Number(event.target.value))}/>
            <p className="field-hint">PWM Mode 1: aktiv für CNT &lt; CCR2.</p>
          </div>
          <div className="field slider-field">
            <label htmlFor="duty">Duty-Cycle <strong>{result ? (result.duty * 100).toFixed(1) : "–"} %</strong></label>
            <input id="duty" type="range" min="0" max="100" step="1" value={result ? result.duty * 100 : 0} onChange={(event) => setCcr(Math.round(Number(event.target.value) / 100 * (arr + 1)))} aria-label="Aktiver Duty-Cycle"/>
            <div className="range-labels"><span>0 %</span><span>100 %</span></div>
          </div>
          <div className="preset-buttons">
            <button type="button" className="button button-ghost" onClick={() => applyPreset("blink")}>↺ 1 Hz · Blinken</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("dim")}>↺ 1 kHz · Dimmen</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
        <section className="output-column" aria-label="Simulationsergebnis">
          <div className="panel">
            <div className="panel-header">
              <div className="eyebrow">02 / BERECHNUNG</div>
              <h2>Ergebnis</h2>
            </div>
            <div className="metrics">
              <div className="metric"><span>Timer-Eingang</span><strong>{(TIMER_CLOCKS_HZ[timer] / 1e6).toFixed(0)} <small>MHz</small></strong></div>
              <div className="metric"><span>Zähltakt</span><strong>{result ? formatFrequency(result.counterHz) : "–"}</strong></div>
              <div className="metric featured"><span>PWM-Frequenz</span><strong>{result ? formatFrequency(result.pwmHz) : "–"}</strong></div>
              <div className="metric"><span>Periodendauer</span><strong>{result ? formatPeriod(result.periodSeconds) : "–"}</strong></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div className="eyebrow">03 / ZEITDIAGRAMM</div>
              <h2>PWM Mode 1</h2>
              <p>Aktiver Compare-Ausgang, Upcounting. Die Darstellung zeigt drei Perioden und ist nicht zeitlich maßstabsgetreu animiert.</p>
            </div>
            {result ? <Waveform duty={result.duty} periodSeconds={result.periodSeconds}/> : <p>Korrigiere die Registerwerte, um das Signal zu sehen.</p>}
            <div className="wave-legend"><span className="legend-dot"/> Ausgang logisch aktiv <span className="wave-secondary">· Bei OCPolarity LOW physikalisch LOW an PE11.</span></div>
          </div>
          <div className="panel physical-panel">
            <div>
              <div className="eyebrow">04 / HARDWAREBEZUG</div>
              <h2>DOT-Segment · PE11</h2>
              <p>Konzeptansicht: TIM1_CH2 über AF1, aktive Ausgangspolarität LOW. Für die reale Anzeige muss zusätzlich die passende Stelle aktiviert sein.</p>
            </div>
            <div className="led-frame" aria-label="Virtuelle rote DOT-LED, Helligkeit entspricht ungefähr dem Duty-Cycle">
              <span className="led" style={{ opacity: result ? Math.max(0.12, result.duty) : 0.12, boxShadow: result ? "0 0 " + (3 + 30 * result.duty) + "px rgba(245,65,78,.65)" : "none" }} />
            </div>
          </div>
          <div className="panel">
            <div className="code-header"><div><div className="eyebrow">05 / C-TRANSFER</div><h2>HAL-Ausschnitt</h2></div><button type="button" className="button button-ghost" onClick={() => setShowCode(!showCode)} aria-expanded={showCode}>{showCode ? "Ausblenden" : "Anzeigen"}</button></div>
            {showCode && <><pre className="code"><code>{code}</code></pre><p className="field-hint">Bewusst nur ein Ausschnitt: Clock-, GPIO- und weitere Timer-Initialisierung fehlen. Für TIM2 müsste außerdem die Kanal-/Pin-Zuordnung separat angepasst werden.</p></>}
          </div>
        </section>
      </div>
      <p className="disclaimer">Modellgrenzen dieser ersten Version: nur Upcounting und idealisierte PWM Mode 1. Preload, Update-Events, Register-Bitfelder und die vollständige GPIO-/Output-Compare-Logik werden in späteren Entwicklungsphasen ergänzt.</p>
    </main>
  );
}
