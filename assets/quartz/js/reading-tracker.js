;(function () {
  const ROOT_SELECTOR = "[data-reading-tracker]"
  const ROW_SELECTOR = ".rt-entry-row"
  const EDITABLE_SELECTOR = ".rt-editable[data-field]"
  const STATUS_SELECTOR = "#rt-export-status"

  const state = {
    root: null,
  }

  const toNumber = (value) => {
    const text = String(value ?? "").trim().replace(",", ".")
    if (!text) return null
    const num = Number(text)
    if (!Number.isFinite(num)) return null
    if (Number.isInteger(num)) return num
    return num
  }

  const normalizeFieldValue = (field, raw) => {
    const text = String(raw ?? "").replace(/\u00a0/g, " ").trim()
    if (field === "current") {
      const num = toNumber(text)
      return num === null ? "" : String(num)
    }
    return text
  }

  const readEditableValue = (editable) => normalizeFieldValue(editable.dataset.field, editable.textContent)

  const writeStatus = (text) => {
    const status = document.querySelector(STATUS_SELECTOR)
    if (status instanceof HTMLElement) {
      status.textContent = text
    }
  }

  const formatPercent = (value) => {
    const rounded = Math.round(value * 10) / 10
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
      return `${Math.round(rounded)}%`
    }
    return `${rounded.toFixed(1)}%`
  }

  const updateRowProgress = (row) => {
    const currentEditable = row.querySelector('.rt-editable[data-field="current"]')
    const totalCell = row.querySelector(".rt-total")
    const progress = row.querySelector("[data-progress]")
    const progressFill = progress ? progress.querySelector(".rt-progress-fill") : null
    const progressLabel = progress ? progress.querySelector(".rt-progress-label") : null

    const currentText =
      currentEditable instanceof HTMLElement ? readEditableValue(currentEditable) : row.dataset.current || ""
    const totalText = totalCell instanceof HTMLElement ? totalCell.textContent : row.dataset.total || ""

    const current = toNumber(currentText)
    const total = toNumber(totalText)
    row.dataset.current = current === null ? "" : String(current)
    row.dataset.total = total === null ? "" : String(total)

    let percent = 0
    if (current !== null && total !== null && total > 0) {
      percent = Math.max(0, Math.min(100, (current / total) * 100))
    }

    if (progressFill instanceof HTMLElement) {
      progressFill.style.width = `${percent}%`
    }
    if (progressLabel instanceof HTMLElement) {
      progressLabel.textContent = formatPercent(percent)
    }
    row.classList.toggle("rt-complete", total !== null && total > 0 && current !== null && current >= total)
  }

  const isRowReadBook = (row) => {
    if (row.dataset.isBook !== "true") return false
    const current = toNumber(row.dataset.current)
    const total = toNumber(row.dataset.total)
    return current !== null && total !== null && total > 0 && current >= total
  }

  const updateSummary = (root) => {
    const rows = [...root.querySelectorAll(ROW_SELECTOR)]
    const areaCounts = new Map()
    let totalRead = 0

    rows.forEach((row) => {
      const areaId = row.dataset.areaId || ""
      if (!areaId) return
      if (!areaCounts.has(areaId)) areaCounts.set(areaId, 0)
      if (isRowReadBook(row)) {
        totalRead += 1
        areaCounts.set(areaId, areaCounts.get(areaId) + 1)
      }
    })

    const totalNode = root.querySelector("#rt-total-read")
    if (totalNode instanceof HTMLElement) {
      totalNode.textContent = String(totalRead)
    }

    const summaryNodes = [...root.querySelectorAll("[data-area-summary]")]
    summaryNodes.forEach((node) => {
      const areaId = node.getAttribute("data-area-summary") || ""
      const count = areaCounts.get(areaId) || 0
      const countNode = node.querySelector(".rt-summary-area-count")
      if (countNode instanceof HTMLElement) {
        countNode.textContent = String(count)
      }
    })
  }

  const markDirtyState = (editable) => {
    const base = normalizeFieldValue(editable.dataset.field, editable.dataset.base || "")
    const current = readEditableValue(editable)
    editable.classList.toggle("rt-dirty", base !== current)
  }

  const refresh = (root) => {
    const rows = [...root.querySelectorAll(ROW_SELECTOR)]
    rows.forEach((row) => updateRowProgress(row))
    ;[...root.querySelectorAll(EDITABLE_SELECTOR)].forEach((editable) => markDirtyState(editable))
    updateSummary(root)
  }

  const scalarToYaml = (value) => {
    if (value === null || value === undefined) return "null"
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null"
    return JSON.stringify(String(value))
  }

  const collectOverrides = (root) => {
    const overrides = {}
    const rows = [...root.querySelectorAll(ROW_SELECTOR)]

    rows.forEach((row) => {
      const entryId = row.dataset.entryId
      if (!entryId) return

      const rowOverride = {}
      const editables = [...row.querySelectorAll(EDITABLE_SELECTOR)]
      editables.forEach((editable) => {
        const field = editable.dataset.field
        if (!field) return
        const base = normalizeFieldValue(field, editable.dataset.base || "")
        const current = readEditableValue(editable)
        if (base === current) return

        if (field === "current") {
          rowOverride[field] = current === "" ? null : toNumber(current)
        } else {
          rowOverride[field] = current === "" ? null : current
        }
      })

      if (Object.keys(rowOverride).length > 0) {
        overrides[entryId] = rowOverride
      }
    })

    return overrides
  }

  const overridesToYaml = (overrides) => {
    const ids = Object.keys(overrides).sort()
    if (ids.length === 0) {
      return "overrides: {}\n"
    }

    const lines = ["overrides:"]
    ids.forEach((id) => {
      lines.push(`  ${JSON.stringify(id)}:`)
      const fields = Object.keys(overrides[id]).sort()
      fields.forEach((field) => {
        lines.push(`    ${field}: ${scalarToYaml(overrides[id][field])}`)
      })
    })
    return `${lines.join("\n")}\n`
  }

  const copyText = async (text) => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text)
      return
    }
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "true")
    textarea.style.position = "fixed"
    textarea.style.top = "-1000px"
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "text/yaml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const bindEditable = (root, editable) => {
    editable.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        editable.blur()
      }
    })

    editable.addEventListener("paste", (event) => {
      event.preventDefault()
      const text = (event.clipboardData || window.clipboardData).getData("text")
      document.execCommand("insertText", false, text)
    })

    const onChange = () => {
      const row = editable.closest(ROW_SELECTOR)
      if (row instanceof HTMLElement) {
        updateRowProgress(row)
      }
      markDirtyState(editable)
      updateSummary(root)
      writeStatus("")
    }

    editable.addEventListener("input", onChange)
    editable.addEventListener("blur", () => {
      const normalized = readEditableValue(editable)
      editable.textContent = normalized
      onChange()
    })
  }

  const bindActions = (root) => {
    const copyButton = root.querySelector("#rt-copy-overrides")
    const downloadButton = root.querySelector("#rt-download-overrides")

    if (copyButton instanceof HTMLElement) {
      copyButton.addEventListener("click", async () => {
        try {
          const overrides = collectOverrides(root)
          const yaml = overridesToYaml(overrides)
          await copyText(yaml)
          writeStatus("Overrides copied to clipboard.")
        } catch (_) {
          writeStatus("Copy failed. Try Download Overrides YAML.")
        }
      })
    }

    if (downloadButton instanceof HTMLElement) {
      downloadButton.addEventListener("click", () => {
        const overrides = collectOverrides(root)
        const yaml = overridesToYaml(overrides)
        downloadText("reading_tracker_overrides.yaml", yaml)
        writeStatus("Overrides YAML downloaded.")
      })
    }
  }

  const init = () => {
    const root = document.querySelector(ROOT_SELECTOR)
    if (!(root instanceof HTMLElement)) {
      return
    }

    if (state.root === root) {
      refresh(root)
      return
    }

    ;[...root.querySelectorAll(EDITABLE_SELECTOR)].forEach((editable) => bindEditable(root, editable))
    bindActions(root)
    refresh(root)
    state.root = root
  }

  window.initReadingTracker = init
})()
