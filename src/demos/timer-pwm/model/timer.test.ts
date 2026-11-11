import { describe, expect, it } from "vitest";
import { calculateTimer } from "./timer";

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
