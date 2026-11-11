import { pwmActive } from "../model/timer";

interface WaveformProps {
  arr: number;
  ccr: number;
  cnt: number;
  periodSeconds: number;
}

const X0 = 65;
const PERIOD_WIDTH = 292;
const Y_COUNTER_TOP = 34;
const Y_COUNTER_BOTTOM = 138;
const Y_PWM_HIGH = 204;
const Y_PWM_LOW = 256;

function counterY(value: number, arr: number): number {
  return arr === 0 ? Y_COUNTER_BOTTOM : Y_COUNTER_BOTTOM - (value / arr) * (Y_COUNTER_BOTTOM - Y_COUNTER_TOP);
}

/** Bei kleinen ARR-Werten jeden einzelnen CNT-Wert als Treppe zeigen. */
function counterPath(arr: number): string {
  const n = arr + 1;
  const instructions: string[] = [];
  for (let period = 0; period < 2; period += 1) {
    const x0 = X0 + period * PERIOD_WIDTH;
    if (n <= 24) {
      instructions.push("M " + x0 + " " + counterY(0, arr));
      for (let tick = 0; tick < n; tick += 1) {
        const xEnd = x0 + (tick + 1) / n * PERIOD_WIDTH;
        instructions.push("L " + xEnd + " " + counterY(tick, arr));
        instructions.push("L " + xEnd + " " + counterY(tick === arr ? 0 : tick + 1, arr));
      }
    } else {
      // Schematischer Verlauf statt Millionen SVG-Segmente.
      instructions.push("M " + x0 + " " + Y_COUNTER_BOTTOM);
      instructions.push("L " + (x0 + PERIOD_WIDTH - 0.5) + " " + Y_COUNTER_TOP);
      instructions.push("L " + (x0 + PERIOD_WIDTH) + " " + Y_COUNTER_BOTTOM);
    }
  }
  return instructions.join(" ");
}

function pwmPath(arr: number, ccr: number): string {
  const duty = ccr / (arr + 1);
  const d: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const x0 = X0 + i * PERIOD_WIDTH;
    const x1 = x0 + PERIOD_WIDTH;
    if (i === 0) {
      d.push("M " + x0 + " " + (duty > 0 ? Y_PWM_HIGH : Y_PWM_LOW));
    }
    if (duty === 0) {
      d.push("L " + x1 + " " + Y_PWM_LOW);
    } else if (duty === 1) {
      d.push("L " + x1 + " " + Y_PWM_HIGH);
    } else {
      const fallingEdge = x0 + duty * PERIOD_WIDTH;
      d.push("L " + fallingEdge + " " + Y_PWM_HIGH);
      d.push("L " + fallingEdge + " " + Y_PWM_LOW);
      d.push("L " + x1 + " " + Y_PWM_LOW);
      if (i === 0) d.push("L " + x1 + " " + Y_PWM_HIGH);
    }
  }
  return d.join(" ");
}

export default function Waveform({ arr, ccr, cnt, periodSeconds }: WaveformProps) {
  const isActive = pwmActive(cnt, ccr);
  const cursorX = X0 + ((cnt + 0.5) / (arr + 1)) * PERIOD_WIDTH;
  const cursorY = counterY(cnt, arr);
  const compareX = X0 + ccr / (arr + 1) * PERIOD_WIDTH;
  const stepsVisible = arr < 24;
  const counter = counterPath(arr);
  const pwm = pwmPath(arr, ccr);
  const periodMs = (periodSeconds * 1000).toLocaleString("de-DE", { maximumFractionDigits: 3 });

  return (
    <div>
      <svg className="waveform timeline-svg" viewBox="0 0 700 303" role="img"
        aria-label={"Zählstand " + cnt + " von 0 bis " + arr + ". PWM aktuell " + (isActive ? "aktiv" : "inaktiv") + ". Duty " + (ccr / (arr + 1) * 100).toFixed(2) + " Prozent."}>
        <title>Synchronisierte Zähler- und PWM-Darstellung</title>
        <desc>Das obere Signal zeigt den CNT-Verlauf, die orange Linie den CCR2-Wert. Unten ist PWM Mode 1 dargestellt. Der gestrichelte Cursor markiert den aktuellen Tick.</desc>
        <rect x={X0} y="20" width={PERIOD_WIDTH * 2} height="260" rx="8" className="timeline-background" />
        {[0, 1, 2].map((i) => (
          <line key={i} x1={X0 + i * PERIOD_WIDTH} y1="20" x2={X0 + i * PERIOD_WIDTH} y2="280" className="wave-grid"/>
        ))}
        <line x1={X0} x2={X0 + 2 * PERIOD_WIDTH} y1={Y_COUNTER_BOTTOM} y2={Y_COUNTER_BOTTOM} className="wave-guide"/>
        <line x1={X0} x2={X0 + 2 * PERIOD_WIDTH} y1={Y_PWM_HIGH} y2={Y_PWM_HIGH} className="wave-guide"/>
        <line x1={X0} x2={X0 + 2 * PERIOD_WIDTH} y1={Y_PWM_LOW} y2={Y_PWM_LOW} className="wave-guide"/>
        <text x="5" y="52" className="timeline-caption">CNT</text>
        <text x="5" y="79" className="wave-label">{arr.toLocaleString("de-DE")}</text>
        <text x="45" y="141" className="wave-label">0</text>
        <text x="5" y="220" className="timeline-caption">PWM</text>
        <text x="44" y="209" className="wave-label">1</text>
        <text x="44" y="261" className="wave-label">0</text>
        {ccr <= arr && (
          <>
            <line x1={X0} x2={X0 + 2 * PERIOD_WIDTH} y1={counterY(ccr, arr)} y2={counterY(ccr, arr)} className="compare-guide" />
            <text x={X0 + 2 * PERIOD_WIDTH - 6} y={Math.max(25, counterY(ccr, arr) - 7)}
              className="compare-label" textAnchor="end">CCR2 = {ccr.toLocaleString("de-DE")}</text>
          </>
        )}
        {ccr > 0 && ccr <= arr && [0, 1].map((i) => (
          <line key={i} x1={compareX + i * PERIOD_WIDTH} y1="155"
            x2={compareX + i * PERIOD_WIDTH} y2="273" className="compare-edge"/>
        ))}
        <path d={counter} className="cnt-signal"/>
        <path d={pwm} className="wave-signal"/>
        <line x1={cursorX} x2={cursorX} y1="22" y2="278" className="cnt-cursor"/>
        <circle cx={cursorX} cy={cursorY} r="6" className="cnt-cursor-dot"/>
        <circle cx={cursorX} cy={isActive ? Y_PWM_HIGH : Y_PWM_LOW} r="5" className="cnt-cursor-dot"/>
        <text x={X0 + PERIOD_WIDTH / 2} y="294" textAnchor="middle" className="wave-label">T = {periodMs} ms</text>
        <text x={X0 + PERIOD_WIDTH * 1.5} y="294" textAnchor="middle" className="wave-label">T = {periodMs} ms</text>
      </svg>
      <p className="timeline-hint">{stepsVisible ? "CNT wird tickweise als Treppe dargestellt." : "Bei großem ARR ist der CNT-Anstieg schematisch als Linie dargestellt."} Der Cursor zeigt stets denselben CNT-Stand wie die Registeranzeige.</p>
    </div>
  );
}
