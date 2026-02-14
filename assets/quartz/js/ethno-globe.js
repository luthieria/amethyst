;(function () {
  const D3_URL = "https://cdn.jsdelivr.net/npm/d3@6.7.0/dist/d3.min.js"
  const TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"
  const WORLD_TOPO_URLS = [
    "/data/countries-110m.json",
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  ]
  const WORLD_OBJECT_KEY = "countries"

  const rootState = new WeakMap()
  let dependencyPromise = null
  let worldDataPromise = null

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const loadScript = (src, checkLoaded) => {
    if (checkLoaded()) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-ethno-lib="${src}"]`)
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true })
        return
      }

      const script = document.createElement("script")
      script.async = true
      script.src = src
      script.dataset.ethnoLib = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(script)
    })
  }

  const ensureDependencies = () => {
    if (!dependencyPromise) {
      dependencyPromise = Promise.resolve()
        .then(() => {
          if (typeof window.d3 === "undefined") {
            return loadScript(D3_URL, () => typeof window.d3 !== "undefined")
          }

          return undefined
        })
        .then(() => {
          if (typeof window.topojson === "undefined") {
            return loadScript(TOPOJSON_URL, () => typeof window.topojson !== "undefined")
          }

          return undefined
        })
    }

    return dependencyPromise
  }

  const fetchFirstJson = async (urls) => {
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        return response.json()
      } catch (_) {
        // try the next source
      }
    }

    throw new Error("Failed to load world topology from local and remote sources.")
  }

  const parseEntries = (root) => {
    const script = root.querySelector(".ethno-globe-data")
    if (!script) return []

    try {
      let raw = JSON.parse(script.textContent || "[]")
      if (typeof raw === "string") {
        raw = JSON.parse(raw)
      }
      if (!Array.isArray(raw)) return []

      return raw
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : "",
          title: typeof entry.title === "string" ? entry.title : "",
          url: typeof entry.url === "string" ? entry.url : "",
          kind: entry.kind === "country" ? "country" : "region",
          iso2: typeof entry.iso2 === "string" ? entry.iso2.toUpperCase() : "",
          depth: clamp(toNumber(entry.depth, 1), 1, 8),
          lat: clamp(toNumber(entry.lat, 0), -89.999, 89.999),
          lon: clamp(toNumber(entry.lon, 0), -180, 180),
          dx: toNumber(entry.dx, 0),
          dy: toNumber(entry.dy, 0),
          haloRx: Math.max(0, toNumber(entry.halo_rx, 0)),
          haloRy: Math.max(0, toNumber(entry.halo_ry, 0)),
        }))
        .filter((entry) => entry.id && entry.title && entry.url)
    } catch (_) {
      return []
    }
  }

  const loadWorldData = async () => {
    if (!worldDataPromise) {
      worldDataPromise = (async () => {
        try {
          const topology = await fetchFirstJson(WORLD_TOPO_URLS)

          const countriesObject = topology?.objects?.[WORLD_OBJECT_KEY]
          if (!countriesObject) {
            throw new Error("Missing countries object in world topology")
          }

          const features = window.topojson.feature(topology, countriesObject).features || []
          const borders = window.topojson.mesh(topology, countriesObject, (a, b) => a !== b)
          return { features, borders }
        } catch (error) {
          console.warn("[ethno-globe] Country geometry unavailable; using hotspot fallback.", error)
          return null
        }
      })()
    }

    return worldDataPromise
  }

  const findCountryFeatureForEntry = (entry, features) => {
    const d3 = window.d3
    const point = [entry.lon, entry.lat]
    const containing = features.find((feature) => d3.geoContains(feature, point))
    if (containing) return containing

    let nearest = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const feature of features) {
      const center = d3.geoCentroid(feature)
      const distance = d3.geoDistance(point, center)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = feature
      }
    }

    return nearest
  }

  const navigateTo = (event, url) => {
    if (!url) return
    if (event.defaultPrevented) return
    if (event.type === "click" && event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    if (window.Million && typeof window.Million.navigate === "function") {
      event.preventDefault()
      window.Million.navigate(url, ".singlePage")
    }
  }

  const regionRadiusDegrees = (entry) => {
    const avgRadius = (entry.haloRx + entry.haloRy) / 2
    const converted = (avgRadius / 2000) * 360
    return clamp(converted || 18, 10, 76)
  }

  const isPointVisible = (projection, lon, lat) => {
    const rotate = projection.rotate()
    const center = [-rotate[0], -rotate[1]]
    return window.d3.geoDistance([lon, lat], center) <= Math.PI / 2
  }

  const showError = (stage, message) => {
    stage.innerHTML = ""
    const error = document.createElement("div")
    error.className = "ethno-globe-error"
    error.textContent = message
    stage.appendChild(error)
  }

  const initRoot = async (root) => {
    if (!(root instanceof HTMLElement)) return
    if (root.dataset.ethnoGlobeReady === "true" || root.dataset.ethnoGlobeReady === "pending") return

    const stage = root.querySelector(".ethno-globe-stage")
    if (!stage) return

    const entries = parseEntries(root)
    if (entries.length === 0) {
      showError(stage, "No navigation entries are available for this globe.")
      return
    }

    root.dataset.ethnoGlobeReady = "pending"

    try {
      await ensureDependencies()
      const worldData = await loadWorldData()
      if (!root.isConnected) return

      stage.innerHTML = ""

      const d3 = window.d3
      const svg = d3.select(stage).append("svg").attr("class", "ethno-globe-svg").attr("role", "img")
      svg.append("title").text("Interactive ethnomusicology globe")
      svg.append("rect").attr("class", "ethno-globe-backdrop")

      const viewport = svg.append("g").attr("class", "ethno-globe-viewport")
      const spherePath = viewport.append("path").attr("class", "ethno-globe-sphere")
      let countryPaths = null
      let bordersPath = null

      if (worldData) {
        const countriesGroup = viewport.append("g").attr("class", "ethno-globe-countries")
        countryPaths = countriesGroup
          .selectAll("path")
          .data(worldData.features)
          .enter()
          .append("path")
          .attr("class", "ethno-globe-country")

        bordersPath = viewport.append("path").attr("class", "ethno-globe-borders")
      }
      const interactionGroup = viewport.append("g").attr("class", "ethno-globe-interactions")
      const regionGroup = interactionGroup.append("g").attr("class", "ethno-globe-region-links")
      const countryGroup = interactionGroup.append("g").attr("class", "ethno-globe-country-links")
      const labelsGroup = viewport.append("g").attr("class", "ethno-globe-labels")

      const projection = d3.geoOrthographic().precision(0.2).clipAngle(90).rotate([-12, -15, 0])
      const path = d3.geoPath(projection)
      const sphere = { type: "Sphere" }

      const countryEntries = entries
        .filter((entry) => entry.kind === "country")
        .map((entry) => {
          if (worldData) {
            const feature = findCountryFeatureForEntry(entry, worldData.features)
            if (feature) {
              return { ...entry, shape: feature }
            }
          }

          // Fallback hotspot when country polygon data is unavailable.
          return {
            ...entry,
            shape: d3.geoCircle().center([entry.lon, entry.lat]).radius(4.5)(),
          }
        })

      const regionEntries = entries
        .filter((entry) => entry.kind === "region")
        .map((entry) => ({
          ...entry,
          geometry: d3.geoCircle().center([entry.lon, entry.lat]).radius(regionRadiusDegrees(entry))(),
        }))

      const regionLinks = regionGroup
        .selectAll("a")
        .data(regionEntries, (entry) => entry.id)
        .enter()
        .append("a")
        .attr("class", (entry) => `ethno-globe-link region depth-${entry.depth}`)
        .attr("href", (entry) => entry.url)
        .attr("xlink:href", (entry) => entry.url)
        .attr("aria-label", (entry) => entry.title)
        .on("click", (event, entry) => navigateTo(event, entry.url))

      regionLinks.append("title").text((entry) => entry.title)
      regionLinks.append("path")

      const countryLinks = countryGroup
        .selectAll("a")
        .data(countryEntries, (entry) => entry.id)
        .enter()
        .append("a")
        .attr("class", (entry) => `ethno-globe-link country depth-${entry.depth}`)
        .attr("href", (entry) => entry.url)
        .attr("xlink:href", (entry) => entry.url)
        .attr("aria-label", (entry) => entry.title)
        .on("click", (event, entry) => navigateTo(event, entry.url))

      countryLinks.append("title").text((entry) => entry.title)
      countryLinks.append("path")

      const labelEntries = [...regionEntries, ...countryEntries]
      let width = 0
      let height = 0
      let baseScale = 1
      let zoomScale = 1
      const minScale = 0.72
      const maxScale = 2.45

      const applyScale = () => {
        projection.scale(baseScale * zoomScale)
      }

      const redraw = () => {
        spherePath.attr("d", path(sphere))
        if (countryPaths) {
          countryPaths.attr("d", (feature) => path(feature))
        }
        if (bordersPath && worldData) {
          bordersPath.attr("d", path(worldData.borders))
        }
        regionLinks.select("path").attr("d", (entry) => path(entry.geometry))
        countryLinks.select("path").attr("d", (entry) => path(entry.shape))

        const visibleLabels = labelEntries
          .map((entry) => {
            const projected = projection([entry.lon, entry.lat])
            if (!projected) return null
            if (!isPointVisible(projection, entry.lon, entry.lat)) return null

            return {
              ...entry,
              x: projected[0] + entry.dx,
              y: projected[1] + entry.dy,
            }
          })
          .filter(Boolean)

        labelsGroup
          .selectAll("text")
          .data(visibleLabels, (entry) => entry.id)
          .join(
            (enter) =>
              enter
                .append("text")
                .attr("class", (entry) => `depth-${entry.depth}`)
                .attr("text-anchor", (entry) => (entry.dx > 8 ? "start" : entry.dx < -8 ? "end" : "middle"))
                .attr("dominant-baseline", "middle")
                .text((entry) => entry.title),
            (update) =>
              update
                .attr("class", (entry) => `depth-${entry.depth}`)
                .attr("text-anchor", (entry) => (entry.dx > 8 ? "start" : entry.dx < -8 ? "end" : "middle")),
            (exit) => exit.remove(),
          )
          .attr("x", (entry) => entry.x)
          .attr("y", (entry) => entry.y)
      }

      const resize = () => {
        width = Math.max(320, Math.floor(stage.clientWidth || 320))
        height = Math.max(320, Math.floor(stage.clientHeight || 320))
        baseScale = Math.max(120, Math.min(width, height) * 0.47)

        svg.attr("viewBox", `0 0 ${width} ${height}`)
        svg.select(".ethno-globe-backdrop").attr("width", width).attr("height", height)
        projection.translate([width / 2, height / 2])
        applyScale()
        redraw()
      }

      const dragBehavior = d3
        .drag()
        .on("start", (event) => {
          stage.classList.add("is-dragging")
          rootState.set(root, {
            ...rootState.get(root),
            dragOrigin: [event.x, event.y],
            dragRotate: projection.rotate(),
          })
        })
        .on("drag", (event) => {
          const state = rootState.get(root)
          if (!state || !state.dragOrigin || !state.dragRotate) return

          const sensitivity = 0.24 / zoomScale
          const dx = event.x - state.dragOrigin[0]
          const dy = event.y - state.dragOrigin[1]
          const lambda = state.dragRotate[0] + dx * sensitivity
          const phi = clamp(state.dragRotate[1] - dy * sensitivity, -85, 85)
          projection.rotate([lambda, phi, state.dragRotate[2] || 0])
          redraw()
        })
        .on("end", () => {
          stage.classList.remove("is-dragging")
          const state = rootState.get(root)
          if (!state) return
          state.dragOrigin = null
          state.dragRotate = null
          rootState.set(root, state)
        })

      svg.call(dragBehavior)

      stage.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault()
          const nextScale = zoomScale * Math.exp(-event.deltaY * 0.0015)
          zoomScale = clamp(nextScale, minScale, maxScale)
          applyScale()
          redraw()
        },
        { passive: false },
      )

      const resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(stage)

      rootState.set(root, {
        resizeObserver,
        dragOrigin: null,
        dragRotate: null,
      })

      resize()
      root.dataset.ethnoGlobeReady = "true"
    } catch (error) {
      root.dataset.ethnoGlobeReady = "error"
      showError(stage, "Could not initialize globe.")
      console.error("[ethno-globe]", error)
    }
  }

  const initAll = () => {
    document.querySelectorAll("[data-ethno-globe]").forEach((root) => {
      initRoot(root)
    })
  }

  window.initEthnoWorldGlobe = initAll

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll, { once: true })
  } else {
    initAll()
  }

  window.addEventListener("million:navigate", () => {
    requestAnimationFrame(initAll)
  })
})()
