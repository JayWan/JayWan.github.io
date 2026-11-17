// Playwright configuration for `npm test`. What the tests cover: assets/themes/README.md, section 测试.
//
// - "chrome" uses the Chrome that is installed on the machine (channel: 'chrome'), so nothing
//   has to be downloaded. Desktop size, 1440 × 900.
// - "webkit-iphone" is the closest thing to iOS Safari that runs off a Mac: WebKit at 402 × 874
//   (iPhone 17 Pro). It is only added when Playwright's WebKit is installed
//   (`npx playwright install webkit`); otherwise it is silently left out.
// - "firefox" (desktop size) is added the same way when Playwright's Firefox is installed.
// - tests/global-setup.mjs builds the site into tests/.site and serves it on a free port.
//   SITE_DIR=<dir> skips the build and serves that directory instead.

import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { defineConfig, firefox, webkit } from '@playwright/test';

// The port is picked once, in the process that starts the run, and handed to the workers
// through the environment: they load this file again and must agree on the address.
if (!process.env.TEST_PORT) {
  process.env.TEST_PORT = String(await new Promise((resolve, reject) => {
    const probe = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  }));
}

const installed = (browser) => { try { return existsSync(browser.executablePath()); } catch { return false; } };
const hasWebkit = installed(webkit);
const hasFirefox = installed(firefox);

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.mjs',
  globalSetup: './tests/global-setup.mjs',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://127.0.0.1:${process.env.TEST_PORT}`,
    // Dates and the night rule depend on the visitor's clock: pin the zone so a test means the same everywhere.
    timezoneId: 'America/Los_Angeles',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chrome',
      use: { channel: 'chrome', viewport: { width: 1440, height: 900 }, launchOptions: { args: ['--mute-audio'] } },
    },
    ...(hasWebkit ? [{
      name: 'webkit-iphone',
      use: { browserName: 'webkit', viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE_UA },
    }] : []),
    ...(hasFirefox ? [{
      name: 'firefox',
      use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } },
    }] : []),
  ],
});
