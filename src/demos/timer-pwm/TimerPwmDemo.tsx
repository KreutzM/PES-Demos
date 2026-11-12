import { useEffect, useState } from "react";
import Waveform from "./components/Waveform";
import ClockTree from "./components/ClockTree";
import PrescalerPipeline from "./components/PrescalerPipeline";
import GuidedTimerLesson from "./components/GuidedTimerLesson";
import DotSignalPath from "./components/DotSignalPath";
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

interface PresetSnapshot {
  timer: TimerId;
  clockConfig: ClockConfig;
  psc: number;
  arr: number;
  ccr: number;
  counter: ClockedCounterState;
  playback: Playback;
}

function formatFrequency(value: number): string {
  return value > 0 && value < 0.00005
    ? value.toExponential(2) + " Hz"
    : value.toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " Hz";
}

function formatPeriod(seconds: number): string {
  if (seconds < 1e-6) return (seconds * 1e9).toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " ns";
  if (seconds < 1e-3) return (seconds * 1e6).toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " µs";
  if (seconds < 1) return (seconds * 1e3).toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " ms";
  return seconds.toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " s";
}

function formatDutyPercent(duty: number): string {
  // Rounded 100,0 % would falsely imply an always-active OC2REF.
  const percent = 100 * duty;
  if (duty < 1 && percent >= 99.95) return "< 100";
  if (duty > 0 && percent < 0.05) return "> 0";
  return percent.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function TimerPwmDemo() {
  const [timer, setTimer] = useState<TimerId>("TIM1");
  const [clockConfig, setClockConfig] = useState<ClockConfig>({ ...DEFAULT_CLOCK_CONFIG });
  const [psc, setPsc] = useState(3);
  const [arr, setArr] = useState(9);
  const [ccr, setCcr] = useState(3);
  const [counter, setCounter] = useState<ClockedCounterState>({ ...INITIAL_CLOCKED_COUNTER });
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState<Playback>("ticks");
  const [showCode, setShowCode] = useState(false);
  const [savedBeforePreset, setSavedBeforePreset] = useState<PresetSnapshot | null>(null);
  const [presetStatus, setPresetStatus] = useState("");
  const [lessonView, setLessonView] = useState<"guided" | "free">("guided");
  const [lessonStep, setLessonStep] = useState(0);
  const [lessonAnswer, setLessonAnswer] = useState("");
  const [freeSnapshot, setFreeSnapshot] = useState<PresetSnapshot>({
    timer: "TIM1", clockConfig: { ...DEFAULT_CLOCK_CONFIG },
    psc: 16799, arr: 9, ccr: 3,
    counter: { ...INITIAL_CLOCKED_COUNTER }, playback: "ticks",
  });

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
  // CCR2 is an independent 16/32-bit register, not restricted to ARR + 1.
  const maxCcr = maxArr;

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
    setCcr(Math.min(ccr, TIMER_ARR_MAX[next]));
    setTimer(next);
  }

  function changePrescaler(value: number) {
    resetCounter();
    setPsc(Math.max(0, Math.min(65535, Math.trunc(value) || 0)));
  }

  function changePeriod(value: number) {
    resetCounter();
    const boundedArr = Math.max(0, Math.min(maxArr, Math.trunc(value) || 0));
    // ARR and CCR2 are independent hardware registers. No hidden CCR2 write.
    setArr(boundedArr);
  }

  function changeCompare(value: number) {
    resetCounter();
    setCcr(Math.max(0, Math.min(maxCcr, Math.trunc(value) || 0)));
  }

  function applyPreset(preset: Preset) {
    setSavedBeforePreset({
      timer, clockConfig: { ...clockConfig }, psc, arr, ccr,
      counter: { ...counter }, playback,
    });
    setPresetStatus("Voreinstellung geladen: TIM1, RCC-Profil, PSC, ARR, CCR2 und Wiedergabemodus wurden gesetzt; die Zählung beginnt neu.");
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

  function restorePresetConfiguration() {
    if (!savedBeforePreset) return;
    setPlaying(false);
    setTimer(savedBeforePreset.timer);
    setClockConfig({ ...savedBeforePreset.clockConfig });
    setPsc(savedBeforePreset.psc);
    setArr(savedBeforePreset.arr);
    setCcr(savedBeforePreset.ccr);
    setCounter({ ...savedBeforePreset.counter });
    setPlayback(savedBeforePreset.playback);
    setSavedBeforePreset(null);
    setPresetStatus("Vorherige Timer- und RCC-Konfiguration samt Zählerstand wiederhergestellt. Die Wiedergabe bleibt pausiert.");
  }

  function initializeGuidedExperiment(nextStep: number) {
    setPlaying(false);
    setTimer("TIM1");
    setClockConfig({ ...DEFAULT_CLOCK_CONFIG });
    setPsc(3);
    setArr(9);
    setCcr(3);
    setPlayback("ticks");
    setCounter({ ...INITIAL_CLOCKED_COUNTER });
    setLessonStep(nextStep);
    setLessonAnswer("");
  }

  function openGuidedLesson() {
    if (lessonView === "guided") return;
    setFreeSnapshot({
      timer, clockConfig: { ...clockConfig }, psc, arr, ccr,
      counter: { ...counter }, playback,
    });
    setLessonView("guided");
    initializeGuidedExperiment(0);
  }

  function jumpToLabSection(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function openFreeLab() {
    if (lessonView === "free") return;
    setPlaying(false);
    setLessonView("free");
    setTimer(freeSnapshot.timer);
    setClockConfig({ ...freeSnapshot.clockConfig });
    setPsc(freeSnapshot.psc);
    setArr(freeSnapshot.arr);
    setCcr(freeSnapshot.ccr);
    setCounter({ ...freeSnapshot.counter });
    setPlayback(freeSnapshot.playback);
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
    observation = "Periodischer CNT-Rücksprung (ARR → 0): Die nächste PWM-Periode beginnt. Im Modell entspricht dies einem periodischen Update-Ereignis.";
  } else if (ccr === 0) {
    observation = "CCR2 = 0: Das interne PWM-Referenzsignal OC2REF bleibt während der ganzen Periode inaktiv (0 %).";
  } else if (ccr > arr) {
    observation = "CCR2 > ARR: CNT erreicht den Vergleichswert nicht. OC2REF bleibt durchgehend aktiv (100 %).";
  } else if (counter.cnt === ccr && compareDistance !== null) {
    observation = "Vergleichsschwelle erreicht (CNT = CCR2): Im aufwärtszählenden PWM-Modus 1 wird OC2REF jetzt inaktiv.";
  } else if (active) {
    observation = "CNT < CCR2: Das interne PWM-Referenzsignal OC2REF ist aktiv.";
  } else {
    observation = "CNT ≥ CCR2: Das interne PWM-Referenzsignal OC2REF ist inaktiv.";
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
    <main id="inhalt" className={"container demo-main" + (lessonView === "guided" ? " guided-mode" : " free-lab")}>
      <a className="breadcrumb" href="#/">← Alle Demos</a>
      <div className="demo-heading">
        <div>
          <div className="eyebrow">STM32F429 · TIMER-PERIPHERIE</div>
          <h1>Timer &amp; <span className="accent">PWM</span></h1>
          <p className="lead">Beobachte die Timer-Register: Schalte den CNT-Zähler schrittweise weiter und untersuche das interne PWM-Referenzsignal OC2REF.</p>
        </div>
        <span className="version-pill">Lernlabor · Version 0.6</span>
      </div>

      <nav className="learning-mode-switch" aria-label="Timer-Lernmodus">
        <button type="button" className={lessonView === "guided" ? "selected" : ""}
          aria-pressed={lessonView === "guided"} onClick={openGuidedLesson}>Geführter Einstieg</button>
        <button type="button" className={lessonView === "free" ? "selected" : ""}
          aria-pressed={lessonView === "free"} onClick={openFreeLab}>Freies Labor</button>
      </nav>

      {lessonView === "guided" && result && (
        <GuidedTimerLesson
          step={lessonStep} answer={lessonAnswer} onAnswer={setLessonAnswer}
          psc={psc} arr={arr} ccr={ccr} state={counter} result={result}
          onInputClock={() => advanceInputCycles(1)}
          onCounterStep={advance}
          onPrescalerChange={changePrescaler}
          onPeriodChange={changePeriod}
          onGoToStep={initializeGuidedExperiment}
          onOpenFreeLab={openFreeLab}
        />
      )}

      {lessonView === "free" && <>
      <div className="lesson-note" role="note">
        <strong>RCC-Praktikumsprofil:</strong> SYSCLK 168 MHz · AHB ÷1 · APB1 ÷4 · APB2 ÷2 · TIMPRE = 0.
        Register und Zähler sind hier direkt bedienbar; der RCC-Taktbaum und das Prescaler-Labor folgen als Vertiefungen.
      </div>
      <nav className="lab-jump-nav" aria-label="Direkt zu einem Bereich im freien Labor">
        <span className="lab-jump-label">Direkt zu</span>
        <button type="button" onClick={() => jumpToLabSection("lab-register")}>Registern</button>
        <button type="button" onClick={() => jumpToLabSection("lab-counter")}>CNT &amp; Steuerung</button>
        <button type="button" onClick={() => jumpToLabSection("lab-waveform")}>Zeitdiagramm</button>
        <button type="button" onClick={() => jumpToLabSection("lab-clock")}>RCC-Taktbaum</button>
        <button type="button" onClick={() => jumpToLabSection("lab-prescaler")}>Prescaler-Labor</button>
      </nav>

      <div className="learning-intro">
        <div className="intro-icon" aria-hidden="true">01</div>
        <div>
          <h2>Frei experimentieren: Register ändern und das Signal beobachten</h2>
          <p>Ändere zuerst <strong>ARR von 9 auf 19</strong> und beobachte Frequenz und Tastverhältnis bei unverändertem CCR2.
          Nutze danach die Zählerschritte, das Zeitdiagramm oder die Sprungnavigation zu RCC und Prescaler.</p>
        </div>
      </div>

      <div className="demo-layout">
        <section id="lab-register" tabIndex={-1} className="panel controls-panel" aria-labelledby="settings-title">
          <div className="panel-header">
            <div className="eyebrow">01 / KONFIGURATION</div>
            <h2 id="settings-title">Timer-Register</h2>
          </div>
          <p id="register-reset-note" className="register-reset-note">Register- und RCC-Änderungen pausieren die Animation. CNT, Prescaler-Phase und CNT-Rücksprünge beginnen wieder bei null. Das Modell verwendet die neu eingestellten Registerwerte nach diesem Neustart.</p>
          <div className="field">
            <label htmlFor="timer">Timer</label>
            <select id="timer" aria-describedby="timer-hint register-reset-note" value={timer} onChange={(event) => changeTimer(event.target.value as TimerId)}>
              <option value="TIM1">TIM1 · 16 Bit, APB2</option>
              <option value="TIM2">TIM2 · 32 Bit, APB1</option>
            </select>
            <p id="timer-hint" className="field-hint">Beim Timerwechsel bleibt PSC erhalten; ARR und CCR2 werden nur bei Überschreiten der neuen Registerbreite begrenzt. CNT wird zurückgesetzt.</p>
          </div>
          <div className="field">
            <label htmlFor="psc">PSC <span>Prescaler</span></label>
            <input id="psc" aria-describedby="psc-hint register-reset-note" type="number" min="0" max="65535" step="1" value={psc} onChange={(event) => changePrescaler(Number(event.target.value))}/>
            <p id="psc-hint" className="field-hint">CNT-Zähltaktfrequenz: f<sub>CNT</sub> = f<sub>TIM</sub> / (PSC + 1)</p>
          </div>
          <div className="field">
            <label htmlFor="arr">ARR <span>Oberer CNT-Zählwert (Auto-Reload)</span></label>
            <input id="arr" aria-describedby="arr-hint register-reset-note lab-local-values" type="number" min="0" max={maxArr} step="1" value={arr} onChange={(event) => changePeriod(Number(event.target.value))}/>
            <p id="arr-hint" className="field-hint">CNT zählt von 0 bis ARR, also ARR + 1 Zählschritte pro Periode. Eine ARR-Änderung verändert CCR2 nicht.</p>
          </div>
          <div className="field">
            <label htmlFor="ccr">CCR2 <span>Vergleichswert für Kanal 2</span></label>
            <input id="ccr" aria-describedby="ccr-hint register-reset-note lab-local-values" type="number" min="0" max={maxCcr} step="1" value={ccr} onChange={(event) => changeCompare(Number(event.target.value))}/>
            <p id="ccr-hint" className="field-hint">Aufwärtszählender PWM-Modus 1: Das interne Signal OC2REF ist aktiv, solange CNT &lt; CCR2. CCR2 darf größer als ARR sein.</p>
          </div>
          <div className="lab-local-feedback" aria-label="Ergebnisse der aktuellen Registerwerte">
            <output id="lab-local-values" aria-live="off">
              <strong>Ergebnis:</strong> f<sub>PWM</sub> = {result ? formatFrequency(result.pwmHz) : "–"} ·
              Tastverhältnis = {result ? formatDutyPercent(result.duty) : "–"} % ·
              CCR2 = {ccr.toLocaleString("de-DE")} · CNT = {counter.cnt.toLocaleString("de-DE")}
            </output>
            <div className="lab-local-jumps">
              <button type="button" onClick={() => jumpToLabSection("lab-counter")}>→ CNT ansehen</button>
              <button type="button" onClick={() => jumpToLabSection("lab-waveform")}>→ Zeitdiagramm ansehen</button>
            </div>
          </div>
          {ccr > arr && <p className="register-compare-note" role="status">CCR2 ist größer als ARR: CNT erreicht diese Vergleichsschwelle nicht. Das interne OC2REF bleibt durchgehend aktiv (100 % Tastverhältnis).</p>}
          <div className="field slider-field">
            <label htmlFor="duty">Tastverhältnis (Duty Cycle) <strong>{result ? formatDutyPercent(result.duty) : "–"} %</strong></label>
            <input id="duty" type="range" min="0" max="100" step="1"
              value={result ? result.duty * 100 : 0}
              onChange={(event) => changeCompare(Math.min(maxCcr, Math.round(Number(event.target.value) / 100 * (arr + 1))))}
              aria-label="Tastverhältnis über CCR2 einstellen"
              aria-describedby={arr === maxArr ? "duty-hint duty-limit-note" : "duty-hint"}
              aria-valuetext={result ? formatDutyPercent(result.duty) + " Prozent" : undefined}/>
            <div className="range-labels"><span>0 %</span><span>{arr === maxArr ? "max. < 100 %" : "100 %"}</span></div>
            <p id="duty-hint" className="field-hint">CCR2 lässt sich nur in ganzen Registerschritten ändern. Das angezeigte Tastverhältnis kann deshalb vom eingestellten Prozentwert abweichen.</p>
            {arr === maxArr && <p id="duty-limit-note" className="field-hint duty-limit-note">Bei ARR = Registermaximum ist CCR2 = ARR + 1 nicht darstellbar. Exakt 100 % sind hier nicht möglich; am Sliderende gilt der größte erreichbare CCR2-Wert.</p>}
          </div>
          <p id="preset-effects" className="preset-effects">Alle Voreinstellungen laden <strong>TIM1, das RCC-Praktikumsprofil (168 MHz), PSC, ARR, CCR2 und den Wiedergabemodus</strong> neu. Die Wiedergabe stoppt; CNT, Prescaler-Phase und CNT-Rücksprünge werden auf null gesetzt.</p>
          <div className="preset-buttons" role="group" aria-label="Timer-Voreinstellungen" aria-describedby="preset-effects">
            <button type="button" className="button button-ghost" onClick={() => applyPreset("divider")}>Voreinstellung: PSC = 3 (÷4)</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("steps")}>Voreinstellung: 10 Zählschritte · 30 %</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("blink")}>Voreinstellung: 1 Hz · Blinken</button>
            <button type="button" className="button button-ghost" onClick={() => applyPreset("dim")}>Voreinstellung: 1 kHz · Dimmen</button>
          </div>
          {savedBeforePreset && <button type="button" className="button button-secondary preset-restore" onClick={restorePresetConfiguration}>↶ Vorherige Konfiguration wiederherstellen</button>}
          {presetStatus && <p className="preset-status" role="status">{presetStatus}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section className="output-column" aria-label="Timer-Simulation">
          <section id="lab-counter" tabIndex={-1} className="panel simulator-panel" aria-labelledby="sim-title">
            <div className="panel-header">
              <div className="eyebrow">02 / ZÄHLWERK</div>
              <h2 id="sim-title">Aktueller CNT-Zählerstand</h2>
              <p>Der Timer wird hier didaktisch verlangsamt. Du kannst sowohl einzelne <strong>Timer-Eingangstaktimpulse</strong> im Prescaler-Labor als auch vollständige <strong>CNT-Zählschritte</strong> weiterschalten. Die Animation ist unabhängig von der realen Timerfrequenz.</p>
            </div>
            <div className="counter-display">
              <div>
                <span className="counter-label">CNT</span>
                <strong className="counter-number">{counter.cnt.toLocaleString("de-DE")}</strong>
                <span className="counter-limits">0 … {arr.toLocaleString("de-DE")}</span>
              </div>
              <div className="counter-status">
                <span className={active ? "state-indicator state-active" : "state-indicator state-inactive"} aria-hidden="true" />
                <strong>{active ? "OC2REF = 1" : "OC2REF = 0"}</strong>
                <small>{active ? "CNT < CCR2" : "CNT ≥ CCR2"}</small>
              </div>
            </div>
            <div className="counter-progress" role="progressbar" aria-valuemin={0} aria-valuemax={arr} aria-valuenow={counter.cnt} aria-label="Zählerposition in der PWM-Periode">
              <span style={{ width: phasePercent + "%" }} />
              {ccr > 0 && ccr <= arr && <i style={{ left: ccr / (arr + 1) * 100 + "%" }} title="CCR2-Abschaltschwelle" />}
            </div>
            <div className="counter-extras">
              <span>CNT-Rücksprünge (ARR → 0): <strong>{counter.overflows.toLocaleString("de-DE")}</strong></span>
              <span>Bis zum nächsten Rücksprung: <strong>{overflowDistance?.toLocaleString("de-DE") ?? "–"} CNT-Zählschritte</strong></span>
            </div>

            <div className="playback-control">
              <label htmlFor="playback">Wiedergabe</label>
              <select id="playback" value={playback} onChange={(event) => setPlayback(event.target.value as Playback)}>
                <option value="ticks">Animation · 4 CNT-Zählschritte/s</option>
                <option value="period">Animation · ca. 5 s je dargestellter PWM-Periode</option>
              </select>
            </div>
            <div className="transport-buttons">
              <button type="button" className="button button-primary" onClick={() => setPlaying((before) => !before)} disabled={!result}>
                {playing ? "❚❚ Pause" : "▶ Start"}
              </button>
              <button type="button" className="button button-ghost" onClick={() => advance(1)} disabled={!result}>+1 CNT-Zählschritt</button>
              <button type="button" className="button button-ghost" onClick={() => advance(compareDistance ?? 0)} disabled={compareDistance === null} title={compareDistance === null ? "Keine Abschaltflanke: bei CCR2 = 0 bleibt OC2REF inaktiv, bei CCR2 > ARR bleibt es aktiv." : "Bis CNT = CCR2 weiterschalten (OC2REF wird inaktiv)."}>→ Zur Abschaltschwelle</button>
              <button type="button" className="button button-ghost" onClick={() => advance(overflowDistance ?? 0)} disabled={overflowDistance === null}>↻ Zum Rücksprung (ARR → 0)</button>
              <button type="button" className="button button-ghost" onClick={resetCounter}>CNT zurücksetzen</button>
            </div>
            <p className="observation" aria-label="Erklärung des aktuellen Zählerzustands">{observation}</p>
          </section>

          <section id="lab-waveform" tabIndex={-1} className="panel">
            <div className="panel-header">
              <div className="eyebrow">03 / SYNCHRONISIERTES ZEITDIAGRAMM</div>
              <h2>CNT, CCR2 und PWM Mode 1</h2>
              <p>Die orange Linie markiert die CCR2-Vergleichsschwelle, sofern ein Abschaltwechsel innerhalb der Periode stattfindet. Der weiße Cursor zeigt den aktuellen CNT-Zählschritt.</p>
            </div>
            {result ? <Waveform arr={arr} ccr={ccr} cnt={counter.cnt} periodSeconds={result.periodSeconds}/> : <p>Korrigiere die Registerwerte, um das Signal zu sehen.</p>}
            <div className="wave-legend"><span className="legend-dot"/> Intern aktives PWM-Referenzsignal OC2REF <span className="wave-secondary">· Bei OCPolarity LOW liegt währenddessen physikalisch LOW am Ausgang an.</span></div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="eyebrow">04 / BERECHNUNG</div>
              <h2>Vom Timer-Takt zur PWM-Frequenz</h2>
            </div>
            <div className="metrics">
              <div className="metric"><span>Timer-Eingangstaktfrequenz</span><strong>{(timerClockHz / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 5 })} <small>MHz</small></strong></div>
              <div className="metric"><span>CNT-Zähltaktfrequenz</span><strong>{result ? formatFrequency(result.counterHz) : "–"}</strong></div>
              <div className="metric featured"><span>PWM-Frequenz</span><strong>{result ? formatFrequency(result.pwmHz) : "–"}</strong></div>
              <div className="metric"><span>Periodendauer</span><strong>{result ? formatPeriod(result.periodSeconds) : "–"}</strong></div>
            </div>
            <p className="formula-line">f<sub>CNT</sub> = f<sub>TIM</sub> / (PSC + 1) &nbsp;·&nbsp; f<sub>PWM</sub> = f<sub>CNT</sub> / (ARR + 1)</p>
          </section>

          <section className="panel physical-panel">
            <div className="physical-summary">
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
            </div>
            <DotSignalPath
              timer={timer} cnt={counter.cnt} arr={arr} psc={psc} ccr={ccr}
              oc2refActive={active}
            />
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
      <div className="lab-deep-dive" aria-labelledby="lab-deep-dive-title">
        <div className="lab-deep-dive-heading">
          <div>
            <div className="eyebrow">VERTIEFUNGEN · TAKTWEG</div>
            <h2 id="lab-deep-dive-title">RCC-Taktbaum und Prescaler verstehen</h2>
            <p>Beide Bereiche arbeiten mit derselben Timer-Konfiguration wie die Register und das Zeitdiagramm.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={() => jumpToLabSection("lab-register")}>↑ Zur Registersteuerung</button>
        </div>
        <ClockTree config={clockConfig} clock={clock} activeTimer={timer} psc={psc} arr={arr}
          onChange={(next) => { resetCounter(); setClockConfig(next); }} />
        <PrescalerPipeline timclkHz={timerClockHz} psc={psc} arr={arr} ccr={ccr}
          state={counter} onClockStep={advanceInputCycles} onSmallExample={() => applyPreset("divider")} />
        <button type="button" className="button button-secondary lab-back-to-register" onClick={() => jumpToLabSection("lab-register")}>↑ Zurück zu den Registern</button>
      </div>
      <p className="disclaimer">Der Prescaler wird für das Lernexperiment als bereits geladener Teiler behandelt. Beim realen STM32 werden PSC-Schreibzugriffe erst mit dem Update-Ereignis wirksam; die hier simulierte Phase beginnt nach jedem Registerwechsel wieder bei null. Taktbaum-Modellgrenzen: HSE/HSI/PLL-Generierung, Wechsel zur Laufzeit, Overdrive und Flash-Waitstates sind nicht simuliert. Modellgrenzen der Timer-Peripherie: idealisierter Upcounting-Betrieb mit PWM Mode 1 und sofort gültigen PSC-/ARR-/CCR-Werten nach Neustart. Register-Preload, Update-Events bei laufendem Timer, Output-Enable und das vollständige Pin-Multiplexing werden noch nicht dynamisch simuliert. Die Browser-Zeitrafferfunktion ist unabhängig von der realen Timer-Taktfrequenz.</p>
      </>}
    </main>
  );
}
