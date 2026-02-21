import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROOT_SELECTOR = "[data-reading-analytics]"
const HOT_LICENSE = "non-commercial-and-evaluation"
const FORMULA_SOURCE = "formula-seed"

const COL = {
  ID: 0,
  TITLE: 1,
  AUTHOR: 2,
  YEAR_PUBLISHED: 3,
  PAGES: 4,
  PAGES_READ: 5,
  START_DATE: 6,
  FINISH_DATE: 7,
  PERCENT_COMPLETE: 8,
  STATUS: 9,
  GENRE: 10,
  LANGUAGE: 11,
  FORMAT: 12,
  RATING: 13,
  NOTES: 14,
  YEAR_FINISHED: 15,
  MONTH_FINISHED: 16,
  REREAD: 17,
  ABANDONED: 18,
}

const state = {
  initialized: false,
  root: null,
  supabase: null,
  hot: null,
  ownerEmail: "",
  user: null,
  isOwner: false,
  dirty: false,
  loadedEntries: [],
  loadedEntriesById: new Map(),
  loadedEntryIds: new Set(),
  yearlyStats: [],
  yearlyGoalsByYear: new Map(),
}

const normalizeText = (value) => String(value ?? "").replace(/\u00a0/g, " ").trim()

const toInteger = (value) => {
  const text = normalizeText(value).replace(",", ".")
  if (!text) return null
  const num = Number(text)
  if (!Number.isFinite(num)) return null
  return Math.round(num)
}

const toDecimal = (value) => {
  const text = normalizeText(value).replace(",", ".")
  if (!text) return null
  const num = Number(text)
  if (!Number.isFinite(num)) return null
  return Math.round(num * 10) / 10
}

const toBoolean = (value) => {
  if (typeof value === "boolean") return value
  const text = normalizeText(value).toLowerCase()
  return text === "true" || text === "1" || text === "yes"
}

const toIsoDateOrNull = (value) => {
  const text = normalizeText(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const roundToOneDecimal = (value) => {
  if (!Number.isFinite(value)) return null
  return Math.round(value * 10) / 10
}

const serializeEntry = (entry) =>
  JSON.stringify({
    title: entry.title,
    author: entry.author,
    year_published: entry.year_published,
    pages: entry.pages,
    pages_read: entry.pages_read,
    start_date: entry.start_date,
    finish_date: entry.finish_date,
    genre: entry.genre,
    language: entry.language,
    format: entry.format,
    rating: entry.rating,
    notes: entry.notes,
    reread: entry.reread,
    abandoned: entry.abandoned,
  })

const percentFromFraction = (fraction) => {
  const num = Number(fraction)
  if (!Number.isFinite(num)) return ""
  const pct = num * 100
  const rounded = Math.round(pct * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

const formatError = (error) => {
  if (!error) return "Unknown error."
  if (typeof error === "string") return error
  if (typeof error.message === "string" && error.message) return error.message
  return JSON.stringify(error)
}

const formulaValuesForRow = (rowIndex) => {
  const row = rowIndex + 1
  return {
    percent: `=IF(E${row}>0,F${row}/E${row},0)`,
    status: `=IF(S${row}=TRUE,"Abandoned",IF(F${row}=0,"Not started",IF(F${row}<E${row},"Reading",IF(F${row}=E${row},"Finished","Overread"))))`,
    yearFinished: `=IF(H${row}<>"",YEAR(H${row}),"")`,
    monthFinished: `=IF(H${row}<>"",MONTH(H${row}),"")`,
  }
}

const entryFromDatabase = (row) => {
  const rating = toDecimal(row.rating)
  return {
    id: toInteger(row.id),
    title: normalizeText(row.title),
    author: normalizeText(row.author) || null,
    year_published: toInteger(row.year_published),
    pages: toInteger(row.pages),
    pages_read: toInteger(row.pages_read),
    start_date: toIsoDateOrNull(row.start_date),
    finish_date: toIsoDateOrNull(row.finish_date),
    genre: normalizeText(row.genre) || null,
    language: normalizeText(row.language) || null,
    format: normalizeText(row.format) || null,
    rating: rating === null ? null : Math.min(5, Math.max(0, rating)),
    notes: normalizeText(row.notes) || null,
    reread: Boolean(row.reread),
    abandoned: Boolean(row.abandoned),
  }
}

const hotRowFromEntry = (entry, rowIndex) => {
  const formulas = formulaValuesForRow(rowIndex)
  return [
    entry.id ?? null,
    entry.title || "",
    entry.author || "",
    entry.year_published ?? "",
    entry.pages ?? "",
    entry.pages_read ?? "",
    entry.start_date || "",
    entry.finish_date || "",
    formulas.percent,
    formulas.status,
    entry.genre || "",
    entry.language || "",
    entry.format || "",
    entry.rating ?? "",
    entry.notes || "",
    formulas.yearFinished,
    formulas.monthFinished,
    Boolean(entry.reread),
    Boolean(entry.abandoned),
  ]
}

const entryFromHotRow = (row) => {
  const rating = toDecimal(row[COL.RATING])
  return {
    id: toInteger(row[COL.ID]),
    title: normalizeText(row[COL.TITLE]),
    author: normalizeText(row[COL.AUTHOR]) || null,
    year_published: toInteger(row[COL.YEAR_PUBLISHED]),
    pages: toInteger(row[COL.PAGES]),
    pages_read: toInteger(row[COL.PAGES_READ]),
    start_date: toIsoDateOrNull(row[COL.START_DATE]),
    finish_date: toIsoDateOrNull(row[COL.FINISH_DATE]),
    genre: normalizeText(row[COL.GENRE]) || null,
    language: normalizeText(row[COL.LANGUAGE]) || null,
    format: normalizeText(row[COL.FORMAT]) || null,
    rating: rating === null ? null : Math.min(5, Math.max(0, rating)),
    notes: normalizeText(row[COL.NOTES]) || null,
    reread: toBoolean(row[COL.REREAD]),
    abandoned: toBoolean(row[COL.ABANDONED]),
  }
}

const isEntryBlank = (entry) =>
  !entry.title &&
  !entry.author &&
  entry.year_published === null &&
  entry.pages === null &&
  entry.pages_read === null &&
  !entry.start_date &&
  !entry.finish_date &&
  !entry.genre &&
  !entry.language &&
  !entry.format &&
  entry.rating === null &&
  !entry.notes &&
  !entry.reread &&
  !entry.abandoned

const query = (selector) => state.root.querySelector(selector)

const setStatus = (text, level = "info") => {
  const status = query("#ra-status")
  if (!status) return
  status.textContent = text
  status.dataset.level = level
}

const setDirty = (dirty) => {
  state.dirty = Boolean(dirty)
  const node = query("#ra-dirty-indicator")
  if (!node) return
  node.dataset.dirty = state.dirty ? "true" : "false"
  node.textContent = state.dirty ? "Unsaved changes" : "No unsaved changes"
}

const setToolbarEnabled = (enabled) => {
  const save = query("#ra-save")
  const add = query("#ra-add-row")
  const del = query("#ra-delete-row")
  const saveGoals = query("#ra-save-goals")
  if (save) save.disabled = !enabled
  if (add) add.disabled = !enabled
  if (del) del.disabled = !enabled
  if (saveGoals) saveGoals.disabled = !enabled
}

const applyAuthUI = () => {
  const loggedOut = query("[data-auth-logged-out]")
  const loggedIn = query("[data-auth-logged-in]")
  const userEmail = query("#ra-user-email")
  if (loggedOut) loggedOut.hidden = Boolean(state.user)
  if (loggedIn) loggedIn.hidden = !state.user
  if (userEmail) userEmail.textContent = state.user?.email || ""

  setToolbarEnabled(state.isOwner)
  if (state.hot) {
    state.hot.updateSettings({ readOnly: !state.isOwner })
  }
}

const isOwnerUser = (user) => {
  if (!user) return false
  if (!state.ownerEmail) return true
  return normalizeText(user.email).toLowerCase() === state.ownerEmail.toLowerCase()
}

const setSession = (user) => {
  state.user = user || null
  state.isOwner = isOwnerUser(state.user)
  applyAuthUI()
}

const percentRenderer = (instance, td, row, col, prop, value, cellProperties) => {
  Handsontable.renderers.TextRenderer(instance, td, row, col, prop, value, cellProperties)
  td.textContent = percentFromFraction(value)
}

const readOnlyNumberRenderer = (instance, td, row, col, prop, value, cellProperties) => {
  Handsontable.renderers.TextRenderer(instance, td, row, col, prop, value, cellProperties)
  const num = Number(value)
  td.textContent = Number.isFinite(num) ? String(Math.round(num)) : ""
}

const createHandsontable = () => {
  if (state.hot) return
  if (typeof window.Handsontable === "undefined") {
    throw new Error("Handsontable failed to load. Check CDN script availability.")
  }
  const container = query("#reading-analytics-sheet")
  if (!(container instanceof HTMLElement)) {
    throw new Error("Tracker container not found.")
  }
  const formulaSettings = window.HyperFormula ? { engine: window.HyperFormula } : true

  state.hot = new Handsontable(container, {
    data: [],
    rowHeaders: true,
    colHeaders: [
      "ID",
      "Title",
      "Author",
      "Year Published",
      "Pages",
      "Pages Read",
      "Start Date",
      "Finish Date",
      "% Complete",
      "Status",
      "Genre",
      "Language",
      "Format",
      "Rating",
      "Notes",
      "Year Finished",
      "Month Finished",
      "Re-read",
      "Abandoned",
    ],
    columns: [
      { type: "numeric", readOnly: true },
      { type: "text" },
      { type: "text" },
      { type: "numeric" },
      { type: "numeric" },
      { type: "numeric" },
      { type: "text" },
      { type: "text" },
      { readOnly: true, renderer: percentRenderer },
      { type: "text", readOnly: true },
      { type: "text" },
      { type: "text" },
      { type: "text" },
      { type: "numeric" },
      { type: "text" },
      { readOnly: true, renderer: readOnlyNumberRenderer },
      { readOnly: true, renderer: readOnlyNumberRenderer },
      { type: "checkbox" },
      { type: "checkbox" },
    ],
    formulas: formulaSettings,
    stretchH: "all",
    height: "auto",
    manualColumnResize: true,
    contextMenu: ["row_above", "row_below", "remove_row", "undo", "redo"],
    licenseKey: HOT_LICENSE,
    afterCreateRow(index, amount) {
      for (let i = 0; i < amount; i += 1) {
        const row = index + i
        const formulas = formulaValuesForRow(row)
        state.hot.setDataAtCell(row, COL.PERCENT_COMPLETE, formulas.percent, FORMULA_SOURCE)
        state.hot.setDataAtCell(row, COL.STATUS, formulas.status, FORMULA_SOURCE)
        state.hot.setDataAtCell(row, COL.YEAR_FINISHED, formulas.yearFinished, FORMULA_SOURCE)
        state.hot.setDataAtCell(row, COL.MONTH_FINISHED, formulas.monthFinished, FORMULA_SOURCE)
      }
    },
    afterChange(changes, source) {
      if (!changes || source === "loadData" || source === FORMULA_SOURCE) return
      setDirty(true)
      setStatus("Unsaved changes.", "warn")
    },
  })

  applyAuthUI()
}

const renderTableRows = (tbody, rows, mapper) => {
  tbody.textContent = ""
  if (!rows.length) {
    const empty = document.createElement("tr")
    const td = document.createElement("td")
    td.colSpan = 8
    td.textContent = "No data."
    empty.appendChild(td)
    tbody.appendChild(empty)
    return
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr")
    mapper(row).forEach((value) => {
      const td = document.createElement("td")
      td.textContent = value
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
}

const toMonthLabel = (month) => {
  const value = Number(month)
  if (!Number.isFinite(value) || value < 1 || value > 12) return "-"
  return String(value).padStart(2, "0")
}

const computeStatsFromEntries = (entries) => {
  const monthly = new Map()
  const yearly = new Map()

  entries.forEach((entry) => {
    if (!entry.finish_date) return
    const finish = toIsoDateOrNull(entry.finish_date)
    if (!finish) return
    const year = Number(finish.slice(0, 4))
    const month = Number(finish.slice(5, 7))
    const monthKey = `${year}-${month}`
    const yearKey = String(year)

    if (!monthly.has(monthKey)) {
      monthly.set(monthKey, {
        owner_user_id: null,
        year,
        month,
        books_finished: 0,
        pages_finished: 0,
        rereads_finished: 0,
        abandoned_count: 0,
        avg_rating: null,
        _ratings: [],
      })
    }
    if (!yearly.has(yearKey)) {
      yearly.set(yearKey, {
        owner_user_id: null,
        year,
        books_finished: 0,
        pages_finished: 0,
        rereads_finished: 0,
        abandoned_count: 0,
        avg_rating: null,
        target_books: 0,
        target_pages: 0,
        _ratings: [],
      })
    }

    const m = monthly.get(monthKey)
    const y = yearly.get(yearKey)
    const finished = !entry.abandoned

    if (finished) {
      m.books_finished += 1
      y.books_finished += 1
      m.pages_finished += entry.pages_read || 0
      y.pages_finished += entry.pages_read || 0
    }

    if (entry.reread && finished) {
      m.rereads_finished += 1
      y.rereads_finished += 1
    }

    if (entry.abandoned) {
      m.abandoned_count += 1
      y.abandoned_count += 1
    }

    if (entry.rating !== null && Number.isFinite(Number(entry.rating))) {
      m._ratings.push(Number(entry.rating))
      y._ratings.push(Number(entry.rating))
    }
  })

  const finalize = (item) => {
    if (item._ratings.length) {
      const avg = item._ratings.reduce((acc, value) => acc + value, 0) / item._ratings.length
      item.avg_rating = roundToOneDecimal(avg)
    }
    delete item._ratings
    return item
  }

  const monthlyRows = [...monthly.values()].map(finalize).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })
  const yearlyRows = [...yearly.values()].map(finalize).sort((a, b) => b.year - a.year)
  return { monthlyRows, yearlyRows }
}

const renderStats = (monthlyRows, yearlyRows) => {
  const monthlyBody = query("#ra-monthly-table tbody")
  const yearlyBody = query("#ra-yearly-table tbody")

  renderTableRows(monthlyBody, monthlyRows, (row) => [
    String(row.year ?? "-"),
    toMonthLabel(row.month),
    String(row.books_finished ?? 0),
    String(row.pages_finished ?? 0),
    String(row.rereads_finished ?? 0),
    String(row.abandoned_count ?? 0),
    row.avg_rating === null || row.avg_rating === undefined ? "-" : String(row.avg_rating),
  ])

  renderTableRows(yearlyBody, yearlyRows, (row) => [
    String(row.year ?? "-"),
    String(row.books_finished ?? 0),
    String(row.pages_finished ?? 0),
    String(row.rereads_finished ?? 0),
    String(row.abandoned_count ?? 0),
    row.avg_rating === null || row.avg_rating === undefined ? "-" : String(row.avg_rating),
    String(row.target_books ?? 0),
    String(row.target_pages ?? 0),
  ])
}

const refreshGoalYearOptions = () => {
  const select = query("#ra-goal-year")
  if (!select) return
  const now = new Date().getFullYear()
  const years = new Set([now - 2, now - 1, now, now + 1, now + 2])
  state.yearlyStats.forEach((row) => years.add(Number(row.year)))
  state.yearlyGoalsByYear.forEach((_, year) => years.add(Number(year)))
  const sorted = [...years].filter((value) => Number.isFinite(value)).sort((a, b) => b - a)
  const currentValue = toInteger(select.value) || now

  select.textContent = ""
  sorted.forEach((year) => {
    const option = document.createElement("option")
    option.value = String(year)
    option.textContent = String(year)
    if (year === currentValue) {
      option.selected = true
    }
    select.appendChild(option)
  })
}

const updateCardsForYear = () => {
  const select = query("#ra-goal-year")
  const year = toInteger(select?.value) || new Date().getFullYear()
  const stat = state.yearlyStats.find((row) => Number(row.year) === year) || {}
  const goal = state.yearlyGoalsByYear.get(year) || { target_books: 0, target_pages: 0 }

  const booksValue = query("#ra-card-books-value")
  const pagesValue = query("#ra-card-pages-value")
  if (booksValue) {
    booksValue.textContent = `${stat.books_finished ?? 0} / ${goal.target_books ?? 0}`
  }
  if (pagesValue) {
    pagesValue.textContent = `${stat.pages_finished ?? 0} / ${goal.target_pages ?? 0}`
  }
}

const applyGoalInputsForYear = () => {
  const select = query("#ra-goal-year")
  const booksInput = query("#ra-goal-books")
  const pagesInput = query("#ra-goal-pages")
  const year = toInteger(select?.value) || new Date().getFullYear()
  const goal = state.yearlyGoalsByYear.get(year) || { target_books: 0, target_pages: 0 }
  if (booksInput) booksInput.value = String(goal.target_books ?? 0)
  if (pagesInput) pagesInput.value = String(goal.target_pages ?? 0)
  updateCardsForYear()
}

const loadGoals = async () => {
  let queryBuilder = state.supabase.from("reading_yearly_goals").select("owner_user_id, year, target_books, target_pages")
  if (state.isOwner && state.user) {
    queryBuilder = queryBuilder.eq("owner_user_id", state.user.id)
  }

  const { data, error } = await queryBuilder.order("year", { ascending: false })
  if (error) throw error

  state.yearlyGoalsByYear = new Map()
  ;(data || []).forEach((row) => {
    const year = Number(row.year)
    if (!Number.isFinite(year) || state.yearlyGoalsByYear.has(year)) return
    state.yearlyGoalsByYear.set(year, {
      target_books: toInteger(row.target_books) || 0,
      target_pages: toInteger(row.target_pages) || 0,
    })
  })
}

const loadStats = async () => {
  const monthlyPromise = state.supabase
    .from("reading_monthly_stats_v")
    .select("owner_user_id, year, month, books_finished, pages_finished, rereads_finished, abandoned_count, avg_rating")
    .order("year", { ascending: false })
    .order("month", { ascending: false })

  const yearlyPromise = state.supabase
    .from("reading_yearly_stats_v")
    .select(
      "owner_user_id, year, books_finished, pages_finished, rereads_finished, abandoned_count, avg_rating, target_books, target_pages"
    )
    .order("year", { ascending: false })

  const [monthlyResponse, yearlyResponse] = await Promise.all([monthlyPromise, yearlyPromise])

  if (monthlyResponse.error || yearlyResponse.error) {
    const fallback = computeStatsFromEntries(state.loadedEntries)
    state.yearlyStats = fallback.yearlyRows
    renderStats(fallback.monthlyRows, fallback.yearlyRows)
    return
  }

  const monthlyRows = monthlyResponse.data || []
  const yearlyRows = yearlyResponse.data || []
  state.yearlyStats = yearlyRows.map((row) => ({
    ...row,
    year: Number(row.year),
    books_finished: toInteger(row.books_finished) || 0,
    pages_finished: toInteger(row.pages_finished) || 0,
    rereads_finished: toInteger(row.rereads_finished) || 0,
    abandoned_count: toInteger(row.abandoned_count) || 0,
    avg_rating: row.avg_rating === null ? null : roundToOneDecimal(Number(row.avg_rating)),
    target_books: toInteger(row.target_books) || 0,
    target_pages: toInteger(row.target_pages) || 0,
  }))
  renderStats(monthlyRows, state.yearlyStats)
}

const loadEntries = async () => {
  const { data, error } = await state.supabase
    .from("reading_entries")
    .select(
      "id, owner_user_id, title, author, year_published, pages, pages_read, start_date, finish_date, genre, language, format, rating, notes, reread, abandoned"
    )
    .order("id", { ascending: true })

  if (error) throw error

  const entries = (data || []).map((row) => entryFromDatabase(row))
  state.loadedEntries = entries
  state.loadedEntriesById = new Map()
  state.loadedEntryIds = new Set()
  entries.forEach((entry) => {
    if (entry.id === null) return
    state.loadedEntryIds.add(entry.id)
    state.loadedEntriesById.set(entry.id, serializeEntry(entry))
  })

  const hotData = entries.map((entry, index) => hotRowFromEntry(entry, index))
  state.hot.loadData(hotData)
  setDirty(false)
}

const validateEntries = (entries) => {
  const errors = []
  entries.forEach((entry, index) => {
    const row = index + 1
    if (!entry.title) {
      errors.push(`Row ${row}: title is required.`)
    }
    if (entry.pages !== null && entry.pages < 0) {
      errors.push(`Row ${row}: pages must be >= 0.`)
    }
    if (entry.pages_read !== null && entry.pages_read < 0) {
      errors.push(`Row ${row}: pages read must be >= 0.`)
    }
    if (entry.rating !== null && (entry.rating < 0 || entry.rating > 5)) {
      errors.push(`Row ${row}: rating must be between 0 and 5.`)
    }
  })
  return errors
}

const collectEntriesFromSheet = () => {
  const sourceRows = state.hot.getSourceData()
  const entries = []
  sourceRows.forEach((row) => {
    const entry = entryFromHotRow(row)
    if (entry.id === null && isEntryBlank(entry)) return
    entries.push(entry)
  })
  return entries
}

const splitChanges = (currentEntries) => {
  const inserts = []
  const updates = []
  const currentById = new Map()

  currentEntries.forEach((entry) => {
    if (entry.id === null) {
      inserts.push(entry)
      return
    }
    currentById.set(entry.id, entry)
    const currentSerialized = serializeEntry(entry)
    const baseline = state.loadedEntriesById.get(entry.id)
    if (baseline !== currentSerialized) {
      updates.push(entry)
    }
  })

  const deleteIds = [...state.loadedEntryIds].filter((id) => !currentById.has(id))
  return { inserts, updates, deleteIds }
}

const saveEntries = async () => {
  if (!state.isOwner || !state.user) {
    throw new Error("Sign in as the owner to save changes.")
  }

  const currentEntries = collectEntriesFromSheet()
  const validationErrors = validateEntries(currentEntries)
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.slice(0, 6).join(" "))
  }

  const { inserts, updates, deleteIds } = splitChanges(currentEntries)
  if (inserts.length === 0 && updates.length === 0 && deleteIds.length === 0) {
    setDirty(false)
    setStatus("No changes to save.", "info")
    return
  }

  if (inserts.length > 0) {
    const payload = inserts.map((entry) => ({
      owner_user_id: state.user.id,
      title: entry.title,
      author: entry.author,
      year_published: entry.year_published,
      pages: entry.pages,
      pages_read: entry.pages_read,
      start_date: entry.start_date,
      finish_date: entry.finish_date,
      genre: entry.genre,
      language: entry.language,
      format: entry.format,
      rating: entry.rating,
      notes: entry.notes,
      reread: entry.reread,
      abandoned: entry.abandoned,
    }))
    const { error } = await state.supabase.from("reading_entries").insert(payload)
    if (error) throw error
  }

  for (const entry of updates) {
    const payload = {
      title: entry.title,
      author: entry.author,
      year_published: entry.year_published,
      pages: entry.pages,
      pages_read: entry.pages_read,
      start_date: entry.start_date,
      finish_date: entry.finish_date,
      genre: entry.genre,
      language: entry.language,
      format: entry.format,
      rating: entry.rating,
      notes: entry.notes,
      reread: entry.reread,
      abandoned: entry.abandoned,
    }
    const { error } = await state.supabase
      .from("reading_entries")
      .update(payload)
      .eq("id", entry.id)
      .eq("owner_user_id", state.user.id)
    if (error) throw error
  }

  if (deleteIds.length > 0) {
    const { error } = await state.supabase
      .from("reading_entries")
      .delete()
      .in("id", deleteIds)
      .eq("owner_user_id", state.user.id)
    if (error) throw error
  }
}

const saveGoals = async () => {
  if (!state.isOwner || !state.user) {
    throw new Error("Sign in as the owner to save goals.")
  }

  const year = toInteger(query("#ra-goal-year")?.value)
  const books = Math.max(0, toInteger(query("#ra-goal-books")?.value) || 0)
  const pages = Math.max(0, toInteger(query("#ra-goal-pages")?.value) || 0)
  if (!year) {
    throw new Error("Invalid goal year.")
  }

  const payload = {
    owner_user_id: state.user.id,
    year,
    target_books: books,
    target_pages: pages,
  }
  const { error } = await state.supabase
    .from("reading_yearly_goals")
    .upsert(payload, { onConflict: "owner_user_id,year" })
  if (error) throw error
}

const reloadAll = async () => {
  setStatus("Loading reading analytics...", "info")
  await loadEntries()
  await loadGoals()
  await loadStats()
  refreshGoalYearOptions()
  applyGoalInputsForYear()
  setStatus("Reading analytics loaded.", "success")
}

const insertRow = () => {
  const selected = state.hot.getSelectedLast()
  const row = Array.isArray(selected) ? selected[0] + 1 : state.hot.countRows()
  state.hot.alter("insert_row", row, 1)
}

const deleteSelectedRows = () => {
  const range = state.hot.getSelectedRangeLast()
  if (!range) return
  const from = Math.min(range.from.row, range.to.row)
  const to = Math.max(range.from.row, range.to.row)
  const amount = to - from + 1
  if (amount > 0) {
    state.hot.alter("remove_row", from, amount)
  }
}

const bindEvents = () => {
  query("#ra-load")?.addEventListener("click", async () => {
    try {
      await reloadAll()
    } catch (error) {
      setStatus(`Reload failed: ${formatError(error)}`, "error")
    }
  })

  query("#ra-add-row")?.addEventListener("click", () => {
    if (!state.isOwner) return
    insertRow()
  })

  query("#ra-delete-row")?.addEventListener("click", () => {
    if (!state.isOwner) return
    deleteSelectedRows()
  })

  query("#ra-save")?.addEventListener("click", async () => {
    try {
      setStatus("Saving changes...", "info")
      await saveEntries()
      await reloadAll()
      setStatus("Saved successfully.", "success")
    } catch (error) {
      setStatus(`Save failed: ${formatError(error)}`, "error")
    }
  })

  query("#ra-save-goals")?.addEventListener("click", async () => {
    try {
      setStatus("Saving goals...", "info")
      await saveGoals()
      await loadGoals()
      await loadStats()
      refreshGoalYearOptions()
      applyGoalInputsForYear()
      setStatus("Goals saved.", "success")
    } catch (error) {
      setStatus(`Goal save failed: ${formatError(error)}`, "error")
    }
  })

  query("#ra-goal-year")?.addEventListener("change", () => {
    applyGoalInputsForYear()
  })

  query("#ra-sign-in")?.addEventListener("click", async () => {
    try {
      const emailInput = query("#ra-owner-email-input")
      const email = normalizeText(emailInput?.value).toLowerCase()
      if (!email) {
        throw new Error("Enter an email address first.")
      }
      if (state.ownerEmail && email !== state.ownerEmail.toLowerCase()) {
        throw new Error("This tracker only allows the configured owner email.")
      }
      const { error } = await state.supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      })
      if (error) throw error
      setStatus("Magic link sent. Open your email to complete sign-in.", "success")
    } catch (error) {
      setStatus(`Sign-in failed: ${formatError(error)}`, "error")
    }
  })

  query("#ra-sign-out")?.addEventListener("click", async () => {
    try {
      const { error } = await state.supabase.auth.signOut()
      if (error) throw error
      setStatus("Signed out.", "info")
    } catch (error) {
      setStatus(`Sign-out failed: ${formatError(error)}`, "error")
    }
  })
}

const initSupabase = () => {
  const supabaseUrl = normalizeText(state.root.dataset.supabaseUrl)
  const supabaseAnonKey = normalizeText(state.root.dataset.supabaseAnonKey)
  state.ownerEmail = normalizeText(state.root.dataset.ownerEmail).toLowerCase()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration in site params.")
  }
  state.supabase = createClient(supabaseUrl, supabaseAnonKey)
}

const initAuth = async () => {
  const {
    data: { session },
    error,
  } = await state.supabase.auth.getSession()
  if (error) throw error
  setSession(session?.user ?? null)

  state.supabase.auth.onAuthStateChange((_event, nextSession) => {
    setSession(nextSession?.user ?? null)
  })
}

const init = async () => {
  const root = document.querySelector(ROOT_SELECTOR)
  if (!(root instanceof HTMLElement)) return
  if (state.initialized && state.root === root) return

  state.root = root

  try {
    createHandsontable()
    bindEvents()
    initSupabase()
    await initAuth()
    await reloadAll()
    state.initialized = true
  } catch (error) {
    setStatus(`Initialization failed: ${formatError(error)}`, "error")
    setToolbarEnabled(false)
    if (state.hot) {
      state.hot.updateSettings({ readOnly: true })
    }
  }
}

window.initReadingAnalyticsTracker = init

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    init()
  })
} else {
  init()
}
