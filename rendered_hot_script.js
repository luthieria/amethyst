
(function() {
  var container = document.getElementById('handsontable-3');
  if (!container) return;

  var storageKey = 'hot_v4_' + window.location.pathname + '_3';

  function parseCSV(str) {
    if (!str) return [[]];
    return str.replace(/\r/g, '').split('\n')
      .map(function(l) { return l.trim(); })
      .filter(function(l) { return l.length > 0; })
      .map(function(l) { return l.split(',').map(function(c) { return c.trim(); }); });
  }

  var savedState = null;
  try { savedState = JSON.parse(localStorage.getItem(storageKey)); } catch(e) {}

  var dataStr = "\"ID, **Product**, Price, Stock\\r\\n1, Acoustic Guitar, 450, 12\\r\\n2, Electric Guitar, 800, 5\\r\\n3, Violin, 600, 8\\r\\n4, Piano, 2500, 2\\r\\n5, **Flute**, 150, **20**\"";
  var sourceData;
  try {
    sourceData = JSON.parse(dataStr);
    if (!Array.isArray(sourceData)) sourceData = parseCSV(String(sourceData));
  } catch(e) { sourceData = parseCSV(dataStr); }

  var data             = (savedState && savedState.data) ? savedState.data : sourceData;
  var colHeadersConfig = (savedState && savedState.headers && savedState.headers.col) ? savedState.headers.col :  true ;
  var rowHeadersConfig = (savedState && savedState.headers && savedState.headers.row) ? savedState.headers.row :  true ;
  var customBordersConfig = (savedState && savedState.customBorders) ? savedState.customBorders : true;

  var headersVisible = true;
  if (savedState && savedState.config && typeof savedState.config.headersVisible !== 'undefined') {
    headersVisible = savedState.config.headersVisible;
  } else if ( false ) {
    headersVisible = false;
  }

  function renderMarkdown(text) {
    if (!text) return text;
    return String(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  }

  function markdownRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (typeof value === 'string' && value) {
      td.innerHTML = renderMarkdown(td.innerHTML);
    }
  }

  var hot;
  var config = {
    data: data,
    rowHeaders: headersVisible ? rowHeadersConfig : false,
    colHeaders: headersVisible ? colHeadersConfig : false,
    renderer: markdownRenderer,
    width: '100%',
    height: 'auto',
    licenseKey: 'non-commercial-and-evaluation',
    multiColumnSorting: headersVisible,
    filters: headersVisible,
    dropdownMenu: headersVisible,
    contextMenu: ['row_above', 'row_below', 'remove_row', '---------', 'col_left', 'col_right', 'remove_col', '---------', 'undo', 'redo', '---------', 'alignment', 'borders'],
    customBorders: customBordersConfig,
    manualRowMove: headersVisible,
    manualColumnMove: headersVisible,
    manualRowResize: true,
    manualColumnResize: true,
    mergeCells:  true ,
    readOnly:  false ,
    stretchH: 'all',
    renderAllRows: true,
    autoColumnSize: true,
    autoRowSize: true,
    afterChange: function(changes, source) { if (source !== 'loadData' && hot) scheduleSave(); },
    afterRowMove: function() { if (hot) scheduleSave(); },
    afterColMove: function() { if (hot) scheduleSave(); },
    afterContextMenuExecute: function() { if (hot) scheduleSave(); },
    afterGetColHeader: function(col, TH) {
      if (!headersVisible || col < 0) return;
      var wrapper = TH.querySelector('.colHeader');
      if (wrapper) wrapper.innerHTML = renderMarkdown(wrapper.innerHTML);
    },
    afterGetRowHeader: function(row, TH) {
      if (!headersVisible || row < 0) return;
      var wrapper = TH.querySelector('.rowHeader');
      if (wrapper) wrapper.innerHTML = renderMarkdown(wrapper.innerHTML);
    }
  };

  hot = new Handsontable(container, config);

  var saveTimeout;
  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveAll, 500);
  }

  function saveAll() {
    if (!hot) return;
    var bordersPlugin = hot.getPlugin('customBorders');
    var currentBorders = (bordersPlugin && typeof bordersPlugin.getBorders === 'function')
      ? bordersPlugin.getBorders()
      : true;
    var state = {
      data: hot.getData(),
      headers: { col: colHeadersConfig, row: rowHeadersConfig },
      config: { headersVisible: headersVisible },
      customBorders: currentBorders
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  container.addEventListener('dblclick', function(e) {
    if (!headersVisible) return;
    var th = e.target.closest('th');
    if (!th) return;
    var coords = hot.getCoords(th);
    if (coords.row >= 0 && coords.col >= 0) return;

    var isCol  = coords.row < 0;
    var index  = isCol ? coords.col : coords.row;
    var current = isCol ? hot.getColHeader(index) : hot.getRowHeader(index);

    var input = document.createElement('input');
    input.value = typeof current === 'string' ? current.replace(/<[^>]+>/g, '') : current;
    input.style.cssText = 'position:absolute;z-index:1000;border:1px solid var(--secondary);background:var(--main-background);color:var(--dark);text-align:center;font:inherit;';
    var rect  = th.getBoundingClientRect();
    var cRect = container.getBoundingClientRect();
    Object.assign(input.style, {
      top:    (rect.top  - cRect.top)  + 'px',
      left:   (rect.left - cRect.left) + 'px',
      width:  rect.width  + 'px',
      height: rect.height + 'px'
    });
    container.appendChild(input);
    input.focus();
    input.select();

    input.onblur = function() {
      var val = input.value;
      if (input.parentNode) container.removeChild(input);
      if (isCol) {
        var h = hot.getColHeader();
        if (!Array.isArray(h)) h = Array.from({length: hot.countCols()}, function(_, i) { return hot.getColHeader(i); });
        h[index] = val;
        colHeadersConfig = h;
        hot.updateSettings({ colHeaders: h });
      } else {
        var h = hot.getRowHeader();
        if (!Array.isArray(h)) h = Array.from({length: hot.countRows()}, function(_, i) { return hot.getRowHeader(i); });
        h[index] = val;
        rowHeadersConfig = h;
        hot.updateSettings({ rowHeaders: h });
      }
      saveAll();
    };
    input.onkeydown = function(ev) {
      if (ev.key === 'Enter')  { input.onblur(); }
      if (ev.key === 'Escape') { input.onblur = null; if (input.parentNode) container.removeChild(input); }
    };
  });

  window['hotPersistence_3'] = {
    toggleHeaders: function() {
      headersVisible = !headersVisible;
      hot.updateSettings({
        rowHeaders:         headersVisible ? rowHeadersConfig : false,
        colHeaders:         headersVisible ? colHeadersConfig : false,
        multiColumnSorting: headersVisible,
        filters:            headersVisible,
        dropdownMenu:       headersVisible,
        manualRowMove:      headersVisible,
        manualColumnMove:   headersVisible
      });
      saveAll();
      var icon = container.closest('.handsontable-container').querySelector('.hot-action-bar button span');
      if (icon) icon.innerText = headersVisible ? 'grid_on' : 'grid_off';
    },
    copy: function() {
      var json = JSON.stringify(hot.getData(), null, 2);
      navigator.clipboard.writeText(json);
    },
    reset: function() {
      if (confirm('Reset to original data?')) { localStorage.removeItem(storageKey); window.location.reload(); }
    }
  };

  container.classList.add('hot-dark');
  setTimeout(function() { hot.render(); window.dispatchEvent(new Event('resize')); }, 200);
})();

