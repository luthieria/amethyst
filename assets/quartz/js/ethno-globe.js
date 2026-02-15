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
    performance: {
      idleRestoreDelayMs: 220,
      interactionPrecision: 0.55,
      idlePrecision: 0.2,
      useLowResDuringInteraction: true,
      showMicrostates: false,
      microstatesDuringInteraction: false,
      microstatesMinZoom: 0.9,
      maxMicrostateMarkers: 160,
    },
    motion: {
      dragLerp: 0.34,
      dragLerpActive: 0.8,
      zoomLerp: 0.28,
      zoomLerpActive: 0.38,
      maxDtMs: 40,
      settleEpsilonDeg: 0.014,
      settleEpsilonZoom: 0.0012,
    },
    inertia: {
      enabled: true,
      decayPer60fps: 0.978,
      minVelocityDegPerMs: 0.0022,
      maxVelocityDegPerMs: 0.18,
      sampleWindowMs: 170,
      clickSuppressDistancePx: 6,
      clickSuppressMs: 120,
    },
    territoryIslands: {
      enabled: true,
      deferMs: 24,
      idleTimeoutMs: 900,
      maxRenderedFeatures: 140,
    },
    zoom: {
      min: 0.72,
      max: 2.45,
      wheelSensitivity: 0.0012,
      maxWheelStepPx: 110,
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
    microstates: {
      geoAreaThreshold: 0.00022,
      markerRadiusPx: 1.95,
      markerRadiusHoverPx: 2.4,
      fillAlpha: 0.62,
      strokeAlpha: 0.9,
      glowAlpha: 0.44,
      color: { h: 204, s: 38, l: 92 },
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
  const WORLD_TOPO_URLS = {
    high: ["/data/countries-50m.json", "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"],
    low: ["/data/countries-110m.json", "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"],
  }
  const TERRITORY_MAP_UNITS_URLS = [
    "/data/territories-map-units-10m.geojson",
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson",
  ]
  const TERRITORY_NAME_FIELDS = ["NAME", "NAME_LONG", "BRK_NAME", "ADMIN", "GEOUNIT", "SUBUNIT", "FORMAL_EN", "ABBREV"]
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
    "dem rep congo": "dem rep congo",
    "democratic republic of the congo": "dem rep congo",
    "central african republic": "central african rep",
    "central african rep": "central african rep",
    car: "central african rep",
    "south sudan": "s sudan",
    "s sudan": "s sudan",
    "equatorial guinea": "eq guinea",
    "eq guinea": "eq guinea",
    swaziland: "eswatini",
    "cote d ivoire": "cote divoire",
    "ivory coast": "cote divoire",
    "cabo verde": "cape verde",
    "sao tome and principe": "sao tome and principe",
    "dominican republic": "dominican rep",
    "united states": "united states of america",
    "saint vincent and the grenadines": "st vin and gren",
    "st vincent and the grenadines": "st vin and gren",
    "st vin and the grenadines": "st vin and gren",
    "saint kitts and nevis": "st kitts and nevis",
  }

  // === Shared State ===
  const rootStates = new Map()
  let dependencyPromise = null
  const worldDataPromises = {
    high: null,
    low: null,
  }
  let territoryDataPromise = null

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

  const buildWorldData = (topology) => {
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
    const coastline = window.topojson.merge(
      topology,
      Array.isArray(countriesObject.geometries) ? countriesObject.geometries : [],
    )
    const featureIndex = buildWorldFeatureIndex(features)

    return { topology, features, borders, coastline, geometryById, featureIndex }
  }

  const loadWorldData = async (resolution = "high") => {
    const key = resolution === "low" ? "low" : "high"
    if (!worldDataPromises[key]) {
      worldDataPromises[key] = (async () => {
        try {
          const topology = await fetchFirstJson(WORLD_TOPO_URLS[key] || WORLD_TOPO_URLS.high)
          return buildWorldData(topology)
        } catch (error) {
          console.warn(`[ethno-globe] ${key} country geometry unavailable; using fallback.`, error)
          return null
        }
      })()
    }

    return worldDataPromises[key]
  }

  const featureNameCandidates = (feature) => {
    const properties = feature?.properties || {}
    return [
      properties.name,
      ...TERRITORY_NAME_FIELDS.map((field) => properties[field]),
      properties.NAME_EN,
      properties.NAME_SORT,
      properties.WIKIDATAID,
    ]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim())
  }

  const buildFeatureKey = (feature, fallback = "") => {
    const id = String(feature?.id || "").trim()
    if (id) return id
    const firstName = featureNameCandidates(feature)[0]
    if (firstName) return canonicalCountryName(firstName)
    return fallback
  }

  const buildWorldFeatureIndex = (features) => {
    const byId = new Map()
    const byName = new Map()
    const byNameAll = new Map()

    const addByName = (name, feature) => {
      if (!name) return
      if (!byName.has(name)) {
        byName.set(name, feature)
      }
      const bucket = byNameAll.get(name) || []
      const key = buildFeatureKey(feature)
      if (!bucket.some((item) => buildFeatureKey(item) === key)) {
        bucket.push(feature)
        byNameAll.set(name, bucket)
      }
    }

    features.forEach((feature, index) => {
      const featureKey = buildFeatureKey(feature, `feature-${index}`)
      if (featureKey && !byId.has(featureKey)) {
        byId.set(featureKey, feature)
      }

      const names = featureNameCandidates(feature).map((name) => canonicalCountryName(name)).filter(Boolean)
      names.forEach((name) => addByName(name, feature))
    })

    return { byId, byName, byNameAll }
  }

  const mergeFeatureIndexes = (...indexes) => {
    const byId = new Map()
    const byName = new Map()
    const byNameAll = new Map()

    const addFeature = (feature) => {
      const featureKey = buildFeatureKey(feature)
      if (featureKey && !byId.has(featureKey)) {
        byId.set(featureKey, feature)
      }
    }

    const addByName = (name, feature) => {
      if (!name) return
      if (!byName.has(name)) {
        byName.set(name, feature)
      }
      const bucket = byNameAll.get(name) || []
      const key = buildFeatureKey(feature)
      if (!bucket.some((item) => buildFeatureKey(item) === key)) {
        bucket.push(feature)
        byNameAll.set(name, bucket)
      }
    }

    indexes.forEach((index) => {
      if (!index) return
      ;(index.byId || new Map()).forEach((feature) => addFeature(feature))
      ;(index.byNameAll || new Map()).forEach((features, name) => {
        features.forEach((feature) => addByName(name, feature))
      })
      ;(index.byName || new Map()).forEach((feature, name) => addByName(name, feature))
    })

    return { byId, byName, byNameAll }
  }

  const loadTerritoryData = async () => {
    if (!territoryDataPromise) {
      territoryDataPromise = (async () => {
        try {
          const geojson = await fetchFirstJson(TERRITORY_MAP_UNITS_URLS)
          const rawFeatures = Array.isArray(geojson?.features) ? geojson.features : []
          const usedIds = new Set()

          const features = rawFeatures
            .map((feature, index) => {
              if (!feature || !feature.geometry) return null
              const properties = feature.properties || {}
              const seed =
                String(
                  feature.id ||
                    properties.GU_A3 ||
                    properties.SU_A3 ||
                    properties.BRK_A3 ||
                    properties.ADM0_A3 ||
                    properties.NAME ||
                    `territory-${index}`,
                ).trim() || `territory-${index}`

              let id = seed
              let suffix = 1
              while (usedIds.has(id)) {
                id = `${seed}-${suffix}`
                suffix += 1
              }
              usedIds.add(id)

              return {
                ...feature,
                id,
                __ethnoSupplemental: true,
              }
            })
            .filter(Boolean)

          return {
            features,
            featureIndex: buildWorldFeatureIndex(features),
          }
        } catch (error) {
          console.warn("[ethno-globe] Territory map-units unavailable; continuing without supplemental islands.", error)
          const emptyIndex = buildWorldFeatureIndex([])
          return { features: [], featureIndex: emptyIndex }
        }
      })()
    }

    return territoryDataPromise
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

  const resolveRegionHaloGeometry = (regionEntry, countryEntries, worldFeatureIndex, worldData) => {
    const features = []
    const seen = new Set()

    const pushFeature = (feature) => {
      if (!feature) return
      const key = buildFeatureKey(feature)
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

        const canonicalName = canonicalCountryName(country)
        const nameMatches = worldFeatureIndex.byNameAll?.get(canonicalName)
        if (Array.isArray(nameMatches) && nameMatches.length > 0) {
          nameMatches.forEach((feature) => pushFeature(feature))
          return
        }

        const nameMatch = worldFeatureIndex.byName.get(canonicalName)
        if (nameMatch) {
          pushFeature(nameMatch)
        }
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
      let containsSupplementalFeature = false

      features.forEach((feature) => {
        if (feature?.__ethnoSupplemental) {
          containsSupplementalFeature = true
          return
        }

        const id = String(feature?.id || "").trim()
        if (!id || seenGeometries.has(id)) return
        const geometry = worldData.geometryById.get(id)
        if (!geometry) {
          containsSupplementalFeature = true
          return
        }
        seenGeometries.add(id)
        geometries.push(geometry)
      })

      if (!containsSupplementalFeature && geometries.length > 0) {
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

    if (state.stage && typeof state.onWheel === "function") {
      state.stage.removeEventListener("wheel", state.onWheel)
    }
    if (state.stage && typeof state.onStageMouseLeave === "function") {
      state.stage.removeEventListener("mouseleave", state.onStageMouseLeave)
    }
    if (state.resizeObserver) {
      state.resizeObserver.disconnect()
    }
    if (typeof state.onWindowResize === "function") {
      window.removeEventListener("resize", state.onWindowResize)
    }
    if (typeof state.clearIdleTimer === "function") {
      state.clearIdleTimer()
    }
    if (typeof state.cancelQueuedRedraw === "function") {
      state.cancelQueuedRedraw()
    }
    if (typeof state.cancelMotionFrame === "function") {
      state.cancelMotionFrame()
    }
    if (typeof state.cancelTerritoryLoad === "function") {
      state.cancelTerritoryLoad()
    }
    if (state.stage) {
      state.stage.classList.remove("is-dragging", "is-interacting")
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
      let overlayWorldData = await loadWorldData("low")
      if (!overlayWorldData) {
        overlayWorldData = await loadWorldData("high")
      }
      if (!overlayWorldData) {
        throw new Error("No world topology could be loaded.")
      }

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

      const onStageMouseLeave = () => setHint("")
      stage.addEventListener("mouseleave", onStageMouseLeave)
      let suppressClickUntil = 0
      const shouldSuppressClickNavigation = () => Date.now() < suppressClickUntil

      const viewport = svg.append("g").attr("class", "ethno-globe-viewport")
      const spherePath = viewport.append("path").attr("class", "ethno-globe-sphere")
      const countriesGroup = viewport.append("g").attr("class", "ethno-globe-countries")
      let countryPaths = null
      const bordersPath = viewport.append("path").attr("class", "ethno-globe-borders")
      const coastlinePath = viewport.append("path").attr("class", "ethno-globe-coastline")
      const territoryIslandsGroup = viewport.append("g").attr("class", "ethno-globe-territory-islands")
      let territoryIslandPaths = null
      let territoryIslandFeatures = []
      const microstateGroup = viewport.append("g").attr("class", "ethno-globe-microstates")
      microstateGroup
        .style("--ethno-micro-fill", toHsla(TUNING.microstates.color, TUNING.microstates.fillAlpha))
        .style("--ethno-micro-stroke", toHsla(TUNING.microstates.color, TUNING.microstates.strokeAlpha))
        .style("--ethno-micro-glow", toHsla(TUNING.microstates.color, TUNING.microstates.glowAlpha))
      const interactionGroup = viewport.append("g").attr("class", "ethno-globe-interactions")
      const regionGroup = interactionGroup.append("g").attr("class", "ethno-globe-region-links")
      const countryGroup = interactionGroup.append("g").attr("class", "ethno-globe-country-links")
      const labelsGroup = viewport.append("g").attr("class", "ethno-globe-labels")

      const projection = d3
        .geoOrthographic()
        .precision(TUNING.performance.idlePrecision || TUNING.projection.precision)
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

      const countryColorById = new Map()
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
        if (overlayWorldData) {
          const feature = findCountryFeatureForEntry(entry, overlayWorldData.features)
          if (feature) {
            const featureId = String(feature?.id || "").trim()
            if (featureId) {
              countryColorById.set(featureId, entry.color)
            }
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

      const microstateSource = overlayWorldData
      const microstateCandidates =
        TUNING.performance.showMicrostates && microstateSource
          ? microstateSource.features
              .map((feature, index) => ({
                id: String(feature?.id || feature?.properties?.name || `micro-${index}`),
                centroid: d3.geoCentroid(feature),
                area: d3.geoArea(feature),
              }))
              .filter(
                (entry) =>
                  entry.area <= TUNING.microstates.geoAreaThreshold &&
                  Array.isArray(entry.centroid) &&
                  entry.centroid.length === 2 &&
                  Number.isFinite(entry.centroid[0]) &&
                  Number.isFinite(entry.centroid[1]),
              )
              .sort((a, b) => a.area - b.area || String(a.id).localeCompare(String(b.id)))
          : []

      const baseWorldFeatureIndex = overlayWorldData.featureIndex || buildWorldFeatureIndex(overlayWorldData.features)
      let combinedWorldFeatureIndex = baseWorldFeatureIndex
      const regionEntries = seededRegions.map((entry) => ({
        ...entry,
        geometry: d3.geoCircle().center([entry.lon, entry.lat]).radius(regionRadiusDegrees(entry))(),
      }))

      const recomputeRegionGeometries = () => {
        regionEntries.forEach((entry) => {
          let geometry = d3.geoCircle().center([entry.lon, entry.lat]).radius(regionRadiusDegrees(entry))()
          if (combinedWorldFeatureIndex) {
            const resolvedGeometry = resolveRegionHaloGeometry(entry, countryEntries, combinedWorldFeatureIndex, overlayWorldData)
            if (resolvedGeometry) {
              geometry = resolvedGeometry
            }
          }
          entry.geometry = geometry
        })
      }

      recomputeRegionGeometries()
      const referencedHaloNames = new Set()
      seededRegions.forEach((entry) => {
        ;(entry.haloCountries || []).forEach((countryName) => {
          const canonicalName = canonicalCountryName(countryName)
          if (canonicalName) {
            referencedHaloNames.add(canonicalName)
          }
        })
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
        .attr("data-entry-id", (entry) => entry.id)
        .attr("data-entry-kind", () => "region")
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
        .on("click", (event, entry) => {
          if (shouldSuppressClickNavigation()) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          navigateTo(event, entry.url)
        })
        .on("pointerenter", (_, entry) => setActiveEntry(entry, "region-pointerenter"))
        .on("pointerleave", () => setActiveEntry("", "region-pointerleave"))
        .on("focus", (_, entry) => setActiveEntry(entry, "region-focus"))
        .on("blur", () => setActiveEntry("", "region-blur"))

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
        .attr("data-entry-id", (entry) => entry.id)
        .attr("data-entry-kind", () => "country")
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
        .on("click", (event, entry) => {
          if (shouldSuppressClickNavigation()) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          navigateTo(event, entry.url)
        })
        .on("pointerenter", (_, entry) => setActiveEntry(entry, "country-pointerenter"))
        .on("pointerleave", () => setActiveEntry("", "country-pointerleave"))
        .on("focus", (_, entry) => setActiveEntry(entry, "country-focus"))
        .on("blur", () => setActiveEntry("", "country-blur"))

      countryLinks.append("path")

      const labelEntries = [...regionEntries, ...countryEntries]
      const entryById = new Map(labelEntries.map((entry) => [entry.id, entry]))
      const labelTextAnchor = (entry) => (entry.dx > 8 ? "start" : entry.dx < -8 ? "end" : "middle")
      let labelLinks = labelsGroup.selectAll("a.ethno-globe-label-link")
      let activeEntryId = ""

      const syncActiveClasses = () => {
        const isActive = (entry) => !!activeEntryId && entry?.id === activeEntryId
        regionLinks.classed("is-linked-hover", (entry) => isActive(entry))
        countryLinks.classed("is-linked-hover", (entry) => isActive(entry))
        labelLinks.classed("is-linked-hover", (entry) => isActive(entry))
      }

      const setActiveEntry = (entryOrId, _source = "") => {
        let nextEntry = null
        if (entryOrId && typeof entryOrId === "object") {
          nextEntry = entryOrId
        } else if (typeof entryOrId === "string") {
          const key = entryOrId.trim()
          if (key) {
            nextEntry = entryById.get(key) || null
          }
        }

        activeEntryId = nextEntry?.id || ""
        setHint(nextEntry?.title || "")
        syncActiveClasses()
      }

      const syncLabelChipGeometry = (node, entry) => {
        if (!node) return

        const link = d3.select(node)
        const labelText = link
          .select("text")
          .attr("class", (datum) => `depth-${datum.depth}`)
          .attr("text-anchor", (datum) => labelTextAnchor(datum))
          .attr("dominant-baseline", "middle")
          .attr("x", 0)
          .attr("y", 0)
          .text((datum) => datum.title)

        const textNode = labelText.node()
        if (!textNode || typeof textNode.getBBox !== "function") return
        const computedFontSize =
          typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(textNode).fontSize : ""
        const key = `${entry.title}|${entry.depth}|${labelTextAnchor(entry)}|${computedFontSize}`
        if (node.__ethnoLabelChipKey === key) return
        node.__ethnoLabelChipKey = key

        let bounds
        try {
          bounds = textNode.getBBox()
        } catch (_) {
          return
        }

        const padX = 12
        const padY = 6
        const cornerRadius = 10
        link
          .select("rect")
          .attr("x", bounds.x - padX)
          .attr("y", bounds.y - padY)
          .attr("width", Math.max(0, bounds.width + padX * 2))
          .attr("height", Math.max(0, bounds.height + padY * 2))
          .attr("rx", cornerRadius)
          .attr("ry", cornerRadius)
      }

      let width = 0
      let height = 0
      let baseScale = 1
      let zoomScale = 1
      let zoomTarget = 1
      let isInteracting = false
      let idleTimer = null
      let redrawFrame = 0
      let motionFrame = 0
      let lastMotionTs = 0
      let microstatesVisible = false
      let activeWorldData = overlayWorldData
      let dragOrigin = null
      let dragRotateStart = null
      let dragDistancePx = 0
      let isDragging = false
      let isInertiaActive = false
      let angularVelocity = { lambda: 0, phi: 0 }
      const dragSamples = []
      const initialRotate = projection.rotate()
      let rotationCurrent = [
        initialRotate[0] || 0,
        clamp(initialRotate[1] || 0, TUNING.drag.minLatitude, TUNING.drag.maxLatitude),
        initialRotate[2] || 0,
      ]
      let rotationTarget = rotationCurrent.slice()
      const applyScale = () => {
        projection.scale(baseScale * zoomScale)
      }

      const clearIdleTimer = () => {
        if (!idleTimer) return
        window.clearTimeout(idleTimer)
        idleTimer = null
      }

      const cancelQueuedRedraw = () => {
        if (!redrawFrame) return
        window.cancelAnimationFrame(redrawFrame)
        redrawFrame = 0
      }

      const cancelMotionFrame = () => {
        if (!motionFrame) return
        window.cancelAnimationFrame(motionFrame)
        motionFrame = 0
      }

      const normalizeLongitude = (value) => {
        const normalized = ((value + 180) % 360 + 360) % 360 - 180
        return normalized === -180 ? 180 : normalized
      }

      const shortestAngularDelta = (from, to) => {
        let delta = to - from
        while (delta > 180) delta -= 360
        while (delta < -180) delta += 360
        return delta
      }

      const clearDragSamples = () => {
        dragSamples.length = 0
      }

      const pushDragSample = (timestamp) => {
        dragSamples.push({
          t: timestamp,
          lambda: rotationTarget[0],
          phi: rotationTarget[1],
        })
        const windowStart = timestamp - Math.max(40, TUNING.inertia.sampleWindowMs * 2)
        while (dragSamples.length > 0 && dragSamples[0].t < windowStart) {
          dragSamples.shift()
        }
      }

      const stopInertia = () => {
        isInertiaActive = false
        angularVelocity = { lambda: 0, phi: 0 }
      }

      const computeReleaseVelocityFromSamples = () => {
        if (dragSamples.length < 2) return { lambda: 0, phi: 0 }
        const latest = dragSamples[dragSamples.length - 1]
        const cutoff = latest.t - Math.max(20, TUNING.inertia.sampleWindowMs)
        const windowed = dragSamples.filter((sample) => sample.t >= cutoff)
        if (windowed.length < 2) return { lambda: 0, phi: 0 }

        const first = windowed[0]
        const last = windowed[windowed.length - 1]
        const dt = Math.max(1, last.t - first.t)
        const lambdaPerMs = shortestAngularDelta(first.lambda, last.lambda) / dt
        const phiPerMs = (last.phi - first.phi) / dt
        const maxVelocity = Math.max(TUNING.inertia.minVelocityDegPerMs, TUNING.inertia.maxVelocityDegPerMs)

        return {
          lambda: clamp(lambdaPerMs, -maxVelocity, maxVelocity),
          phi: clamp(phiPerMs, -maxVelocity, maxVelocity),
        }
      }

      const fillForFeature = (feature) => {
        const featureId = String(feature?.id || "").trim()
        const color = featureId ? countryColorById.get(featureId) : null
        return color ? toHsla(color, TUNING.color.mapCountryFillAlpha) : TUNING.color.fallbackMapCountryFill
      }

      const strokeForFeature = (feature) => {
        const featureId = String(feature?.id || "").trim()
        const color = featureId ? countryColorById.get(featureId) : null
        return color
          ? toHsla(adjustColor(color, 12, 16), TUNING.color.mapCountryStrokeAlpha)
          : TUNING.color.fallbackMapCountryStroke
      }

      const bindActiveWorldData = () => {
        const features = activeWorldData?.features || []
        countryPaths = countriesGroup
          .selectAll("path")
          .data(features, (feature, index) => {
            const id = String(feature?.id || "").trim()
            return id || `feature-${index}`
          })
          .join(
            (enter) => enter.append("path").attr("class", "ethno-globe-country"),
            (update) => update,
            (exit) => exit.remove(),
          )
          .attr("fill", (feature) => fillForFeature(feature))
          .attr("stroke", (feature) => strokeForFeature(feature))
      }

      const bindTerritoryIslandFeatures = () => {
        territoryIslandPaths = territoryIslandsGroup
          .selectAll("path")
          .data(territoryIslandFeatures, (feature, index) => buildFeatureKey(feature, `territory-${index}`))
          .join(
            (enter) => enter.append("path").attr("class", "ethno-globe-territory-island"),
            (update) => update,
            (exit) => exit.remove(),
          )
      }

      const setActiveWorldData = (nextWorldData) => {
        const normalizedNext = nextWorldData || null
        if (activeWorldData === normalizedNext) return
        activeWorldData = normalizedNext
        bindActiveWorldData()
      }

      const loadReferencedTerritoryIslands = async () => {
        if (!TUNING.territoryIslands.enabled) return
        if (referencedHaloNames.size === 0) return

        const territoryData = await loadTerritoryData()
        if (!root.isConnected) return
        if (!territoryData || !Array.isArray(territoryData.features) || territoryData.features.length === 0) return

        const matchedFeatures = territoryData.features.filter((feature) => {
          const matchedNames = featureNameCandidates(feature)
            .map((value) => canonicalCountryName(value))
            .filter((name) => referencedHaloNames.has(name))
          if (matchedNames.length === 0) return false

          return matchedNames.some((name) => !baseWorldFeatureIndex.byName.has(name))
        })

        if (matchedFeatures.length === 0) return

        const maxRenderedFeatures = Math.max(0, Math.floor(TUNING.territoryIslands.maxRenderedFeatures || 0))
        territoryIslandFeatures =
          maxRenderedFeatures > 0 ? matchedFeatures.slice(0, maxRenderedFeatures) : matchedFeatures.slice()

        bindTerritoryIslandFeatures()

        const supplementalIndex = buildWorldFeatureIndex(territoryIslandFeatures)
        combinedWorldFeatureIndex = mergeFeatureIndexes(baseWorldFeatureIndex, supplementalIndex)

        let countryShapesUpdated = false
        countryEntries.forEach((entry) => {
          if (entry.hasWorldShape) return
          const match = findCountryFeatureForEntry(entry, territoryIslandFeatures)
          if (!match) return

          entry.shape = match
          entry.hasWorldShape = true
          const featureId = String(match?.id || "").trim()
          if (featureId) {
            countryColorById.set(featureId, entry.color)
          }
          countryShapesUpdated = true
        })

        if (countryShapesUpdated) {
          countryLinks.select("path").attr("d", (entry) => path(entry.shape))
        }

        recomputeRegionGeometries()
        requestRedraw()
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

      const requestRedraw = () => {
        if (redrawFrame) return
        redrawFrame = window.requestAnimationFrame(() => {
          redrawFrame = 0
          redraw()
        })
      }

      const redraw = () => {
        spherePath.attr("d", path(sphere))
        if (countryPaths) {
          countryPaths.attr("d", (feature) => path(feature))
        }
        if (territoryIslandPaths) {
          territoryIslandPaths.attr("d", (feature) => path(feature))
        }
        if (bordersPath && activeWorldData?.borders) {
          bordersPath.attr("d", path(activeWorldData.borders))
        } else if (bordersPath) {
          bordersPath.attr("d", null)
        }
        if (coastlinePath && activeWorldData?.coastline) {
          coastlinePath.attr("d", path(activeWorldData.coastline))
        } else if (coastlinePath) {
          coastlinePath.attr("d", null)
        }
        regionLinks.selectAll(".ethno-globe-region-halo").attr("d", (entry) => path(entry.geometry))
        regionLinks.selectAll(".ethno-globe-region-hit").attr("d", (entry) => path(entry.geometry))
        countryLinks.select("path").attr("d", (entry) => path(entry.shape))

        const shouldRenderMicrostates =
          TUNING.performance.showMicrostates &&
          microstateCandidates.length > 0 &&
          (TUNING.performance.microstatesDuringInteraction || !isInteracting) &&
          zoomScale >= TUNING.performance.microstatesMinZoom

        if (!shouldRenderMicrostates) {
          if (microstatesVisible) {
            microstateGroup.style("display", "none")
            microstateGroup.selectAll("circle").remove()
            microstatesVisible = false
          }
        } else {
          microstateGroup.style("display", null)
          let visibleMicrostates = microstateCandidates
            .map((entry) => {
              if (!isPointVisible(projection, entry.centroid[0], entry.centroid[1])) return null
              const projected = projection(entry.centroid)
              if (!projected) return null

              return {
                id: entry.id,
                x: projected[0],
                y: projected[1],
              }
            })
            .filter(Boolean)

          const maxMicrostateMarkers = Math.max(0, Math.floor(TUNING.performance.maxMicrostateMarkers || 0))
          if (maxMicrostateMarkers > 0 && visibleMicrostates.length > maxMicrostateMarkers) {
            const stride = Math.ceil(visibleMicrostates.length / maxMicrostateMarkers)
            visibleMicrostates = visibleMicrostates.filter((_, index) => index % stride === 0).slice(0, maxMicrostateMarkers)
          }

          microstateGroup
            .selectAll("circle")
            .data(visibleMicrostates, (entry) => entry.id)
            .join(
              (enter) => enter.append("circle").attr("class", "ethno-globe-microstate"),
              (update) => update,
              (exit) => exit.remove(),
            )
            .attr("cx", (entry) => entry.x)
            .attr("cy", (entry) => entry.y)
            .attr("r", TUNING.microstates.markerRadiusPx)

          microstatesVisible = true
        }

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

        labelLinks = labelsGroup
          .selectAll("a.ethno-globe-label-link")
          .data(visibleLabels, (entry) => entry.id)
          .join(
            (enter) =>
              enter
                .append("a")
                .attr("class", "ethno-globe-label-link")
                .on("click", (event, entry) => {
                  if (shouldSuppressClickNavigation()) {
                    event.preventDefault()
                    event.stopPropagation()
                    return
                  }
                  navigateTo(event, entry.url)
                })
                .on("pointerenter", (_, entry) => setActiveEntry(entry, "label-pointerenter"))
                .on("pointerleave", () => setActiveEntry("", "label-pointerleave"))
                .on("focus", (_, entry) => setActiveEntry(entry, "label-focus"))
                .on("blur", () => setActiveEntry("", "label-blur"))
                .call((selection) => {
                  selection.append("rect").attr("class", "ethno-globe-label-chip")
                  selection.append("text")
                }),
            (update) => update,
            (exit) => exit.remove(),
          )
          .attr("href", (entry) => entry.url)
          .attr("xlink:href", (entry) => entry.url)
          .attr("aria-label", (entry) => entry.title)
          .attr("data-entry-id", (entry) => entry.id)
          .attr("data-entry-kind", (entry) => entry.kind)
          .style("--ethno-label-accent", (entry) =>
            toHsla(adjustColor(entry.color, TUNING.color.countryStrokeHoverAdjust.s, TUNING.color.countryStrokeHoverAdjust.l), 0.96),
          )
          .style("--ethno-label-chip-glow", (entry) =>
            toHsla(adjustColor(entry.color, TUNING.color.countryStrokeHoverAdjust.s, TUNING.color.countryStrokeHoverAdjust.l), 0.24),
          )

        labelLinks.attr("transform", (entry) => `translate(${entry.x},${entry.y})`).each(function (entry) {
          syncLabelChipGeometry(this, entry)
        })
        syncActiveClasses()
      }

      const applyInteractionMode = () => {
        projection.precision(isInteracting ? TUNING.performance.interactionPrecision : TUNING.performance.idlePrecision)
        stage.classList.toggle("is-interacting", isInteracting)
        // Keep original fast base globe (110m) in both idle and interaction.
        setActiveWorldData(overlayWorldData)
        requestRedraw()
      }

      const enterInteraction = () => {
        clearIdleTimer()
        if (!isInteracting) {
          isInteracting = true
          applyInteractionMode()
        } else {
          stage.classList.add("is-interacting")
        }
      }

      const scheduleIdleRestore = () => {
        clearIdleTimer()
        idleTimer = window.setTimeout(() => {
          idleTimer = null
          isInteracting = false
          applyInteractionMode()
        }, TUNING.performance.idleRestoreDelayMs)
      }

      const hasPendingRotation = () =>
        Math.abs(shortestAngularDelta(rotationCurrent[0], rotationTarget[0])) > TUNING.motion.settleEpsilonDeg ||
        Math.abs(rotationTarget[1] - rotationCurrent[1]) > TUNING.motion.settleEpsilonDeg

      const hasPendingZoom = () => Math.abs(zoomTarget - zoomScale) > TUNING.motion.settleEpsilonZoom

      const hasMotionWork = () => isDragging || isInertiaActive || hasPendingRotation() || hasPendingZoom()

      const stopMotionLoopIfIdle = () => {
        if (hasMotionWork()) return
        cancelMotionFrame()
        if (isInteracting) {
          scheduleIdleRestore()
        }
      }

      const startMotionLoop = () => {
        if (motionFrame) return
        lastMotionTs = performance.now()
        motionFrame = window.requestAnimationFrame(function stepMotion(now) {
          motionFrame = 0
          const rawDt = now - lastMotionTs
          const dt = Math.max(1, Math.min(TUNING.motion.maxDtMs, Number.isFinite(rawDt) ? rawDt : 16))
          const frameRatio = dt / (1000 / 60)
          lastMotionTs = now

          let changed = false

          if (isInertiaActive && !isDragging) {
            rotationTarget[0] = normalizeLongitude(rotationTarget[0] + angularVelocity.lambda * dt)
            rotationTarget[1] = clamp(
              rotationTarget[1] + angularVelocity.phi * dt,
              TUNING.drag.minLatitude,
              TUNING.drag.maxLatitude,
            )

            const decay = Math.pow(TUNING.inertia.decayPer60fps, frameRatio)
            angularVelocity.lambda *= decay
            angularVelocity.phi *= decay

            if (
              Math.abs(angularVelocity.lambda) < TUNING.inertia.minVelocityDegPerMs &&
              Math.abs(angularVelocity.phi) < TUNING.inertia.minVelocityDegPerMs
            ) {
              stopInertia()
            }
          }

          const dragLerpBase = isDragging ? TUNING.motion.dragLerpActive : TUNING.motion.dragLerp
          const dragLerp = clamp(dragLerpBase * frameRatio, 0, 1)
          const lambdaDelta = shortestAngularDelta(rotationCurrent[0], rotationTarget[0])
          const phiDelta = rotationTarget[1] - rotationCurrent[1]

          if (Math.abs(lambdaDelta) > TUNING.motion.settleEpsilonDeg) {
            rotationCurrent[0] = normalizeLongitude(rotationCurrent[0] + lambdaDelta * dragLerp)
            changed = true
          } else if (rotationCurrent[0] !== rotationTarget[0]) {
            rotationCurrent[0] = normalizeLongitude(rotationTarget[0])
            changed = true
          }

          if (Math.abs(phiDelta) > TUNING.motion.settleEpsilonDeg) {
            rotationCurrent[1] = clamp(
              rotationCurrent[1] + phiDelta * dragLerp,
              TUNING.drag.minLatitude,
              TUNING.drag.maxLatitude,
            )
            changed = true
          } else if (rotationCurrent[1] !== rotationTarget[1]) {
            rotationCurrent[1] = rotationTarget[1]
            changed = true
          }

          const zoomDelta = zoomTarget - zoomScale
          if (Math.abs(zoomDelta) > TUNING.motion.settleEpsilonZoom) {
            const zoomLerpBase = isInteracting ? TUNING.motion.zoomLerpActive : TUNING.motion.zoomLerp
            const zoomLerp = clamp(zoomLerpBase * frameRatio, 0, 1)
            zoomScale = clamp(zoomScale + zoomDelta * zoomLerp, TUNING.zoom.min, TUNING.zoom.max)
            changed = true
          } else if (zoomScale !== zoomTarget) {
            zoomScale = zoomTarget
            changed = true
          }

          if (changed) {
            projection.rotate([rotationCurrent[0], rotationCurrent[1], rotationCurrent[2] || 0])
            applyScale()
            requestRedraw()
          }

          if (hasMotionWork()) {
            startMotionLoop()
            return
          }

          stopMotionLoopIfIdle()
        })
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
        requestRedraw()
      }

      const dragBehavior = d3
        .drag()
        .on("start", (event) => {
          stage.classList.add("is-dragging")
          enterInteraction()
          stopInertia()
          isDragging = true
          dragOrigin = [event.x, event.y]
          dragRotateStart = rotationTarget.slice()
          dragDistancePx = 0
          clearDragSamples()
          pushDragSample(performance.now())
        })
        .on("drag", (event) => {
          if (!dragOrigin || !dragRotateStart) return
          const sensitivity = TUNING.drag.sensitivity / Math.max(TUNING.zoom.min, zoomTarget || zoomScale)
          const dx = event.x - dragOrigin[0]
          const dy = event.y - dragOrigin[1]
          const lambda = normalizeLongitude(dragRotateStart[0] + dx * sensitivity)
          const phi = clamp(dragRotateStart[1] - dy * sensitivity, TUNING.drag.minLatitude, TUNING.drag.maxLatitude)
          rotationTarget[0] = lambda
          rotationTarget[1] = phi
          // Apply light drag-time damping for a smoother, globe-like feel.
          const dragBlend = clamp(TUNING.motion.dragLerpActive, 0, 1)
          rotationCurrent[0] = normalizeLongitude(
            rotationCurrent[0] + shortestAngularDelta(rotationCurrent[0], lambda) * dragBlend,
          )
          rotationCurrent[1] = clamp(
            rotationCurrent[1] + (phi - rotationCurrent[1]) * dragBlend,
            TUNING.drag.minLatitude,
            TUNING.drag.maxLatitude,
          )
          projection.rotate([rotationCurrent[0], rotationCurrent[1], rotationCurrent[2] || 0])
          requestRedraw()
          dragDistancePx = Math.max(dragDistancePx, Math.hypot(dx, dy))
          pushDragSample(performance.now())
          startMotionLoop()
        })
        .on("end", () => {
          stage.classList.remove("is-dragging")
          isDragging = false
          if (dragDistancePx >= TUNING.inertia.clickSuppressDistancePx) {
            suppressClickUntil = Date.now() + TUNING.inertia.clickSuppressMs
          }

          if (TUNING.inertia.enabled) {
            const releaseVelocity = computeReleaseVelocityFromSamples()
            const minVelocity = TUNING.inertia.minVelocityDegPerMs
            const hasVelocity =
              Math.abs(releaseVelocity.lambda) >= minVelocity || Math.abs(releaseVelocity.phi) >= minVelocity
            if (hasVelocity) {
              angularVelocity = releaseVelocity
              isInertiaActive = true
            } else {
              stopInertia()
            }
          } else {
            stopInertia()
          }

          clearDragSamples()
          dragOrigin = null
          dragRotateStart = null
          if (isInertiaActive) {
            startMotionLoop()
          } else {
            stopMotionLoopIfIdle()
          }
        })

      svg.call(dragBehavior)

      const onWheel = (event) => {
        event.preventDefault()
        enterInteraction()
        stopInertia()
        const deltaModeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
        const wheelDeltaPx = clamp(
          event.deltaY * deltaModeScale,
          -TUNING.zoom.maxWheelStepPx,
          TUNING.zoom.maxWheelStepPx,
        )
        const nextScale = zoomTarget * Math.exp(-wheelDeltaPx * TUNING.zoom.wheelSensitivity)
        zoomTarget = clamp(nextScale, TUNING.zoom.min, TUNING.zoom.max)
        const zoomBlend = clamp(TUNING.motion.zoomLerpActive, 0, 1)
        zoomScale = clamp(zoomScale + (zoomTarget - zoomScale) * zoomBlend, TUNING.zoom.min, TUNING.zoom.max)
        applyScale()
        requestRedraw()
        startMotionLoop()
      }
      stage.addEventListener("wheel", onWheel, { passive: false })

      const resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(stage)
      const onWindowResize = () => resize()
      window.addEventListener("resize", onWindowResize, { passive: true })

      let territoryLoadTimer = null
      let territoryLoadIdleHandle = null
      const cancelTerritoryLoad = () => {
        if (territoryLoadTimer !== null) {
          window.clearTimeout(territoryLoadTimer)
          territoryLoadTimer = null
        }
        if (territoryLoadIdleHandle !== null && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(territoryLoadIdleHandle)
          territoryLoadIdleHandle = null
        }
      }

      const scheduleTerritoryLoad = () => {
        if (!TUNING.territoryIslands.enabled) return
        cancelTerritoryLoad()

        const runLoad = () => {
          territoryLoadTimer = null
          territoryLoadIdleHandle = null
          void loadReferencedTerritoryIslands()
        }

        if (typeof window.requestIdleCallback === "function") {
          territoryLoadIdleHandle = window.requestIdleCallback(runLoad, {
            timeout: TUNING.territoryIslands.idleTimeoutMs,
          })
        } else {
          territoryLoadTimer = window.setTimeout(runLoad, TUNING.territoryIslands.deferMs)
        }
      }

      bindActiveWorldData()
      applyInteractionMode()
      scheduleTerritoryLoad()

      rootStates.set(root, {
        stage,
        onWheel,
        onStageMouseLeave,
        clearIdleTimer,
        cancelQueuedRedraw,
        cancelMotionFrame,
        cancelTerritoryLoad,
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
