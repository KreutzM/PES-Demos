import { describe, expect, it } from "vitest";
import {
  advanceTimerClocks, clockCyclesUntilCountTick, INITIAL_CLOCKED_COUNTER,
} from "./prescaler";

describe("Prescaler-Ticks vor CNT-Ticks", () => {
  it("PSC=3 erzeugt genau nach vier TIMxCLK-Flanken einen CNT-Schritt", () => {
    let state = { ...INITIAL_CLOCKED_COUNTER };
    for (let phase = 1; phase <= 3; phase += 1) {
      state = advanceTimerClocks(state, 3, 9, 1);
      expect(state.cnt).toBe(0);
      expect(state.prescalerPhase).toBe(phase);
      expect(state.lastCounterTicks).toBe(0);
    }
    state = advanceTimerClocks(state, 3, 9, 1);
    expect(state).toEqual({
      cnt: 1, overflows: 0, prescalerPhase: 0, lastCounterTicks: 1,
    });
  });

  it("PSC=0 erzeugt bei jeder TIMxCLK-Flanke einen CNT-Tick", () => {
    expect(advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 0, 9, 1)).toEqual({
      cnt: 1, overflows: 0, prescalerPhase: 0, lastCounterTicks: 1,
    });
  });

  it("PSC=16799 benötigt 16800 Flanken je CNT-Tick", () => {
    const before = advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 16799, 9999, 16799);
    expect(before.cnt).toBe(0);
    expect(before.prescalerPhase).toBe(16799);
    expect(clockCyclesUntilCountTick(16799, before.prescalerPhase)).toBe(1);
    const after = advanceTimerClocks(before, 16799, 9999, 1);
    expect(after.cnt).toBe(1);
    expect(after.prescalerPhase).toBe(0);
    expect(after.lastCounterTicks).toBe(1);
  });

  it("Einzeltakte und Batch-Verarbeitung liefern denselben Stand", () => {
    let byOne = { ...INITIAL_CLOCKED_COUNTER };
    for (let i = 0; i < 51; i += 1) byOne = advanceTimerClocks(byOne, 3, 9, 1);
    const batch = advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 3, 9, 51);
    expect(byOne.cnt).toBe(batch.cnt);
    expect(byOne.overflows).toBe(batch.overflows);
    expect(byOne.prescalerPhase).toBe(batch.prescalerPhase);
    expect(batch.lastCounterTicks).toBe(12);
  });

  it("Teilweise gefüllter Prescaler bleibt bei einem CNT-Tick erhalten", () => {
    const partial = advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 3, 9, 2);
    const next = advanceTimerClocks(partial, 3, 9, 4);
    expect(next.cnt).toBe(1);
    expect(next.prescalerPhase).toBe(2);
    expect(next.lastCounterTicks).toBe(1);
  });

  it("CNT erreicht ARR und springt dann auf 0; PSC teilt unabhängig davon", () => {
    const state = { cnt: 9, overflows: 2, prescalerPhase: 3, lastCounterTicks: 0 };
    expect(advanceTimerClocks(state, 3, 9, 1)).toEqual({
      cnt: 0, overflows: 3, prescalerPhase: 0, lastCounterTicks: 1,
    });
  });

  it("unterstützt den gesamten 16-Bit-PSC-Bereich", () => {
    const before = advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 65535, 9, 65535);
    expect(before.cnt).toBe(0);
    expect(advanceTimerClocks(before, 65535, 9, 1).cnt).toBe(1);
  });

  it("weist ungültige Prescalerzustände und Taktzahlen zurück", () => {
    expect(() => clockCyclesUntilCountTick(3, 4)).toThrow(RangeError);
    expect(() => clockCyclesUntilCountTick(-1, 0)).toThrow(RangeError);
    expect(() => advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 3, 9, -1)).toThrow(RangeError);
    expect(() => advanceTimerClocks({ ...INITIAL_CLOCKED_COUNTER }, 3, 9, 0.5)).toThrow(RangeError);
  });
});
