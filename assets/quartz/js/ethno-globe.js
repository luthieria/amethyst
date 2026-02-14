;(function () {
  // === Config: Manual Tuning ===
  const TUNING = {
    stage: {
      minSizePx: 320,
    },
    projection: {
      precision: 0.2,
      clipAngle: 90,
      rotate: [-12, -15, 0],
      baseScaleFactor: 0.5,
      baseScaleOffset: -8,
      minBaseScalePx: 120,
    },
    zoom: {
      min: 0.72,
      max: 2.45,
      wheelSensitivity: 0.0015,
    },
    drag: {
      sensitivity: 0.24,
      minLatitude: -85,
      maxLatitude: 85,
    },
    halo: {
      sourceMapWidth: 2000,
      fallbackDegrees: 18,
      minDegrees: 10,
      maxDegrees: 76,
      fallbackCountryDegrees: 4.5,
    },
    color: {
      regionFillAlpha: 0.03,
      regionStrokeAlpha: 0.14,
      regionFillHoverAlpha: 0.08,
      regionStrokeHoverAlpha: 0.32,
      countryFillAlpha: 0.18,
      countryStrokeAlpha: 0.5,
      countryFillHoverAlpha: 0.36,
      countryStrokeHoverAlpha: 0.86,
      mapCountryFillAlpha: 0.48,
      mapCountryStrokeAlpha: 0.82,
      fallbackMapCountryFill: "rgba(13, 19, 29, 0.76)",
      fallbackMapCountryStroke: "rgba(246, 250, 255, 0.32)",
      regionStrokeAdjust: { s: 8, l: 16 },
      regionFillHoverAdjust: { s: 8, l: 8 },
      regionStrokeHoverAdjust: { s: 20, l: 20 },
      countryStrokeAdjust: { s: 8, l: 14 },
      countryFillHoverAdjust: { s: 14, l: 6 },
      countryStrokeHoverAdjust: { s: 24, l: 22 },
      countryVariation: {
        hueSpreadCap: 22,
        hueSpreadBase: 42,
        hueJitter: 9,
        saturationBaseBoost: 18,
        saturationEdgeBoost: 6,
        saturationJitterBoost: 4,
        saturationMin: 38,
        saturationMax: 92,
        lightnessBaseShift: -8,
        lightnessIndexShift: 5,
        lightnessJitterShift: 4,
        lightnessMin: 22,
        lightnessMax: 78,
      },
    },
  }

  // === Constants & Runtime Flags ===
  const D3_URL = "https://cdn.jsdelivr.net/npm/d3@6.7.0/dist/d3.min.js"
  const TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"
  const WORLD_TOPO_URLS = [
    "/data/countries-110m.json",
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  ]
  const WORLD_OBJECT_KEY = "countries"
  const ETHNO_ACTIVE_CLASS = "page-ethno-map-full-active"
  const ETHNO_STATIC_CLASS = "page-ethno-map-full"
  const ETHNO_ROOT_SELECTOR = "[data-ethno-globe]"
  const REGION_PALETTE = [
    { h: 198, s: 58, l: 56 },
    { h: 16, s: 56, l: 57 },
    { h: 274, s: 48, l: 59 },
    { h: 136, s: 48, l: 55 },
    { h: 44, s: 58, l: 58 },
    { h: 332, s: 50, l: 58 },
    { h: 224, s: 56, l: 58 },
    { h: 178, s: 48, l: 54 },
    { h: 86, s: 44, l: 56 },
    { h: 256, s: 50, l: 58 },
    { h: 12, s: 58, l: 58 },
    { h: 206, s: 62, l: 56 },
  ]
  const DEFAULT_REGION_COLOR = { h: 208, s: 52, l: 56 }
  const COUNTRY_NAME_ALIASES = {
    lybia: "libya",
    mauretania: "mauritania",
    drc: "dem rep congo",
    "democratic republic of the congo": "dem rep congo",
    "central african republic": "central african rep",
    car: "central african rep",
    "south sudan": "s sudan",
    "equatorial guinea": "eq guinea",
    "cote d ivoire": "cote divoire",
    "ivory coast": "cote divoire",
    "cabo verde": "cape verde",
    "sao tome and principe": "sao tome and principe",
  }

  // === Shared State ===
  const rootStates = new Map()
  let dependencyPromise = null
  let worldDataPromise = null

  // === Utility Functions ===

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const stripAccents = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const isEthnoOverlayPage = () =>
    !!(
      document.body &&
      (document.body.classList.contains(ETHNO_ACTIVE_CLASS) || document.body.classList.contains(ETHNO_STATIC_CLASS))
    )

  const normalizePath = (value) =>
    stripAccents(value)
      .replace(/\\/g, "/")
      .split("/")
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean)
      .join("/")

  const normalizeCountryName = (value) =>
    stripAccents(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")

  const canonicalCountryName = (value) => {
    const normalized = normalizeCountryName(value)
    return COUNTRY_NAME_ALIASES[normalized] || normalized
  }

  // === Data & Resource Loading ===
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

  // Parse and normalize entry payload emitted by the shortcode.
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
        .map((entry) => {
          const rawHaloCountries = Array.isArray(entry.halo_countries)
            ? entry.halo_countries
            : typeof entry.halo_countries === "string"
              ? [entry.halo_countries]
              : []

          return {
            id: typeof entry.id === "string" ? entry.id : "",
            title: typeof entry.title === "string" ? entry.title : "",
            path: typeof entry.path === "string" ? entry.path : "",
            url: typeof entry.url === "string" ? entry.url : "",
            kind: entry.kind === "country" ? "country" : "region",
            depth: clamp(toNumber(entry.depth, 1), 1, 8),
            lat: clamp(toNumber(entry.lat, 0), -89.999, 89.999),
            lon: clamp(toNumber(entry.lon, 0), -180, 180),
            dx: toNumber(entry.dx, 0),
            dy: toNumber(entry.dy, 0),
            haloRx: Math.max(0, toNumber(entry.halo_rx, 0)),
            haloRy: Math.max(0, toNumber(entry.halo_ry, 0)),
            haloCountries: rawHaloCountries.map((value) => String(value || "").trim()).filter(Boolean),
          }
        })
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
          const geometryById = new Map(
            (Array.isArray(countriesObject.geometries) ? countriesObject.geometries : [])
              .map((geometry) => [String(geometry?.id || "").trim(), geometry])
              .filter(([id]) => id),
          )
          const borders = window.topojson.mesh(topology, countriesObject, (a, b) => a !== b)
          return { topology, features, borders, geometryById }
        } catch (error) {
          console.warn("[ethno-globe] Country geometry unavailable; using hotspot fallback.", error)
          return null
        }
      })()
    }

    return worldDataPromise
  }

  const findCountryFeatureForEntry = (entry, features) => {
    // Use containment first, then nearest feature centroid as robust fallback.
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

  const buildWorldFeatureIndex = (features) => {
    const byId = new Map()
    const byName = new Map()

    features.forEach((feature) => {
      const id = String(feature?.id || "").trim()
      const rawName = feature?.properties?.name
      const name = canonicalCountryName(rawName)

      if (id) byId.set(id, feature)
      if (name) byName.set(name, feature)
    })

    return { byId, byName }
  }

  const resolveRegionHaloGeometry = (regionEntry, countryEntries, worldFeatureIndex, worldData) => {
    const features = []
    const seen = new Set()

    const pushFeature = (feature) => {
      if (!feature) return
      const key = String(feature.id || feature?.properties?.name || "")
      if (!key || seen.has(key)) return
      seen.add(key)
      features.push(feature)
    }

    if (regionEntry.haloCountries.length > 0) {
      regionEntry.haloCountries.forEach((country) => {
        const idMatch = worldFeatureIndex.byId.get(String(country).trim())
        if (idMatch) {
          pushFeature(idMatch)
          return
        }

        const nameMatch = worldFeatureIndex.byName.get(canonicalCountryName(country))
        if (nameMatch) pushFeature(nameMatch)
      })
      // Continue into merge/fallback path.
    }

    if (features.length === 0) {
      const prefix = regionEntry.normalizedPath ? `${regionEntry.normalizedPath}/` : ""
      countryEntries.forEach((entry) => {
        if (!entry.hasWorldShape) return
        if (!regionEntry.normalizedPath) return
        if (entry.normalizedPath === regionEntry.normalizedPath || entry.normalizedPath.startsWith(prefix)) {
          pushFeature(entry.shape)
        }
      })
    }

    if (features.length === 0) return null

    const canMerge =
      !!(
        worldData &&
        worldData.topology &&
        worldData.geometryById &&
        window.topojson &&
        typeof window.topojson.merge === "function"
      )

    if (canMerge) {
      const geometries = []
      const seenGeometries = new Set()

      features.forEach((feature) => {
        const id = String(feature?.id || "").trim()
        if (!id || seenGeometries.has(id)) return
        const geometry = worldData.geometryById.get(id)
        if (!geometry) return
        seenGeometries.add(id)
        geometries.push(geometry)
      })

      if (geometries.length > 0) {
        const merged = window.topojson.merge(worldData.topology, geometries)
        if (merged) return merged
      }
    }

    return { type: "FeatureCollection", features }
  }

  // === Color Assignment ===
  const toHsla = (color, alpha) => `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`

  const adjustColor = (color, saturationDelta, lightnessDelta) => ({
    h: color.h,
    s: clamp(color.s + saturationDelta, 20, 90),
    l: clamp(color.l + lightnessDelta, 20, 84),
  })

  const wrapHue = (value) => {
    const normalized = value % 360
    return normalized < 0 ? normalized + 360 : normalized
  }

  const hashString = (value) => {
    let hash = 2166136261
    const source = String(value || "")
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i)
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return hash >>> 0
  }

  const signedHashUnit = (value) => (hashString(value) % 2001) / 1000 - 1

  const deriveCountryColor = (regionColor, countryId, indexWithinRegion, regionCountryCount) => {
    // Keep each country unique while remaining close to its parent region hue family.
    const variation = TUNING.color.countryVariation
    const count = Math.max(1, regionCountryCount)
    const normalizedIndex = count === 1 ? 0 : (indexWithinRegion / (count - 1)) * 2 - 1
    const jitter = signedHashUnit(`${countryId}:${count}`)
    const hueSpread = Math.min(variation.hueSpreadCap, variation.hueSpreadBase / Math.sqrt(count))
    const hueShift = normalizedIndex * hueSpread + jitter * variation.hueJitter
    const saturationBoost =
      variation.saturationBaseBoost +
      Math.abs(normalizedIndex) * variation.saturationEdgeBoost +
      (jitter + 1) * variation.saturationJitterBoost
    const lightnessShift =
      variation.lightnessBaseShift + normalizedIndex * variation.lightnessIndexShift + jitter * variation.lightnessJitterShift

    return {
      h: wrapHue(regionColor.h + hueShift),
      s: clamp(regionColor.s + saturationBoost, variation.saturationMin, variation.saturationMax),
      l: clamp(regionColor.l + lightnessShift, variation.lightnessMin, variation.lightnessMax),
    }
  }

  const resolveCountryRegion = (countryEntry, regions) => {
    const countryPath = normalizePath(countryEntry.path)
    let best = null

    for (const region of regions) {
      if (!region.normalizedPath) continue
      if (countryPath === region.normalizedPath || countryPath.startsWith(`${region.normalizedPath}/`)) {
        if (!best || region.normalizedPath.length > best.normalizedPath.length) {
          best = region
        }
      }
    }

    if (best) return best

    let nearest = null
    let nearestScore = Number.POSITIVE_INFINITY
    for (const region of regions) {
      const latDiff = countryEntry.lat - region.lat
      const lonDiff = countryEntry.lon - region.lon
      const score = latDiff * latDiff + lonDiff * lonDiff
      if (score < nearestScore) {
        nearestScore = score
        nearest = region
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
    const converted = (avgRadius / TUNING.halo.sourceMapWidth) * 360
    return clamp(converted || TUNING.halo.fallbackDegrees, TUNING.halo.minDegrees, TUNING.halo.maxDegrees)
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

  // === Root Lifecycle ===
  const teardownRoot = (root) => {
    const state = rootStates.get(root)
    if (!state) return

    if (state.resizeObserver) {
      state.resizeObserver.disconnect()
    }
    if (typeof state.onWindowResize === "function") {
      window.removeEventListener("resize", state.onWindowResize)
    }

    rootStates.delete(root)
    if (root instanceof HTMLElement && root.dataset.ethnoGlobeReady === "true") {
      root.dataset.ethnoGlobeReady = ""
    }
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
      const svg = d3
        .select(stage)
        .append("svg")
        .attr("class", "ethno-globe-svg")
        .attr("role", "img")
        .attr("aria-label", "Interactive ethnomusicology globe")
      svg.append("rect").attr("class", "ethno-globe-backdrop")

      const hint = document.createElement("div")
      hint.className = "ethno-globe-hint"
      hint.setAttribute("aria-live", "polite")
      hint.setAttribute("aria-atomic", "true")
      stage.appendChild(hint)

      const setHint = (text) => {
        const message = typeof text === "string" ? text.trim() : ""
        if (!message) {
          hint.textContent = ""
          hint.classList.remove("is-visible")
          return
        }

        hint.textContent = message
        hint.classList.add("is-visible")
      }

      stage.addEventListener("mouseleave", () => setHint(""))

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

      const projection = d3
        .geoOrthographic()
        .precision(TUNING.projection.precision)
        .clipAngle(TUNING.projection.clipAngle)
        .rotate(TUNING.projection.rotate)
      const path = d3.geoPath(projection)
      const sphere = { type: "Sphere" }

      const seededRegions = entries
        .filter((entry) => entry.kind === "region")
        .map((entry, index) => ({
          ...entry,
          normalizedPath: normalizePath(entry.path),
          color: REGION_PALETTE[index % REGION_PALETTE.length] || DEFAULT_REGION_COLOR,
        }))

      const countryFeatureColors = new Map()
      const seededCountries = entries
        .filter((entry) => entry.kind === "country")
        .map((entry, index) => {
          const parentRegion = resolveCountryRegion(entry, seededRegions)
          const regionColor =
            parentRegion?.color || REGION_PALETTE[(seededRegions.length + index) % REGION_PALETTE.length] || DEFAULT_REGION_COLOR
          return {
            ...entry,
            normalizedPath: normalizePath(entry.path),
            regionId: parentRegion?.id || "",
            regionColor,
          }
        })

      const countriesByRegion = new Map()
      seededCountries.forEach((entry) => {
        const key = entry.regionId || "__fallback__"
        if (!countriesByRegion.has(key)) {
          countriesByRegion.set(key, [])
        }
        countriesByRegion.get(key).push(entry)
      })

      const coloredCountries = []
      countriesByRegion.forEach((bucket) => {
        const sorted = bucket.slice().sort((a, b) => a.id.localeCompare(b.id))
        const count = sorted.length
        sorted.forEach((entry, index) => {
          coloredCountries.push({
            ...entry,
            color: deriveCountryColor(entry.regionColor, entry.id, index, count),
          })
        })
      })

      const countryEntries = coloredCountries.map((entry) => {
        if (worldData) {
          const feature = findCountryFeatureForEntry(entry, worldData.features)
          if (feature) {
            countryFeatureColors.set(feature, entry.color)
            return { ...entry, shape: feature, hasWorldShape: true }
          }
        }

        // Fallback hotspot when country polygon data is unavailable.
        return {
          ...entry,
          shape: d3.geoCircle().center([entry.lon, entry.lat]).radius(TUNING.halo.fallbackCountryDegrees)(),
          hasWorldShape: false,
        }
      })

      const worldFeatureIndex = worldData ? buildWorldFeatureIndex(worldData.features) : null
      const regionEntries = seededRegions.map((entry) => {
        let geometry = d3.geoCircle().center([entry.lon, entry.lat]).radius(regionRadiusDegrees(entry))()

        if (worldFeatureIndex) {
          const regionGeometry = resolveRegionHaloGeometry(entry, countryEntries, worldFeatureIndex, worldData)
          if (regionGeometry) {
            geometry = regionGeometry
          }
        }

        return { ...entry, geometry }
      })

      const regionLinks = regionGroup
        .selectAll("a")
        .data(regionEntries, (entry) => entry.id)
        .enter()
        .append("a")
        .attr("class", (entry) => `ethno-globe-link region depth-${entry.depth}`)
        .attr("href", (entry) => entry.url)
        .attr("xlink:href", (entry) => entry.url)
        .attr("aria-label", (entry) => entry.title)
        .style("--ethno-region-fill", (entry) => toHsla(entry.color, TUNING.color.regionFillAlpha))
        .style("--ethno-region-stroke", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.regionStrokeAdjust.s, TUNING.color.regionStrokeAdjust.l),
            TUNING.color.regionStrokeAlpha,
          ),
        )
        .style("--ethno-region-fill-hover", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.regionFillHoverAdjust.s, TUNING.color.regionFillHoverAdjust.l),
            TUNING.color.regionFillHoverAlpha,
          ),
        )
        .style("--ethno-region-stroke-hover", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.regionStrokeHoverAdjust.s, TUNING.color.regionStrokeHoverAdjust.l),
            TUNING.color.regionStrokeHoverAlpha,
          ),
        )
        .style("--ethno-region-hit-fill", (entry) => toHsla(entry.color, Math.max(0.005, TUNING.color.regionFillAlpha * 0.3)))
        .style("--ethno-region-hit-fill-hover", (entry) => toHsla(entry.color, Math.max(0.01, TUNING.color.regionFillHoverAlpha * 0.42)))
        .style("--ethno-region-glow", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.regionStrokeHoverAdjust.s, TUNING.color.regionStrokeHoverAdjust.l),
            Math.min(0.28, TUNING.color.regionStrokeHoverAlpha),
          ),
        )
        .on("click", (event, entry) => navigateTo(event, entry.url))
        .on("pointerenter", (_, entry) => setHint(entry.title))
        .on("pointerleave", () => setHint(""))
        .on("focus", (_, entry) => setHint(entry.title))
        .on("blur", () => setHint(""))

      regionLinks.append("path").attr("class", "ethno-globe-region-halo")
      regionLinks.append("path").attr("class", "ethno-globe-region-hit")

      const countryLinks = countryGroup
        .selectAll("a")
        .data(countryEntries, (entry) => entry.id)
        .enter()
        .append("a")
        .attr("class", (entry) => `ethno-globe-link country depth-${entry.depth}`)
        .attr("href", (entry) => entry.url)
        .attr("xlink:href", (entry) => entry.url)
        .attr("aria-label", (entry) => entry.title)
        .style("--ethno-country-fill", (entry) => toHsla(entry.color, TUNING.color.countryFillAlpha))
        .style("--ethno-country-stroke", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.countryStrokeAdjust.s, TUNING.color.countryStrokeAdjust.l),
            TUNING.color.countryStrokeAlpha,
          ),
        )
        .style("--ethno-country-fill-hover", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.countryFillHoverAdjust.s, TUNING.color.countryFillHoverAdjust.l),
            TUNING.color.countryFillHoverAlpha,
          ),
        )
        .style("--ethno-country-stroke-hover", (entry) =>
          toHsla(
            adjustColor(entry.color, TUNING.color.countryStrokeHoverAdjust.s, TUNING.color.countryStrokeHoverAdjust.l),
            TUNING.color.countryStrokeHoverAlpha,
          ),
        )
        .on("click", (event, entry) => navigateTo(event, entry.url))
        .on("pointerenter", (_, entry) => setHint(entry.title))
        .on("pointerleave", () => setHint(""))
        .on("focus", (_, entry) => setHint(entry.title))
        .on("blur", () => setHint(""))

      countryLinks.append("path")

      const labelEntries = [...regionEntries, ...countryEntries]
      let width = 0
      let height = 0
      let baseScale = 1
      let zoomScale = 1
      let dragOrigin = null
      let dragRotate = null
      const applyScale = () => {
        projection.scale(baseScale * zoomScale)
      }

      const syncStageHeight = () => {
        // Overlay mode uses the full viewport height to avoid top/bottom clipping.
        if (isEthnoOverlayPage()) {
          stage.style.height = `${Math.max(TUNING.stage.minSizePx, window.innerHeight)}px`
          return
        }

        const rect = stage.getBoundingClientRect()
        const available = Math.floor(window.innerHeight - rect.top)
        if (available > TUNING.stage.minSizePx) {
          stage.style.height = `${available}px`
        }
      }

      const redraw = () => {
        spherePath.attr("d", path(sphere))
        if (countryPaths) {
          countryPaths
            .attr("d", (feature) => path(feature))
            .attr("fill", (feature) => {
              const color = countryFeatureColors.get(feature)
              return color ? toHsla(color, TUNING.color.mapCountryFillAlpha) : TUNING.color.fallbackMapCountryFill
            })
            .attr("stroke", (feature) => {
              const color = countryFeatureColors.get(feature)
              return color
                ? toHsla(adjustColor(color, 12, 16), TUNING.color.mapCountryStrokeAlpha)
                : TUNING.color.fallbackMapCountryStroke
            })
        }
        if (bordersPath && worldData) {
          bordersPath.attr("d", path(worldData.borders))
        }
        regionLinks.selectAll(".ethno-globe-region-halo").attr("d", (entry) => path(entry.geometry))
        regionLinks.selectAll(".ethno-globe-region-hit").attr("d", (entry) => path(entry.geometry))
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
        syncStageHeight()
        width = Math.max(TUNING.stage.minSizePx, Math.floor(stage.clientWidth || TUNING.stage.minSizePx))
        height = Math.max(TUNING.stage.minSizePx, Math.floor(stage.clientHeight || TUNING.stage.minSizePx))
        baseScale = Math.max(
          TUNING.projection.minBaseScalePx,
          Math.min(width, height) * TUNING.projection.baseScaleFactor + TUNING.projection.baseScaleOffset,
        )

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
          dragOrigin = [event.x, event.y]
          dragRotate = projection.rotate()
        })
        .on("drag", (event) => {
          if (!dragOrigin || !dragRotate) return

          const sensitivity = TUNING.drag.sensitivity / zoomScale
          const dx = event.x - dragOrigin[0]
          const dy = event.y - dragOrigin[1]
          const lambda = dragRotate[0] + dx * sensitivity
          const phi = clamp(dragRotate[1] - dy * sensitivity, TUNING.drag.minLatitude, TUNING.drag.maxLatitude)
          projection.rotate([lambda, phi, dragRotate[2] || 0])
          redraw()
        })
        .on("end", () => {
          stage.classList.remove("is-dragging")
          dragOrigin = null
          dragRotate = null
        })

      svg.call(dragBehavior)

      stage.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault()
          const nextScale = zoomScale * Math.exp(-event.deltaY * TUNING.zoom.wheelSensitivity)
          zoomScale = clamp(nextScale, TUNING.zoom.min, TUNING.zoom.max)
          applyScale()
          redraw()
        },
        { passive: false },
      )

      const resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(stage)
      const onWindowResize = () => resize()
      window.addEventListener("resize", onWindowResize, { passive: true })

      rootStates.set(root, {
        resizeObserver,
        onWindowResize,
      })

      resize()
      root.dataset.ethnoGlobeReady = "true"
    } catch (error) {
      root.dataset.ethnoGlobeReady = "error"
      showError(stage, "Could not initialize globe.")
      console.error("[ethno-globe]", error)
    }
  }

  // === Page Integration (SPA + full reload) ===
  const initAll = () => {
    const roots = Array.from(document.querySelectorAll(ETHNO_ROOT_SELECTOR))
    const activeRoots = new Set(roots)
    const hasGlobeRoot = roots.length > 0

    if (document.body) {
      document.body.classList.toggle(ETHNO_ACTIVE_CLASS, hasGlobeRoot)
      document.body.classList.toggle(ETHNO_STATIC_CLASS, hasGlobeRoot)
    }

    for (const knownRoot of rootStates.keys()) {
      if (!activeRoots.has(knownRoot) || !knownRoot.isConnected) {
        teardownRoot(knownRoot)
      }
    }

    roots.forEach((root) => {
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
