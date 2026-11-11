/** STM32F429 / STM32F42x clock-tree subset used by the timer laboratory.
 * Source: ST RM0090, RCC clock tree, RCC_DCKCFGR.TIMPRE.
 * PLL generation, oscillator accuracy and dynamic RCC switching are out of scope.
 */
export const SYSCLK_OPTIONS = [84_000_000, 168_000_000, 180_000_000] as const;
export const AHB_DIVISORS = [1, 2, 4, 8, 16, 64, 128, 256, 512] as const;
export const APB_DIVISORS = [1, 2, 4, 8, 16] as const;

export type SysclkHz = (typeof SYSCLK_OPTIONS)[number];
export type AhbDiv = (typeof AHB_DIVISORS)[number];
export type ApbDiv = (typeof APB_DIVISORS)[number];

export interface ClockConfig {
  sysclkHz: SysclkHz;
  ahbDiv: AhbDiv;
  apb1Div: ApbDiv;
  apb2Div: ApbDiv;
  timpre: boolean;
}

export const DEFAULT_CLOCK_CONFIG: Readonly<ClockConfig> = Object.freeze({
  sysclkHz: 168_000_000,
  ahbDiv: 1,
  apb1Div: 4,
  apb2Div: 2,
  timpre: false,
});

export interface ApbClock {
  div: ApbDiv;
  pclkHz: number;
  timerMultiplier: number;
  timclkHz: number;
}

export interface ClockTreeResult {
  sysclkHz: number;
  hclkHz: number;
  apb1: ApbClock;
  apb2: ApbClock;
  tim1Hz: number;
  tim2Hz: number;
  warnings: string[];
}

export const MAX_PCLK1_HZ = 45_000_000;
export const MAX_PCLK2_HZ = 90_000_000;

function apbClock(hclkHz: number, div: ApbDiv, timpre: boolean): ApbClock {
  const pclkHz = hclkHz / div;
  // RM0090 RCC_DCKCFGR.TIMPRE:
  // 0: APB/1 => x1, APB/{2,4,8,16} => x2.
  // 1: APB/{1,2,4} => HCLK (faktor = div); APB/{8,16} => x4.
  const timerMultiplier = timpre ? (div <= 4 ? div : 4) : (div === 1 ? 1 : 2);
  return { div, pclkHz, timerMultiplier, timclkHz: pclkHz * timerMultiplier };
}

export function calculateClockTree(config: ClockConfig): ClockTreeResult {
  const { sysclkHz, ahbDiv, apb1Div, apb2Div, timpre } = config;
  if (!SYSCLK_OPTIONS.includes(sysclkHz) || !AHB_DIVISORS.includes(ahbDiv) ||
      !APB_DIVISORS.includes(apb1Div) || !APB_DIVISORS.includes(apb2Div) ||
      typeof timpre !== "boolean") {
    throw new RangeError("Ungültige RCC-Taktkonfiguration.");
  }
  const hclkHz = sysclkHz / ahbDiv;
  const apb1 = apbClock(hclkHz, apb1Div, timpre);
  const apb2 = apbClock(hclkHz, apb2Div, timpre);
  const warnings: string[] = [];
  if (apb1.pclkHz > MAX_PCLK1_HZ) {
    warnings.push("PCLK1 überschreitet die STM32F429-Grenze von 45 MHz.");
  }
  if (apb2.pclkHz > MAX_PCLK2_HZ) {
    warnings.push("PCLK2 überschreitet die STM32F429-Grenze von 90 MHz.");
  }
  return {
    sysclkHz,
    hclkHz,
    apb1,
    apb2,
    tim1Hz: apb2.timclkHz,
    tim2Hz: apb1.timclkHz,
    warnings,
  };
}
