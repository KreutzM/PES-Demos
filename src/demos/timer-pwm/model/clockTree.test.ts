import { describe, expect, it } from "vitest";
import {
  calculateClockTree, DEFAULT_CLOCK_CONFIG, type ClockConfig,
} from "./clockTree";
import { calculateTimer } from "./timer";

function configured(changes: Partial<ClockConfig>): ClockConfig {
  return { ...DEFAULT_CLOCK_CONFIG, ...changes };
}

describe("STM32F429 RCC-Clock-Tree (RM0090)", () => {
  it("liefert im Praktikumsprofil SYSCLK168, PCLK1=42, PCLK2=84, TIM2=84, TIM1=168 MHz", () => {
    const r = calculateClockTree(DEFAULT_CLOCK_CONFIG);
    expect(r.hclkHz).toBe(168_000_000);
    expect(r.apb1.pclkHz).toBe(42_000_000);
    expect(r.apb1.timerMultiplier).toBe(2);
    expect(r.tim2Hz).toBe(84_000_000);
    expect(r.apb2.pclkHz).toBe(84_000_000);
    expect(r.apb2.timerMultiplier).toBe(2);
    expect(r.tim1Hz).toBe(168_000_000);
    expect(r.warnings).toEqual([]);
  });

  it("TIMPRE=0: APB prescaler /1 bedeutet Timer-Multiplikator x1", () => {
    const r = calculateClockTree(configured({ ahbDiv: 4, apb1Div: 1, apb2Div: 1 }));
    expect(r.apb1.timerMultiplier).toBe(1);
    expect(r.apb2.timerMultiplier).toBe(1);
    expect(r.tim1Hz).toBe(42_000_000);
    expect(r.tim2Hz).toBe(42_000_000);
  });

  it("TIMPRE=0: APB /4 und /8 ergeben beide Faktor x2", () => {
    const r = calculateClockTree(configured({ apb1Div: 8, apb2Div: 4 }));
    expect(r.apb1.pclkHz).toBe(21_000_000);
    expect(r.tim2Hz).toBe(42_000_000);
    expect(r.tim1Hz).toBe(84_000_000);
  });

  it("TIMPRE=1: APB /1, /2 und /4 legen Timer auf HCLK", () => {
    for (const div of [1, 2, 4] as const) {
      const r = calculateClockTree(configured({ apb1Div: div, apb2Div: div, timpre: true }));
      expect(r.tim1Hz).toBe(168_000_000);
      expect(r.tim2Hz).toBe(168_000_000);
    }
  });

  it("TIMPRE=1: APB /8 und /16 liefern exakt 4 × PCLK", () => {
    for (const div of [8, 16] as const) {
      const r = calculateClockTree(configured({ apb1Div: div, timpre: true }));
      expect(r.tim2Hz).toBe(r.apb1.pclkHz * 4);
    }
    expect(calculateClockTree(configured({ apb1Div: 8, timpre: true })).tim2Hz)
      .toBe(84_000_000);
  });

  it("AHB-Prescaler reduziert beide Busse und Timerfrequenzen", () => {
    const r = calculateClockTree(configured({ ahbDiv: 2 }));
    expect(r.hclkHz).toBe(84_000_000);
    expect(r.tim1Hz).toBe(84_000_000);
    expect(r.tim2Hz).toBe(42_000_000);
  });

  it("prüft die APB-Grenzen und akzeptiert 45/90 MHz bei SYSCLK180", () => {
    const legal = calculateClockTree(configured({ sysclkHz: 180_000_000 }));
    expect(legal.apb1.pclkHz).toBe(45_000_000);
    expect(legal.apb2.pclkHz).toBe(90_000_000);
    expect(legal.warnings).toEqual([]);

    const invalid = calculateClockTree(configured({ apb1Div: 1, apb2Div: 1 }));
    expect(invalid.warnings).toHaveLength(2);
  });

  it("rechnet die Timerfrequenzen direkt in den bestehenden PSC/ARR-Rechner durch", () => {
    const clk = calculateClockTree(DEFAULT_CLOCK_CONFIG);
    const regs = { psc: 16799, arr: 9999, ccr: 5000 };
    expect(calculateTimer("TIM1", regs, clk.tim1Hz).pwmHz).toBe(1);
    expect(calculateTimer("TIM2", regs, clk.tim2Hz).pwmHz).toBe(0.5);
    const newer = calculateClockTree(configured({ timpre: true }));
    expect(calculateTimer("TIM2", regs, newer.tim2Hz).pwmHz).toBe(1);
  });

  it("weist nicht unterstützte Teiler und Typfehler zurück", () => {
    expect(() => calculateClockTree(configured({ apb1Div: 3 as ClockConfig["apb1Div"] }))).toThrow(RangeError);
    expect(() => calculateClockTree(configured({ timpre: 1 as unknown as boolean }))).toThrow(RangeError);
  });
});
