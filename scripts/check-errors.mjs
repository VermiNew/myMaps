import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Click the locate button
  const locateBtn = await page.locator('button:has-text("Twoja lokalizacja")');
  if (await locateBtn.count() > 0) {
    await locateBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click on map canvas
  const mapSurface = await page.locator('.map-surface canvas');
  if (await mapSurface.count() > 0) {
    await mapSurface.click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(1000);
  }

  console.log('Errors found:', errors.length);
  for (const e of errors) console.log('  -', e);
  console.log('URL:', page.url());
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
