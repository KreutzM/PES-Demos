/** Vereinfachtes Upcounting-PWM-Modell für das PES-Praktikum.
 * Die Timertakte werden von der RCC-Taktbaumkonfiguration abgeleitet.
 * Die optionalen Standardwerte entsprechen dem Praktikumsprofil.
 */
export type TimerId = "TIM1" | "TIM2";

export const TIMER_CLOCKS_HZ: Readonly<Record<TimerId, number>> = {
  TIM1: 168_000_000,
  TIM2: 84_000_000,
};

export const TIMER_ARR_MAX: Readonly<Record<TimerId, number>> = {
  TIM1: 0xffff,
  TIM2: 0xffffffff,
};

export const PSC_MAX = 0xffff;

export interface TimerRegisters {
  psc: number;
  arr: number;
  ccr: number;
}

export interface TimerResult {
  timerClockHz: number;
  counterHz: number;
  pwmHz: number;
  periodSeconds: number;
  duty: number;
  activeTicks: number;
}

export function calculateTimer(
  timer: TimerId,
  registers: TimerRegisters,
  timerClockHz = TIMER_CLOCKS_HZ[timer],
): TimerResult {
  const { psc, arr, ccr } = registers;
  if (!Number.isFinite(timerClockHz) || timerClockHz <= 0) {
    throw new RangeError("Der Timer-Eingangstakt muss positiv und endlich sein.");
  }
  if (!Number.isInteger(psc) || psc < 0 || psc > PSC_MAX) {
    throw new RangeError("PSC muss eine ganze Zahl zwischen 0 und 65535 sein.");
  }
  if (!Number.isInteger(arr) || arr < 0 || arr > TIMER_ARR_MAX[timer]) {
    throw new RangeError("ARR ist außerhalb der Zählerbreite von " + timer + ".");
  }
  if (!Number.isInteger(ccr) || ccr < 0 || ccr > arr + 1 || ccr > TIMER_ARR_MAX[timer]) {
    throw new RangeError("CCR muss zwischen 0 und min(ARR + 1, Registermaximum) liegen.");
  }
  const counterHz = timerClockHz / (psc + 1);
  const pwmHz = counterHz / (arr + 1);
  return {
    timerClockHz,
    counterHz,
    pwmHz,
    periodSeconds: 1 / pwmHz,
    duty: ccr / (arr + 1),
    activeTicks: ccr,
  };
}

/** Zustandsmodell für das Zählwerk. Die simulierte Zeitbasis ist ein CNT-Tick,
 * nicht ein Browserframe oder ein Systemtaktzyklus. */
export interface CounterState {
  cnt: number;
  overflows: number;
}

/** Zustand des internen PWM1-Referenzsignals (OCxREF), vor der Ausgangspolarität. */
export function pwmActive(cnt: number, ccr: number): boolean {
  return cnt < ccr;
}

/** Überspringt beliebig viele CNT-Ticks, ohne jeden Tick einzeln auszuführen. */
export function advanceCounter(state: CounterState, arr: number, ticks: number): CounterState {
  if (!Number.isSafeInteger(arr) || arr < 0 || !Number.isSafeInteger(state.cnt) ||
      state.cnt < 0 || state.cnt > arr || !Number.isSafeInteger(ticks) || ticks < 0 ||
      !Number.isSafeInteger(state.overflows) || state.overflows < 0) {
    throw new RangeError("Ungültiger Zählerzustand oder Tickanzahl.");
  }
  const period = arr + 1;
  const total = state.cnt + ticks;
  const overflows = state.overflows + Math.floor(total / period);
  if (!Number.isSafeInteger(overflows)) {
    throw new RangeError("Überlaufzähler außerhalb des sicheren Zahlenbereichs.");
  }
  return { cnt: total % period, overflows };
}

/** Anzahl weiterer Ticks bis zum nächsten automatischen Rücksprung auf CNT=0. */
export function ticksUntilOverflow(cnt: number, arr: number): number {
  if (!Number.isSafeInteger(cnt) || !Number.isSafeInteger(arr) || arr < 0 || cnt < 0 || cnt > arr) {
    throw new RangeError("Ungültiger Zählerstand.");
  }
  return arr + 1 - cnt;
}

/** Anzahl weiterer Ticks bis CNT=CCR (PWM1 wechselt dort in den inaktiven Zustand).
 * Bei CCR=0 bzw. CCR>ARR existiert kein solcher Flankenwechsel. */
export function ticksUntilCompare(cnt: number, arr: number, ccr: number): number | null {
  if (!Number.isSafeInteger(cnt) || !Number.isSafeInteger(arr) || !Number.isSafeInteger(ccr) ||
      arr < 0 || cnt < 0 || cnt > arr || ccr < 0 || ccr > arr + 1) {
    throw new RangeError("Ungültiger Compare-Zustand.");
  }
  if (ccr === 0 || ccr > arr) return null;
  return ccr > cnt ? ccr - cnt : arr + 1 - cnt + ccr;
}
