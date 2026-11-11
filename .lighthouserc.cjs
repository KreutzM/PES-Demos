/** Lighthouse ist zunächst ein beratender Qualitätsaudit, kein Release-Gate. */
module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:4173/PES-Demos/",
        "http://127.0.0.1:4173/PES-Demos/#/timer-pwm",
      ],
      startServerCommand: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
      numberOfRuns: 1,
      settings: { preset: "desktop", chromeFlags: "--no-sandbox --headless" },
    },
    assert: {
      assertions: {
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:performance": ["warn", { minScore: 0.65 }],
      },
    },
    upload: { target: "filesystem", outputDir: "./lighthouse-report" },
  },
};
