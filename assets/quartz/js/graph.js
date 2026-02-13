async function drawGraph(baseUrl, isHome, pathColors, graphConfig) {
  let {
    depth,
    enableDrag,
    enableLegend,
    enableZoom,
    opacityScale,
    scale,
    repelForce,
    fontSize,
  } = graphConfig

  const container = document.getElementById("graph-container")
  const fetched = (await fetchData) || {}
  const rawIndex = fetched.index && typeof fetched.index === "object" ? fetched.index : {}
  const rawLinks = Array.isArray(fetched.links) ? fetched.links : []
  const rawContent = fetched.content && typeof fetched.content === "object" ? fetched.content : {}

  const FRONT_MATTER_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
  const TITLE_LINE_RE = /^\s*title\s*:\s*(.+?)\s*$/im
  const EXTERNAL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

  const decodeHtmlEntities = (() => {
    const textarea = document.createElement("textarea")
    return (value) => {
      if (typeof value !== "string") return ""
      textarea.innerHTML = value
      return textarea.value
    }
  })()

  const decodePathSegments = (path) => {
    if (typeof path !== "string") return ""
    return path
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch (_) {
          return segment
        }
      })
      .join("/")
  }

  const canonicalizeId = (raw) => {
    if (typeof raw !== "string") return null

    let value = raw.trim()
    if (!value) return null

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
      try {
        value = new URL(value).pathname
      } catch (_) {
        return null
      }
    }

    value = value.replace(/\\/g, "/")
    value = value.split("#")[0].split("?")[0]

    if (!value.startsWith("/")) {
      value = `/${value}`
    }

    value = value.replace(/\/+/g, "/")

    if (value.length > 1) {
      value = value.replace(/\/+$/g, "")
    }

    return value || "/"
  }

  const defaultTitleFromId = (id) => {
    if (id === "/") return "/"
    const segment = decodePathSegments(id).split("/").filter(Boolean).pop() || id
    return segment.replaceAll("-", " ")
  }

  const extractFrontmatterTitle = (markdown) => {
    if (typeof markdown !== "string" || markdown.length === 0) return null

    const match = markdown.match(FRONT_MATTER_RE)
    if (!match) return null

    const frontMatter = match[1]
    const titleMatch = frontMatter.match(TITLE_LINE_RE)
    if (!titleMatch) return null

    let title = decodeHtmlEntities(titleMatch[1].trim())
    if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
      title = title.slice(1, -1).trim()
    }

    return title || null
  }

  const normalizeContentTable = (table) => {
    const normalized = {}

    Object.entries(table).forEach(([rawId, rawEntry]) => {
      const id = canonicalizeId(rawId)
      if (!id || !rawEntry || typeof rawEntry !== "object") return

      const contentText = typeof rawEntry.content === "string" ? rawEntry.content : ""
      let title = typeof rawEntry.title === "string" ? decodeHtmlEntities(rawEntry.title).trim() : ""

      if (!title || title === "_index") {
        const extracted = extractFrontmatterTitle(contentText)
        if (extracted) {
          title = extracted
        }
      }

      if (!title) {
        title = defaultTitleFromId(id)
      }

      const existing = normalized[id] || {}
      normalized[id] = {
        ...existing,
        ...rawEntry,
        id,
        title,
        content: contentText || existing.content || "",
      }
    })

    return normalized
  }

  const basenameKeys = (segment) => {
    const keys = new Set()
    if (typeof segment !== "string" || segment.length === 0) return keys

    const decoded = decodePathSegments(segment)
    ;[segment, decoded].forEach((candidate) => {
      const value = candidate.trim()
      if (!value) return
      keys.add(value)
      const dot = value.lastIndexOf(".")
      if (dot > 0) {
        keys.add(value.slice(0, dot))
      }
    })

    return keys
  }

  const buildResolutionMaps = (contentTable) => {
    const allIds = new Set(Object.keys(contentTable))
    const titleToIds = new Map()
    const basenameToIds = new Map()

    Object.entries(contentTable).forEach(([id, entry]) => {
      const title = typeof entry?.title === "string" ? entry.title.trim() : ""
      if (title) {
        if (!titleToIds.has(title)) {
          titleToIds.set(title, new Set())
        }
        titleToIds.get(title).add(id)
      }

      if (id === "/") return

      const segment = id.split("/").filter(Boolean).pop() || ""
      basenameKeys(segment).forEach((key) => {
        if (!basenameToIds.has(key)) {
          basenameToIds.set(key, new Set())
        }
        basenameToIds.get(key).add(id)
      })
    })

    return { allIds, titleToIds, basenameToIds }
  }

  const normalizePathCandidate = (candidate) => {
    if (typeof candidate !== "string") return null

    let value = candidate.trim()
    if (!value) return null

    if (value.toLowerCase().endsWith(".md")) {
      value = value.slice(0, -3)
    }

    if (value.endsWith("/_index")) {
      value = value.slice(0, -"/_index".length)
    } else if (value.endsWith("/index")) {
      value = value.slice(0, -"/index".length)
    }

    return canonicalizeId(value)
  }

  const resolveDirectId = (sourceId, target, allIds) => {
    const sourceDir = sourceId === "/" ? "/" : sourceId.slice(0, sourceId.lastIndexOf("/")) || "/"
    const candidates = []

    if (target.startsWith("/")) {
      candidates.push(target)
    } else {
      candidates.push(target)
      candidates.push(`/${target.replace(/^\/+/, "")}`)

      try {
        const base = `https://example.invalid${sourceDir === "/" ? "/" : `${sourceDir}/`}`
        candidates.push(new URL(target, base).pathname)
      } catch (_) {
        // ignore malformed relative links
      }
    }

    for (const candidate of candidates) {
      const normalized = normalizePathCandidate(candidate)
      if (normalized && allIds.has(normalized)) {
        return normalized
      }
    }

    return null
  }

  const resolveTarget = (sourceId, target, maps) => {
    const direct = resolveDirectId(sourceId, target, maps.allIds)
    if (direct) return direct

    const titleMatches = maps.titleToIds.get(target)
    if (titleMatches && titleMatches.size === 1) {
      return [...titleMatches][0]
    }

    const basename = target.split("/").filter(Boolean).pop() || target
    const basenameMatches = new Set()
    basenameKeys(basename).forEach((key) => {
      const candidates = maps.basenameToIds.get(key)
      if (candidates && candidates.size === 1) {
        basenameMatches.add([...candidates][0])
      }
    })

    if (basenameMatches.size === 1) {
      return [...basenameMatches][0]
    }

    return null
  }

  const stripMarkdownTarget = (rawTarget) => {
    let target = decodeHtmlEntities(rawTarget.trim())

    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1).trim()
    }

    const withTitle = target.match(/^(\S+)\s+['\"][^'\"]*['\"]\s*$/)
    if (withTitle) {
      target = withTitle[1]
    }

    return target.trim()
  }

  const isInternalTarget = (target) => {
    if (typeof target !== "string") return false
    const value = target.trim()

    if (!value || value.startsWith("#") || value.startsWith("//")) {
      return false
    }

    if (EXTERNAL_SCHEME_RE.test(value)) {
      return false
    }

    return true
  }

  const parseExplicitLinkCandidates = (markdown) => {
    const candidates = []

    const wikilinkRe = /(?<!!)\[\[([^\[\]]+)\]\]/g
    let match
    while ((match = wikilinkRe.exec(markdown)) !== null) {
      const inner = match[1].trim()
      if (!inner) continue

      const splitAlias = inner.split("|", 2)
      const pathPart = splitAlias[0].trim()
      const display = splitAlias.length > 1 && splitAlias[1].trim() ? splitAlias[1].trim() : pathPart
      const target = pathPart.split("#", 1)[0].trim()

      if (target) {
        candidates.push({ target, text: decodeHtmlEntities(display) || target })
      }
    }

    const markdownLinkRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
    while ((match = markdownLinkRe.exec(markdown)) !== null) {
      const label = decodeHtmlEntities(match[1].trim())
      const target = stripMarkdownTarget(match[2]).split("#", 1)[0].trim()
      if (target) {
        candidates.push({ target, text: label || target })
      }
    }

    return candidates
  }

  const normalizeLink = (link) => {
    if (!link || typeof link !== "object") return null

    const source = canonicalizeId(link.source)
    const target = canonicalizeId(link.target)
    if (!source || !target) return null

    let text = typeof link.text === "string" ? decodeHtmlEntities(link.text).trim() : ""
    if (!text) {
      text = defaultTitleFromId(target)
    }

    return { source, target, text }
  }

  const flattenIndexMap = (indexMap) => {
    const linksFromMap = []
    if (!indexMap || typeof indexMap !== "object") return linksFromMap

    Object.values(indexMap).forEach((entries) => {
      if (!Array.isArray(entries)) return
      entries.forEach((entry) => {
        const normalized = normalizeLink(entry)
        if (normalized) {
          linksFromMap.push(normalized)
        }
      })
    })

    return linksFromMap
  }

  const dedupeLinks = (rawGraphLinks) => {
    const deduped = new Map()

    rawGraphLinks.forEach((entry) => {
      const link = normalizeLink(entry)
      if (!link) return

      const key = `${link.source}->${link.target}`
      if (!deduped.has(key)) {
        deduped.set(key, link)
      }
    })

    return [...deduped.values()].sort((a, b) => {
      if (a.source !== b.source) return a.source.localeCompare(b.source)
      if (a.target !== b.target) return a.target.localeCompare(b.target)
      return (a.text || "").localeCompare(b.text || "")
    })
  }

  const buildIndex = (graphLinks) => {
    const outgoing = {}
    const incoming = {}

    graphLinks.forEach((link) => {
      if (!outgoing[link.source]) outgoing[link.source] = []
      if (!incoming[link.target]) incoming[link.target] = []

      outgoing[link.source].push(link)
      incoming[link.target].push(link)
    })

    Object.values(outgoing).forEach((links) => {
      links.sort((a, b) => {
        if (a.target !== b.target) return a.target.localeCompare(b.target)
        return (a.text || "").localeCompare(b.text || "")
      })
    })

    Object.values(incoming).forEach((links) => {
      links.sort((a, b) => {
        if (a.source !== b.source) return a.source.localeCompare(b.source)
        return (a.text || "").localeCompare(b.text || "")
      })
    })

    return {
      links: outgoing,
      backlinks: incoming,
    }
  }

  const extractRuntimeLinks = (contentTable, maps) => {
    const extracted = []

    Object.entries(contentTable).forEach(([sourceId, entry]) => {
      const markdown = typeof entry?.content === "string" ? entry.content : ""
      if (!markdown) return

      parseExplicitLinkCandidates(markdown).forEach(({ target, text }) => {
        if (!isInternalTarget(target)) return

        const resolved = resolveTarget(sourceId, decodeHtmlEntities(target).trim(), maps)
        if (!resolved || resolved === sourceId) return

        extracted.push({ source: sourceId, target: resolved, text: text || target })
      })
    })

    return dedupeLinks(extracted)
  }

  const normalizedPathColors = (Array.isArray(pathColors) ? pathColors : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const key = Object.keys(entry)[0]
      if (!key) return null
      const color = entry[key]
      const normalizedPath = canonicalizeId(key) || key
      return { [normalizedPath]: color }
    })
    .filter((entry) => entry)

  const content = normalizeContentTable(rawContent)
  const linksFromIndex = [...flattenIndexMap(rawIndex.links), ...flattenIndexMap(rawIndex.backlinks)]
  const linksFromFetch = rawLinks.map(normalizeLink).filter((entry) => entry)
  const resolutionMaps = buildResolutionMaps(content)
  const runtimeLinks = extractRuntimeLinks(content, resolutionMaps)

  const links = dedupeLinks([...linksFromIndex, ...linksFromFetch, ...runtimeLinks])
  const index = buildIndex(links)

  // Use .pathname to remove hashes / search params / text fragments
  const cleanUrl = window.location.origin + window.location.pathname
  const curPage = canonicalizeId(cleanUrl.replace(/\/$/g, "").replace(baseUrl, "")) || "/"

  const parseIdsFromLinks = (graphLinks) => [
    ...new Set(
      (Array.isArray(graphLinks) ? graphLinks : [])
        .flatMap((link) => [
          link && typeof link.source === "string" ? link.source : null,
          link && typeof link.target === "string" ? link.target : null,
        ])
        .filter((id) => id),
    ),
  ]

  // Links are mutated by d3. We still need the canonical values later.
  const copyLinks = JSON.parse(JSON.stringify(links))

  const neighbours = new Set()
  const wl = [curPage, "__SENTINEL"]
  let remainingDepth = depth

  if (remainingDepth >= 0) {
    while (remainingDepth >= 0 && wl.length > 0) {
      const cur = wl.shift()
      if (cur === "__SENTINEL") {
        remainingDepth -= 1
        wl.push("__SENTINEL")
      } else if (typeof cur === "string") {
        neighbours.add(cur)
        const outgoing = Array.isArray(index.links[cur]) ? index.links[cur] : []
        const incoming = Array.isArray(index.backlinks[cur]) ? index.backlinks[cur] : []
        wl.push(...outgoing.map((entry) => entry.target), ...incoming.map((entry) => entry.source))
      }
    }
  } else {
    // For global graph: include all linked nodes and all unlinked notes.
    parseIdsFromLinks(copyLinks).forEach((id) => neighbours.add(id))
    Object.keys(content).forEach((id) => neighbours.add(id))
  }

  const data = {
    nodes: [...neighbours].map((id) => ({ id })),
    links: copyLinks.filter(
      (entry) =>
        entry &&
        typeof entry.source === "string" &&
        typeof entry.target === "string" &&
        neighbours.has(entry.source) &&
        neighbours.has(entry.target),
    ),
  }

  const color = (d) => {
    if (d.id === curPage) {
      return "var(--g-node-active)"
    }

    for (const pathColor of normalizedPathColors) {
      const path = Object.keys(pathColor)[0]
      const colour = pathColor[path]
      if (d.id.startsWith(path)) {
        return colour
      }
    }

    return "var(--g-node)"
  }

  const makeNavigationPath = (id) => `${baseUrl}${id === "/" ? "/" : `${id}/`}`

  const nodeLabel = (d) => {
    const title = content[d.id]?.title
    if (typeof title === "string" && title.trim()) {
      return title
    }
    return defaultTitleFromId(d.id)
  }

  const drag = (simulation) => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(1).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event, d) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    const noop = () => {}
    return d3
      .drag()
      .on("start", enableDrag ? dragstarted : noop)
      .on("drag", enableDrag ? dragged : noop)
      .on("end", enableDrag ? dragended : noop)
  }

  const height = Math.max(container.offsetHeight, isHome ? 500 : 250)
  const width = container.offsetWidth

  const simulation = d3
    .forceSimulation(data.nodes)
    .force("charge", d3.forceManyBody().strength(-100 * repelForce))
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance(40),
    )
    .force("center", d3.forceCenter())

  const svg = d3
    .select("#graph-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2 / scale, -height / 2 / scale, width / scale, height / scale])

  if (enableLegend) {
    const legend = [{ Current: "var(--g-node-active)" }, { Note: "var(--g-node)" }, ...normalizedPathColors]
    legend.forEach((legendEntry, i) => {
      const key = Object.keys(legendEntry)[0]
      const colour = legendEntry[key]
      svg
        .append("circle")
        .attr("cx", -width / 2 + 20)
        .attr("cy", height / 2 - 30 * (i + 1))
        .attr("r", 6)
        .style("fill", colour)
      svg
        .append("text")
        .attr("x", -width / 2 + 40)
        .attr("y", height / 2 - 30 * (i + 1))
        .text(key)
        .style("font-size", "15px")
        .attr("alignment-baseline", "middle")
    })
  }

  // Draw links between nodes.
  const link = svg
    .append("g")
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("class", "link")
    .attr("stroke", "var(--g-link)")
    .attr("stroke-width", 2)
    .attr("data-source", (d) => (typeof d.source === "string" ? d.source : d.source.id))
    .attr("data-target", (d) => (typeof d.target === "string" ? d.target : d.target.id))

  // SVG groups.
  const graphNode = svg.append("g").selectAll("g").data(data.nodes).enter().append("g")

  // Calculate radius from in/out degree.
  const nodeRadius = (d) => {
    const numOut = index.links[d.id]?.length || 0
    const numIn = index.backlinks[d.id]?.length || 0
    return 2 + Math.sqrt(numOut + numIn)
  }

  // Draw individual nodes.
  const node = graphNode
    .append("circle")
    .attr("class", "node")
    .attr("id", (d) => d.id)
    .attr("r", nodeRadius)
    .attr("fill", color)
    .style("cursor", "pointer")
    .on("click", (_, d) => {
      // SPA navigation
      window.Million.navigate(new URL(makeNavigationPath(d.id)), ".singlePage")
    })
    .on("mouseover", function (_, d) {
      d3.selectAll(".node").transition().duration(100).attr("fill", "var(--g-node-inactive)")

      const outgoing = Array.isArray(index.links[d.id]) ? index.links[d.id] : []
      const incoming = Array.isArray(index.backlinks[d.id]) ? index.backlinks[d.id] : []
      const neighbourIds = parseIdsFromLinks([...outgoing, ...incoming])
      const neighbourNodes = d3.selectAll(".node").filter((entry) => neighbourIds.includes(entry.id))
      const currentId = d.id
      window.Million.prefetch(new URL(makeNavigationPath(d.id)))
      const linkNodes = d3
        .selectAll(".link")
        .filter((entry) => entry.source.id === currentId || entry.target.id === currentId)

      // Highlight neighbour nodes.
      neighbourNodes.transition().duration(200).attr("fill", color)

      // Highlight links.
      linkNodes.transition().duration(200).attr("stroke", "var(--g-link-active)")

      const bigFont = fontSize * 1.5

      // Show text for self.
      d3.select(this.parentNode)
        .raise()
        .select("text")
        .transition()
        .duration(200)
        .attr("opacityOld", d3.select(this.parentNode).select("text").style("opacity"))
        .style("opacity", 1)
        .style("font-size", `${bigFont}em`)
        .attr("dy", (entry) => `${nodeRadius(entry) + 20}px`)
    })
    .on("mouseleave", function (_, d) {
      d3.selectAll(".node").transition().duration(200).attr("fill", color)

      const currentId = d.id
      const linkNodes = d3
        .selectAll(".link")
        .filter((entry) => entry.source.id === currentId || entry.target.id === currentId)

      linkNodes.transition().duration(200).attr("stroke", "var(--g-link)")

      d3.select(this.parentNode)
        .select("text")
        .transition()
        .duration(200)
        .style("opacity", d3.select(this.parentNode).select("text").attr("opacityOld"))
        .style("font-size", `${fontSize}em`)
        .attr("dy", (entry) => `${nodeRadius(entry) + 8}px`)
    })
    .call(drag(simulation))

  // Draw labels.
  const labels = graphNode
    .append("text")
    .attr("dx", 0)
    .attr("dy", (d) => `${nodeRadius(d) + 8}px`)
    .attr("text-anchor", "middle")
    .text(nodeLabel)
    .style("opacity", (opacityScale - 1) / 3.75)
    .style("pointer-events", "none")
    .style("font-size", `${fontSize}em`)
    .raise()
    .call(drag(simulation))

  if (enableZoom) {
    svg.call(
      d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          link.attr("transform", transform)
          node.attr("transform", transform)
          const zoomScale = transform.k * opacityScale
          const scaledOpacity = Math.max((zoomScale - 1) / 3.75, 0)
          labels.attr("transform", transform).style("opacity", scaledOpacity)
        }),
    )
  }

  // Progress the simulation.
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)

    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y)
    labels.attr("x", (d) => d.x).attr("y", (d) => d.y)
  })
}
