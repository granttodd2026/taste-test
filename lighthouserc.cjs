// Lighthouse CI budget (app-quality-bar gates 6-8). SEO is OFF on purpose: private noindex apps.
// Throwaway code built at runtime (never a family code). Main screen = Home with Chug Check buttons.
const THROWAWAY = 'test' + 'lhci'.repeat(6);
module.exports = {
  ci: {
    collect: { staticDistDir: './dist', url: ['http://localhost/index.html', 'http://localhost/index.html#k=' + THROWAWAY], puppeteerScript: './lighthouse-setup.cjs', puppeteerLaunchOptions: { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] }, numberOfRuns: 3, settings: { formFactor: 'mobile', chromeFlags: '--no-sandbox --headless=new' } },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': 'off',
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 150000 }],
        'resource-summary:total:size': ['warn', { maxNumericValue: 250000 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
