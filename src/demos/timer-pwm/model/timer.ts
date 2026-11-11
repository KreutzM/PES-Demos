/** Vereinfachtes Upcounting-PWM-Modell für das Clock-Tree-Beispiel aus dem PES-Praktikum.
 * TIM1: APB2-Timerclock 168 MHz; TIM2: APB1-Timerclock 84 MHz.
 * Die Takte sind ein KONFIGURATIONSPROFIL, keine fest verdrahteten MCU-Eigenschaften.
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

export function calculateTimer(timer: TimerId, registers: TimerRegisters): TimerResult {
  const { psc, arr, ccr } = registers;
  if (!Number.isInteger(psc) || psc < 0 || psc > PSC_MAX) {
    throw new RangeError("PSC muss eine ganze Zahl zwischen 0 und 65535 sein.");
  }
  if (!Number.isInteger(arr) || arr < 0 || arr > TIMER_ARR_MAX[timer]) {
    throw new RangeError("ARR ist außerhalb der Zählerbreite von " + timer + ".");
  }
  if (!Number.isInteger(ccr) || ccr < 0 || ccr > arr + 1) {
    throw new RangeError("CCR muss zwischen 0 und ARR + 1 liegen.");
  }
  const timerClockHz = TIMER_CLOCKS_HZ[timer];
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
