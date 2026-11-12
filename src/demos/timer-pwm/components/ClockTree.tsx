import type { ClockConfig, ClockTreeResult, AhbDiv, ApbDiv, SysclkHz } from "../model/clockTree";
import { AHB_DIVISORS, APB_DIVISORS, DEFAULT_CLOCK_CONFIG, SYSCLK_OPTIONS } from "../model/clockTree";
import { TIMER_ARR_MAX, type TimerId } from "../model/timer";

interface Props {
  config: ClockConfig;
  clock: ClockTreeResult;
  activeTimer: TimerId;
  psc: number;
  arr: number;
  onChange: (next: ClockConfig) => void;
}

function mhz(hz: number): string {
  return (hz / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 5 }) + " MHz";
}

function hz(hzValue: number): string {
  return hzValue > 0 && hzValue < 0.000005
    ? hzValue.toExponential(2) + " Hz"
    : hzValue.toLocaleString("de-DE", { maximumFractionDigits: 5 }) + " Hz";
}

function BusPath({ name, pclk, timclk, active, details }: {
  name: string;
  pclk: number;
  timclk: number;
  active: boolean;
  details: { div: number; multiplier: number };
}) {
  return (
    <div className={"clock-path" + (active ? " selected" : "")}>
      <div className="clock-node">
        <span className="clock-node-title">APB{ name === "TIM1" ? "2" : "1" }</span>
        <span className="clock-node-value">{mhz(pclk)}</span>
        <small>Teiler /{details.div} · PCLK</small>
      </div>
      <div className="clock-connector"><span>×{details.multiplier}</span><span aria-hidden="true">→</span></div>
      <div className="clock-node timer-clock-node">
        <span className="clock-node-title">{name}CLK</span>
        <strong className="clock-node-value">{mhz(timclk)}</strong>
        <small>{name === "TIM1" ? "Advanced timer · 16 Bit" : "General-purpose · 32 Bit"}</small>
      </div>
    </div>
  );
}

export default function ClockTree({ config, clock, activeTimer, psc, arr, onChange }: Props) {
  const pwm1 = clock.tim1Hz / (psc + 1) / (arr + 1);
  const pwm2 = clock.tim2Hz / (psc + 1) / (arr + 1);
  const tim1CanRepresentArr = arr <= TIMER_ARR_MAX.TIM1;
  const rule = config.timpre
    ? "TIMPRE = 1: Bei APB-Teiler /1, /2 oder /4 gilt TIMxCLK = HCLK; bei /8 oder /16 gilt TIMxCLK = 4 × PCLKx."
    : "TIMPRE = 0: Bei APB-Teiler /1 gilt TIMxCLK = PCLKx; ab /2 gilt TIMxCLK = 2 × PCLKx.";
  return (
    <section className="panel clock-tree-panel" aria-labelledby="clock-tree-title">
      <div className="clock-tree-title-row">
        <div>
          <div className="eyebrow">RCC / TAKTBAUM · STM32F429</div>
          <h2 id="clock-tree-title">Woher bekommt der Timer seinen Takt?</h2>
          <p>Verändere die Bus-Prescaler und beobachte, wie sich die PWM-Frequenz bei <strong>unveränderten</strong> Timer-Registern verschiebt.</p>
        </div>
        <button className="button button-ghost" type="button" onClick={() => onChange({ ...DEFAULT_CLOCK_CONFIG })} title="Setzt nur das RCC-Taktprofil sowie den aktuellen Zählerzustand zurück">↺ RCC-Taktprofil zurücksetzen</button>
      </div>
      <div className="clock-controls">
        <label className="clock-select">SYSCLK
          <select value={config.sysclkHz} onChange={e => onChange({ ...config, sysclkHz: Number(e.target.value) as SysclkHz })}>
            {SYSCLK_OPTIONS.map(v => <option value={v} key={v}>{mhz(v)}</option>)}
          </select>
        </label>
        <label className="clock-select">AHB (HPRE)
          <select value={config.ahbDiv} onChange={e => onChange({ ...config, ahbDiv: Number(e.target.value) as AhbDiv })}>
            {AHB_DIVISORS.map(div => <option value={div} key={div}>÷{div}</option>)}
          </select>
        </label>
        <label className="clock-select">APB1 (PPRE1)
          <select value={config.apb1Div} onChange={e => onChange({ ...config, apb1Div: Number(e.target.value) as ApbDiv })}>
            {APB_DIVISORS.map(div => <option value={div} key={div}>÷{div}</option>)}
          </select>
        </label>
        <label className="clock-select">APB2 (PPRE2)
          <select value={config.apb2Div} onChange={e => onChange({ ...config, apb2Div: Number(e.target.value) as ApbDiv })}>
            {APB_DIVISORS.map(div => <option value={div} key={div}>÷{div}</option>)}
          </select>
        </label>
        <label className="clock-checkbox"><input type="checkbox" checked={config.timpre}
          onChange={e => onChange({ ...config, timpre: e.target.checked })}/>
          <span><strong>TIMPRE = {config.timpre ? 1 : 0}</strong><small>RCC_DCKCFGR[24]</small></span>
        </label>
      </div>
      <div className="clock-chart">
        <div className="clock-source-row">
          <div className="clock-node clock-source"><span className="clock-node-title">SYSCLK</span><strong className="clock-node-value">{mhz(clock.sysclkHz)}</strong><small>angenommener Systemtakt</small></div>
          <div className="clock-connector"><span>÷{config.ahbDiv}</span><span aria-hidden="true">→</span></div>
          <div className="clock-node clock-source"><span className="clock-node-title">HCLK / AHB</span><strong className="clock-node-value">{mhz(clock.hclkHz)}</strong><small>Core, AHB und APB-Eingang</small></div>
        </div>
        <div className="clock-branches">
          <BusPath name="TIM2" pclk={clock.apb1.pclkHz} timclk={clock.tim2Hz} active={activeTimer === "TIM2"} details={{div:config.apb1Div,multiplier:clock.apb1.timerMultiplier}} />
          <BusPath name="TIM1" pclk={clock.apb2.pclkHz} timclk={clock.tim1Hz} active={activeTimer === "TIM1"} details={{div:config.apb2Div,multiplier:clock.apb2.timerMultiplier}} />
        </div>
      </div>
      <p className="clock-rule"><strong>Timer-Regel:</strong> {rule} Änderungen am RCC-Taktprofil halten die Simulation an und setzen CNT sowie die Prescaler-Phase zurück.</p>
      {clock.warnings.length > 0 && <div className="clock-warnings" role="alert">
        <strong>Außerhalb der Hardware-Spezifikation:</strong> {clock.warnings.join(" ")} Die angezeigten Frequenzen sind in diesem Fall nur rechnerische Modellwerte.
      </div>}
      <div className="clock-comparison">
        <div><span>Gleiche Register: PSC = {psc.toLocaleString("de-DE")}, ARR = {arr.toLocaleString("de-DE")}</span><small>Vergleich der PWM-Frequenz bei identischen Registern</small></div>
        <div className={activeTimer === "TIM1" ? "comparison-active" : ""}>TIM1 <strong>{tim1CanRepresentArr ? hz(pwm1) : "nicht möglich"}</strong>{!tim1CanRepresentArr && <small>ARR überschreitet 16 Bit (65.535)</small>}</div>
        <div className={activeTimer === "TIM2" ? "comparison-active" : ""}>TIM2 <strong>{hz(pwm2)}</strong></div>
      </div>
      <p className="clock-footnote">Modell: SYSCLK-Werte werden als bereits korrekt konfigurierte Clock-Quelle angenommen; PLL, Versorgung und Overdrive (für 180 MHz nötig) werden nicht simuliert. Quelle: <a href="https://www.st.com/resource/en/reference_manual/rm0090-stm32f407-advanced-armbased-32bit-mcus-stmicroelectronics.pdf" target="_blank" rel="noopener noreferrer">ST RM0090, RCC Clock Tree und TIMPRE</a>.</p>
    </section>
  );
}
