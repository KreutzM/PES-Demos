import { describe, expect, it } from "vitest";
import { advanceCounter, calculateTimer, pwmActive, ticksUntilCompare, ticksUntilOverflow } from "./timer";

describe("STM32F429-Upcounting PWM", () => {
  it("berechnet TIM1 mit PSC 16799 und ARR 9999 zu 1 Hz und 50 %", () => {
    const r = calculateTimer("TIM1", { psc: 16799, arr: 9999, ccr: 5000 });
    expect(r.counterHz).toBe(10_000);
    expect(r.pwmHz).toBe(1);
    expect(r.periodSeconds).toBe(1);
    expect(r.duty).toBe(0.5);
  });

  it("TIM2 läuft mit unverändertem PSC bei diesem Clock-Profil halb so schnell", () => {
    expect(calculateTimer("TIM2", { psc: 16799, arr: 9999, ccr: 5000 }).pwmHz).toBe(0.5);
  });

  it("TIM2 benötigt für 10 kHz Zählfrequenz PSC 8399", () => {
    expect(calculateTimer("TIM2", { psc: 8399, arr: 9999, ccr: 5000 }).pwmHz).toBe(1);
  });

  it("berücksichtigt 0 % und 100 % Tastverhältnis", () => {
    expect(calculateTimer("TIM1", { psc: 167, arr: 999, ccr: 0 }).duty).toBe(0);
    expect(calculateTimer("TIM1", { psc: 167, arr: 999, ccr: 1000 }).duty).toBe(1);
  });

  it("berücksichtigt die unterschiedlichen Zählerbreiten", () => {
    expect(() => calculateTimer("TIM1", { psc: 0, arr: 65536, ccr: 0 })).toThrow(RangeError);
    expect(calculateTimer("TIM2", { psc: 0, arr: 65536, ccr: 0 }).pwmHz).toBeGreaterThan(0);
    expect(() => calculateTimer("TIM1", { psc: 0, arr: 65535, ccr: 65536 })).toThrow(RangeError);
  });

  it("weist ungültige Registerwerte zurück", () => {
    expect(() => calculateTimer("TIM1", { psc: -1, arr: 999, ccr: 1 })).toThrow(RangeError);
    expect(() => calculateTimer("TIM1", { psc: 0, arr: 999, ccr: 1001 })).toThrow(RangeError);
    expect(() => calculateTimer("TIM1", { psc: 0.5, arr: 999, ccr: 1 })).toThrow(RangeError);
  });
});

describe("CNT-Einzelschrittmodell", () => {
  it("zählt bei ARR=9 von 0 bis 9 und springt dann zurück auf 0", () => {
    const start = { cnt: 0, overflows: 0 };
    expect(advanceCounter(start, 9, 1)).toEqual({ cnt: 1, overflows: 0 });
    expect(advanceCounter(start, 9, 9)).toEqual({ cnt: 9, overflows: 0 });
    expect(advanceCounter(start, 9, 10)).toEqual({ cnt: 0, overflows: 1 });
    expect(advanceCounter(start, 9, 27)).toEqual({ cnt: 7, overflows: 2 });
  });

  it("synchronisiert PWM1-Flanke und Compare beim Schritt von 2 nach 3", () => {
    expect(pwmActive(0, 3)).toBe(true);
    expect(pwmActive(2, 3)).toBe(true);
    expect(pwmActive(3, 3)).toBe(false);
    expect(pwmActive(9, 3)).toBe(false);
    expect(ticksUntilCompare(2, 9, 3)).toBe(1);
    expect(ticksUntilCompare(3, 9, 3)).toBe(10);
    expect(ticksUntilCompare(9, 9, 3)).toBe(4);
  });

  it("springt korrekt auf Überlauf und behandelt ARR=0", () => {
    expect(ticksUntilOverflow(3, 9)).toBe(7);
    expect(advanceCounter({ cnt: 3, overflows: 5 }, 9, 7)).toEqual({ cnt: 0, overflows: 6 });
    expect(advanceCounter({ cnt: 0, overflows: 0 }, 0, 3)).toEqual({ cnt: 0, overflows: 3 });
  });

  it("findet bei 0 % und 100 % Duty keinen Compare-Flankenwechsel", () => {
    expect(ticksUntilCompare(0, 9, 0)).toBeNull();
    expect(ticksUntilCompare(0, 9, 10)).toBeNull();
    expect(pwmActive(5, 0)).toBe(false);
    expect(pwmActive(9, 10)).toBe(true);
  });

  it("ist auch für den 32-Bit-Timer performant und exakt", () => {
    const arr = 0xffffffff;
    expect(advanceCounter({ cnt: arr - 1, overflows: 2 }, arr, 3)).toEqual({ cnt: 1, overflows: 3 });
    expect(ticksUntilOverflow(arr, arr)).toBe(1);
    expect(ticksUntilCompare(arr, arr, 1)).toBe(2);
  });

  it("weist ungültige Zählerzustände zurück", () => {
    expect(() => advanceCounter({ cnt: 10, overflows: 0 }, 9, 1)).toThrow(RangeError);
    expect(() => advanceCounter({ cnt: 0, overflows: 0 }, 9, -1)).toThrow(RangeError);
    expect(() => ticksUntilCompare(10, 9, 3)).toThrow(RangeError);
  });
});
