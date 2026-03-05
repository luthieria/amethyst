const fs=require('fs');
const html = fs.readFileSync('downloaded_page3.html','utf8');
const scripts = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/g) || [];
scripts.forEach((s, i) => {
  if (s.includes('Handsontable')) {
    const code = s.replace(/<script type="text\/javascript">\n?|\n?<\/script>/g, '');
    try { new Function(code); console.log('OK'); }
    catch (e) {
      const lines = code.split('\n');
      const m = e.message.match(/line (\d+)/);
      const ln = m ? parseInt(m[1]) - 1 : -1;
      console.log('ERROR:', e.message);
      if (ln >= 0) console.log('Near:', lines[ln]);
    }
  }
});
