const fs=require('fs');
const html = fs.readFileSync('downloaded_page2.html','utf8');
const scripts = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/g);
let found = false;
scripts.forEach((s, i) => {
  if (s.includes('Handsontable')) {
    found = true;
    const code = s.replace(/<script type="text\/javascript">\n?|\n?<\/script>/g, '');
    try {
      new Function(code);
      console.log('Script ' + i + ': OK');
    } catch (e) {
      console.log('Script ' + i + ': ERROR:', e.message);
    }
  }
});
if (!found) console.log('No Handsontable script found!');
