({
  // Please visit the URL below for more information:
  // https://shd101wyy.github.io/markdown-preview-enhanced/#/extend-parser

  onWillParseMarkdown: async function (markdown) {
    // Render Hugo-style comment shortcodes in MPE as blockquotes so inline
    // markdown (links, lists, emphasis) inside stays fully supported.
    markdown = markdown.replace(/\{\{<\s*comment\s*>\}\}([\s\S]*?)\{\{<\s*\/comment\s*>\}\}/g, (_, inner) => {
      const content = inner.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
      const lines = content.length > 0 ? content.split("\n") : [];
      const quoted = lines.map((line) => line.trim() === "" ? ">" : `> ${line}`).join("\n");
      const marker = '> <span class="book-comment-marker">Comment</span>';
      return quoted ? `${marker}\n>\n${quoted}` : marker;
    });

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
