({
  // Please visit the URL below for more information:
  // https://shd101wyy.github.io/markdown-preview-enhanced/#/extend-parser

  onWillParseMarkdown: async function (markdown) {
    // Automatically detect blank lines between list items and insert a spacer
    // This allows manual spacing without triggering "loose list" behavior for the whole list
    markdown = markdown.replace(/^(\s*(?:[-*+]|\d+\.) .*)\n\n(?=\s*(?:[-*+]|\d+\.) )/gm, '$1\n  <div class="list-item-spacer"></div>\n');

    const highlightRules = [
      { tag: "r", className: "highlight-red" },
      { tag: "pk", className: "highlight-pink" },
      { tag: "pe", className: "highlight-peach" },
      { tag: "g", className: "highlight-green" },
      { tag: "t", className: "highlight-teal" },
      { tag: "b", className: "highlight-blue" },
      { tag: "pw", className: "highlight-periwinkle" },
      { tag: "p", className: "highlight-purple" },
      { tag: "m", className: "highlight-mauve" },
    ];

    for (const rule of highlightRules) {
      const pattern = new RegExp(`${rule.tag}==([^=\\n]+)==`, "g");
      markdown = markdown.replace(pattern, `<span class="${rule.className}">$1</span>`);
    }

    return markdown;
  },

  onDidParseMarkdown: async function (html) {
    return html;
  },
})
