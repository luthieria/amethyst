const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:1313/test-tables/');
  
  // Wait for the handsontable script to load and initialize.
  await page.waitForTimeout(2000);
  
  // Try evaluating the handsontable content
  const htmls = await page.evaluate(() => {
    // try to find Flute text
    const tds = Array.from(document.querySelectorAll('td'));
    return tds.map(td => td.innerHTML).filter(h => h.includes('Flute'));
  });
  console.log('HTML outputs: ', htmls);
  
  await browser.close();
})();
