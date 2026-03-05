const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js"></script>
    <div id="hot"></div>
    <script>
        var hot = new Handsontable(document.getElementById('hot'), {
            data: [['A1', 'B1'], ['A2', 'B2']],
            customBorders: true,
            contextMenu: true,
            licenseKey: 'non-commercial-and-evaluation'
        });
        window.hot = hot;
    </script>
  );
  await page.waitForTimeout(1000);
  const contextMenuInfo = await page.evaluate(() => {
    return window.hot.getPlugin('contextMenu').menu.menuItems.map(i => i.key);
  });
  console.log('MenuItems:', contextMenuInfo);
  // add a border
  await page.evaluate(() => {
     window.hot.getPlugin('customBorders').setBorders([[0,0,0,0]], {left: {width: 2, color: 'red'}});
  });
  const borders = await page.evaluate(() => {
     return window.hot.getPlugin('customBorders').getBorders();
  });
  console.log('Borders:', borders);
  await browser.close();
})();
