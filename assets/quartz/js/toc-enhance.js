(function () {
  const STATE_KEY = "__amethystTocEnhancer";

  function escapeCssId(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/([^\w-])/g, "\\$1");
  }

  function decodeFragment(fragment) {
    try {
      return decodeURIComponent(fragment);
    } catch (_err) {
      return fragment;
    }
  }

  function findHeading(markdownRoot, fragment) {
    if (!fragment) return null;

    const candidates = [fragment, decodeFragment(fragment)];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const node = markdownRoot.querySelector("#" + escapeCssId(candidate));
      if (node) return node;
    }

    return null;
  }

  function initTocEnhancer(root = document) {
    const toc = root.querySelector(".book-toc");
    if (!toc) return;

    const previous = toc[STATE_KEY];
    if (previous && typeof previous.destroy === "function") {
      previous.destroy();
    }

    const tocNav = toc.querySelector("nav");
    const markdownRoot = document.querySelector(".book-page .markdown");
    if (!tocNav || !markdownRoot) return;

    const tocLinks = Array.from(tocNav.querySelectorAll('a[href^="#"]'));
    if (!tocLinks.length) return;

    const linkGroupsByHeadingId = new Map();

    for (const link of tocLinks) {
      const href = link.getAttribute("href") || "";
      const fragment = href.startsWith("#") ? href.slice(1) : "";
      const heading = findHeading(markdownRoot, fragment);
      if (!heading || !heading.id) continue;

      const level = Number.parseInt(heading.tagName.slice(1), 10);
      if (Number.isInteger(level) && level >= 1 && level <= 6) {
        link.dataset.headingLevel = String(level);
      } else {
        delete link.dataset.headingLevel;
      }

      const headingId = heading.id;
      if (!linkGroupsByHeadingId.has(headingId)) {
        linkGroupsByHeadingId.set(headingId, {
          heading,
          links: [],
        });
      }

      linkGroupsByHeadingId.get(headingId).links.push(link);
    }

    const groups = Array.from(linkGroupsByHeadingId.values());
    if (!groups.length) return;

    // DOM order equals heading order on the page.
    groups.sort((a, b) => {
      if (a.heading === b.heading) return 0;
      const pos = a.heading.compareDocumentPosition(b.heading);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    let activeHeadingId = "";
    let rafToken = 0;

    function setActiveHeading(nextHeadingId) {
      if (!nextHeadingId || nextHeadingId === activeHeadingId) return;
      activeHeadingId = nextHeadingId;

      for (const group of groups) {
        const isCurrent = group.heading.id === nextHeadingId;
        for (const link of group.links) {
          link.classList.toggle("is-current", isCurrent);
          if (isCurrent) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        }
      }
    }

    function pickCurrentHeadingId() {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const topThreshold = Math.max(72, Math.min(200, viewportHeight * 0.2));

      let picked = groups[0].heading.id;
      for (const group of groups) {
        const rect = group.heading.getBoundingClientRect();
        if (rect.top <= topThreshold) {
          picked = group.heading.id;
        } else {
          break;
        }
      }

      const doc = document.documentElement;
      const atBottom = window.scrollY + viewportHeight >= doc.scrollHeight - 2;
      if (atBottom) {
        picked = groups[groups.length - 1].heading.id;
      }

      return picked;
    }

    function updateActiveHeading() {
      rafToken = 0;
      setActiveHeading(pickCurrentHeadingId());
    }

    function queueUpdate() {
      if (rafToken) return;
      rafToken = window.requestAnimationFrame(updateActiveHeading);
    }

    function onHashChange() {
      const hash = window.location.hash || "";
      const fragment = hash.startsWith("#") ? hash.slice(1) : "";
      const heading = findHeading(markdownRoot, fragment);

      if (heading && heading.id) {
        setActiveHeading(heading.id);
      } else {
        queueUpdate();
      }
    }

    function onTocClick(event) {
      const link = event.target && event.target.closest && event.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const fragment = href.startsWith("#") ? href.slice(1) : "";
      const heading = findHeading(markdownRoot, fragment);
      if (heading && heading.id) {
        setActiveHeading(heading.id);
      }
    }

    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);
    window.addEventListener("load", queueUpdate);
    window.addEventListener("hashchange", onHashChange);
    tocNav.addEventListener("click", onTocClick);

    queueUpdate();
    onHashChange();

    toc[STATE_KEY] = {
      destroy() {
        if (rafToken) {
          window.cancelAnimationFrame(rafToken);
          rafToken = 0;
        }
        window.removeEventListener("scroll", queueUpdate);
        window.removeEventListener("resize", queueUpdate);
        window.removeEventListener("load", queueUpdate);
        window.removeEventListener("hashchange", onHashChange);
        tocNav.removeEventListener("click", onTocClick);
      },
    };
  }

  window.initTocEnhancer = initTocEnhancer;
})();
