import { advanceCounter, PSC_MAX, type CounterState } from "./timer";

/**
 * Didaktischer Teilerzustand des Timers bei festem, bereits geladenem PSC-Wert.
 * prescalerPhase=0: unmittelbar nach einem erzeugten CNT-Tick bzw. Reset.
 * Der nächste CNT-Tick folgt nach (PSC + 1 - prescalerPhase) TIMxCLK-Flanken.
 *
 * Nicht modelliert: Prescaler-Shadowregister, Timer-Enable-Startlatenz, Update-Events.
 */
export interface ClockedCounterState extends CounterState {
  prescalerPhase: number;
  lastCounterTicks: number;
}

export const INITIAL_CLOCKED_COUNTER: Readonly<ClockedCounterState> = Object.freeze({
  cnt: 0,
  overflows: 0,
  prescalerPhase: 0,
  lastCounterTicks: 0,
});

export function clockCyclesUntilCountTick(psc: number, phase: number): number {
  if (!Number.isInteger(psc) || psc < 0 || psc > PSC_MAX ||
      !Number.isInteger(phase) || phase < 0 || phase > psc) {
    throw new RangeError("Ungültiger PSC-Wert oder Teilerzustand.");
  }
  return psc + 1 - phase;
}

/** Verarbeitet eine Anzahl von TIMxCLK-Flanken in O(1), statt jeden MHz-Takt
 * einzeln zu simulieren. Die PWM-Logik benötigt nur die CNT-Ticks. */
export function advanceTimerClocks(
  state: ClockedCounterState,
  psc: number,
  arr: number,
  clockCycles: number,
): ClockedCounterState {
  const clocksUntilNextTick = clockCyclesUntilCountTick(psc, state.prescalerPhase);
  if (!Number.isSafeInteger(clockCycles) || clockCycles < 0 ||
      !Number.isSafeInteger(arr) || arr < 0 ||
      !Number.isSafeInteger(state.lastCounterTicks) || state.lastCounterTicks < 0) {
    throw new RangeError("Ungültige Anzahl von Eingangstakten oder Zählerzustand.");
  }
  const total = state.prescalerPhase + clockCycles;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("Zu viele Eingangstakte für eine exakte Berechnung.");
  }
  const divider = psc + 1;
  const countTicks = clockCycles < clocksUntilNextTick
    ? 0
    : Math.floor(total / divider);
  const advanced = advanceCounter(state, arr, countTicks);
  return {
    cnt: advanced.cnt,
    overflows: advanced.overflows,
    prescalerPhase: total % divider,
    lastCounterTicks: countTicks,
  };
}
