({
  // Please visit the URL below for more information:
  // https://shd101wyy.github.io/markdown-preview-enhanced/#/extend-parser

  onWillParseMarkdown: async function (markdown) {
    // Automatically detect blank lines between list items and insert a spacer
    // This allows manual spacing without triggering "loose list" behavior for the whole list
    markdown = markdown.replace(/^(\s*(?:[-*+]|\d+\.) .*)\n\n(?=\s*(?:[-*+]|\d+\.) )/gm, '$1\n  <div class="list-item-spacer"></div>\n');
    return markdown;
  },

  onDidParseMarkdown: async function (html) {
    return html;
  },
})