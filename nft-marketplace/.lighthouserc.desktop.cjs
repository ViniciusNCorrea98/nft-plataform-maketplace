module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'ready in',
      startServerReadyTimeout: 30_000,
      url: ['http://127.0.0.1:4173/', 'http://127.0.0.1:4173/nft/nft-1'],
      numberOfRuns: 3,
      settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1 } },
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-reports/desktop' },
  },
}
