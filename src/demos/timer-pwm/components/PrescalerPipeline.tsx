import type { ClockedCounterState } from "../model/prescaler";

interface Props {
  timclkHz: number;
  psc: number;
  arr: number;
  ccr: number;
  state: ClockedCounterState;
  onClockStep: (cycles: number) => void;
  onSmallExample: () => void;
}

function f(hz: number): string {
  if (hz >= 1e6) return (hz / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " MHz";
  if (hz >= 1e3) return (hz / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " kHz";
  return hz.toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " Hz";
}

function t(seconds: number): string {
  if (seconds < 1e-6) return (seconds * 1e9).toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " ns";
  if (seconds < 1e-3) return (seconds * 1e6).toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " µs";
  if (seconds < 1) return (seconds * 1e3).toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " ms";
  return seconds.toLocaleString("de-DE", { maximumFractionDigits: 4 }) + " s";
}

export default function PrescalerPipeline({ timclkHz, psc, arr, ccr, state, onClockStep, onSmallExample }: Props) {
  const divisor = psc + 1;
  const counterHz = timclkHz / divisor;
  const pwmHz = counterHz / (arr + 1);
  const untilNext = divisor - state.prescalerPhase;
  const stepsVisible = divisor <= 16;
  const countTickJustEmitted = state.lastCounterTicks > 0;
  return (
    <section className="panel divider-lab" aria-labelledby="divider-lab-title">
      <div className="divider-title-row">
        <div>
          <div className="eyebrow">VOM TAKT ZUM PWM-SIGNAL · ZWEI TEILER</div>
          <h2 id="divider-lab-title">Warum immer „+ 1“?</h2>
          <p>PSC und ARR speichern jeweils den <strong>Endwert einer Zählung ab 0</strong>.
            Deshalb zählt der Prescaler <strong>0 … PSC</strong> und CNT <strong>0 … ARR</strong>.</p>
        </div>
        <button type="button" className="button button-ghost" onClick={onSmallExample}>Beispiel: PSC = 3</button>
      </div>

      <div className="divider-flow" aria-label="Taktweg vom Timer-Eingang bis zur PWM">
        <div className="divider-stage">
          <span className="divider-stage-index">01 · EINGANG</span>
          <span className="divider-stage-title">TIMxCLK</span>
          <strong>{f(timclkHz)}</strong>
          <small>alle {t(1 / timclkHz)} ein Eingangstakt</small>
        </div>
        <span className="divider-flow-arrow" aria-hidden="true">→</span>
        <div className="divider-stage divider-stage-psc">
          <span className="divider-stage-index">02 · PRESCALER</span>
          <span className="divider-stage-title">PSC = {psc.toLocaleString("de-DE")}</span>
          <strong>÷ {divisor.toLocaleString("de-DE")}</strong>
          <small>{divisor.toLocaleString("de-DE")} Eingangstakte / CNT-Tick</small>
        </div>
        <span className="divider-flow-arrow" aria-hidden="true">→</span>
        <div className="divider-stage">
          <span className="divider-stage-index">03 · ZÄHLTAKT</span>
          <span className="divider-stage-title">CK_CNT</span>
          <strong>{f(counterHz)}</strong>
          <small>ein CNT-Tick alle {t(1 / counterHz)}</small>
        </div>
        <span className="divider-flow-arrow" aria-hidden="true">→</span>
        <div className="divider-stage divider-stage-arr">
          <span className="divider-stage-index">04 · AUTO-RELOAD</span>
          <span className="divider-stage-title">ARR = {arr.toLocaleString("de-DE")}</span>
          <strong>÷ {(arr + 1).toLocaleString("de-DE")}</strong>
          <small>{(arr + 1).toLocaleString("de-DE")} CNT-Ticks / Periode</small>
        </div>
        <span className="divider-flow-arrow" aria-hidden="true">→</span>
        <div className="divider-stage divider-stage-output">
          <span className="divider-stage-index">05 · AUSGANG</span>
          <span className="divider-stage-title">PWM</span>
          <strong>{f(pwmHz)}</strong>
          <small>Periodendauer {t(1 / pwmHz)}</small>
        </div>
      </div>

      <div className="divider-interactive">
        <div className="divider-live-heading">
          <div>
            <strong>Ein Blick ins Prescaler-Zählwerk</strong>
            <p>Jede Klickaktion schaltet die angegebene Zahl von <em>Timer-Eingangstakten</em> weiter, nicht von CPU-Instruktionen.</p>
          </div>
          <div className="divider-phase-number" aria-live="polite">
            <span>Teilerfortschritt</span>
            <strong>{state.prescalerPhase.toLocaleString("de-DE")} / {divisor.toLocaleString("de-DE")}</strong>
          </div>
        </div>

        {stepsVisible ? (
          <div className="divider-cycle-grid" role="img"
            aria-label={state.prescalerPhase + " von " + divisor + " Eingangstakten seit dem letzten CNT-Tick verarbeitet"}>
            {Array.from({ length: divisor }, (_, index) => (
              <span key={index} className={"divider-cycle-cell" + (index < state.prescalerPhase ? " is-past" : "") + (index === divisor - 1 ? " is-terminal" : "")}
                title={"Eingangstakt " + (index + 1) + " von " + divisor + (index === divisor - 1 ? " → CNT-Tick" : "")}>
                {index + 1}
              </span>
            ))}
          </div>
        ) : (
          <div className="divider-cycle-meter" role="progressbar" aria-valuemin={0}
            aria-valuemax={divisor} aria-valuenow={state.prescalerPhase} aria-label="TIMxCLK-Flanken bis zum nächsten CNT-Tick">
            <span style={{ width: (state.prescalerPhase / divisor * 100) + "%" }} />
          </div>
        )}

        <div className="divider-step-actions">
          <button type="button" className="button button-primary" onClick={() => onClockStep(1)}>+1 TIMxCLK-Flanke</button>
          <button type="button" className="button button-ghost" onClick={() => onClockStep(untilNext)}>
            → Nächster CNT-Tick <span className="divider-button-muted">({untilNext.toLocaleString("de-DE")} Takte)</span>
          </button>
        </div>
        <div className="divider-snapshot" aria-live="polite">
          <div className="divider-psc-status">
            <span className={countTickJustEmitted ? "divider-status-dot fired" : "divider-status-dot"} aria-hidden="true" />
            <span>{countTickJustEmitted
              ? (state.lastCounterTicks === 1 ? "CNT-Tick erzeugt!" : state.lastCounterTicks.toLocaleString("de-DE") + " CNT-Ticks erzeugt")
              : "Noch kein neuer CNT-Tick"}
            </span>
          </div>
          <span>Aktuell: <strong>CNT = {state.cnt.toLocaleString("de-DE")}</strong></span>
          <span>Compare: <strong>CCR2 = {ccr.toLocaleString("de-DE")}</strong></span>
        </div>
        <p className="divider-explanation">
          {countTickJustEmitted
            ? "Der interne Prescaler hat seinen Endwert erreicht und wieder bei 0 begonnen. Erst dadurch wurde CNT weitergeschaltet."
            : "Der Prescaler zählt Eingangstakte. CNT bleibt unverändert, bis der Prescaler genau " + divisor.toLocaleString("de-DE") + " Takte abgeschlossen hat."}
          {" "}Bei <strong>PSC = 0</strong> entsteht schon nach einer Eingangstaktflanke ein CNT-Tick.
        </p>
      </div>

      <div className="divider-equations">
        <div><span>1. Prescaler</span><strong>f<sub>CNT</sub> = f<sub>TIM</sub> / (PSC + 1)</strong></div>
        <div><span>2. Auto-Reload</span><strong>f<sub>PWM</sub> = f<sub>CNT</sub> / (ARR + 1)</strong></div>
        <div><span>3. Compare</span><strong>Duty = CCR2 / (ARR + 1) = {(100 * ccr / (arr + 1)).toLocaleString("de-DE", { maximumFractionDigits: 3 })} %</strong></div>
      </div>
      <p className="divider-footnote">Vereinfachtes Modell mit bereits aktiv geladenen PSC-/ARR-Werten. Beim echten STM32F429 wird der PSC-Wert gepuffert; eine Änderung wird erst bei einem Update-Ereignis wirksam. Die Website setzt bei Registeränderungen die Simulation zurück. Details: ST RM0090, Timer-Time-Base-Unit.</p>
    </section>
  );
}
