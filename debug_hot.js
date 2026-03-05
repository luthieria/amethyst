const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const errors = [];
  const logs = [];
  page.on('console', msg => logs.push(msg.type() + ': ' + msg.text()));
  page.on('pageerror', error => errors.push('PAGEERROR: ' + error.message));

  await page.goto('http://localhost:1313/test-tables/', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForTimeout(2000);

  // check if Handsontable is defined
  const hotDefined = await page.evaluate(() => typeof Handsontable !== 'undefined');
  // check if container exists
  const containerExists = await page.evaluate(() => !!document.querySelector('.hot-container'));
  // check container dimensions
  const dims = await page.evaluate(() => {
    const el = document.querySelector('.hot-container');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height, children: el.children.length };
  });

  console.log('Handsontable defined:', hotDefined);
  console.log('Container exists:', containerExists);
  console.log('Container dims:', JSON.stringify(dims));
  console.log('Page errors:', errors.join(' | '));
  console.log('Console logs:', logs.slice(0, 20).join('\n'));

  await browser.close();
})();
