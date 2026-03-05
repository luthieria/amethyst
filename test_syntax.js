const fs=require('fs');
const html = fs.readFileSync('downloaded_page.html','utf8');
const scripts = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/g);
scripts.forEach((s, i) => {
  if (s.includes('Handsontable')) {
    const code = s.replace(/<script type="text\/javascript">\n?|\n?<\/script>/g, '');
    try {
      new Function(code);
      console.log('Script ' + i + ': Syntax OK');
    } catch (e) {
      console.log('Script ' + i + ': Syntax Error:', e.message);
    }
  }
});
