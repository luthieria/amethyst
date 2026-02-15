;(function () {
  const SELECTORS = {
    menu: "aside.book-menu",
    menuContent: ".book-menu-content",
    hoverZone: ".book-menu-hover-zone",
    pinButton: ".book-menu-pin",
  }

  const CLASSES = {
    enabled: "sidebar-autohide-enabled",
    open: "sidebar-menu-open",
    pinned: "sidebar-menu-pinned",
  }

  const STORAGE_KEY = "amethyst.sidebar.pinned"
  const DESKTOP_MEDIA_QUERY = "(min-width: 56rem)"
  const HIDE_DELAY_MS = 200

  const globalState = {
    cleanup: null,
  }

  const readPinned = () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1"
    } catch (_) {
      return false
    }
  }

  const writePinned = (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
    } catch (_) {
      // Ignore storage errors (e.g. private mode restrictions).
    }
  }

  const updatePinButton = (button, pinned) => {
    if (!(button instanceof HTMLElement)) return
    const label = pinned ? "Unpin sidebar" : "Pin sidebar"
    button.setAttribute("aria-pressed", pinned ? "true" : "false")
    button.setAttribute("aria-label", label)
    button.setAttribute("title", label)
    button.textContent = pinned ? "Unpin" : "Pin"
  }

  const init = () => {
    const body = document.body
    if (!(body instanceof HTMLElement)) return

    const menu = document.querySelector(SELECTORS.menu)
    const menuContent = menu ? menu.querySelector(SELECTORS.menuContent) : null
    const hoverZone = document.querySelector(SELECTORS.hoverZone)
    const pinButton = menu ? menu.querySelector(SELECTORS.pinButton) : null

    if (!(menu instanceof HTMLElement && menuContent instanceof HTMLElement && hoverZone instanceof HTMLElement && pinButton instanceof HTMLElement)) {
      if (typeof globalState.cleanup === "function") {
        globalState.cleanup()
      }
      globalState.cleanup = null
      return
    }

    if (typeof globalState.cleanup === "function") {
      globalState.cleanup()
      globalState.cleanup = null
    }

    const cleanupFns = []
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    let hideTimer = null
    let pinned = readPinned()

    const addListener = (target, type, handler, options) => {
      target.addEventListener(type, handler, options)
      cleanupFns.push(() => target.removeEventListener(type, handler, options))
    }

    const clearHideTimer = () => {
      if (hideTimer === null) return
      window.clearTimeout(hideTimer)
      hideTimer = null
    }

    const openMenu = () => {
      if (!mediaQuery.matches) return
      clearHideTimer()
      body.classList.add(CLASSES.open)
    }

    const scheduleClose = () => {
      if (!mediaQuery.matches || pinned) return
      clearHideTimer()
      hideTimer = window.setTimeout(() => {
        hideTimer = null
        if (!pinned && mediaQuery.matches) {
          body.classList.remove(CLASSES.open)
        }
      }, HIDE_DELAY_MS)
    }

    const applyState = () => {
      const desktop = mediaQuery.matches
      body.classList.toggle(CLASSES.enabled, desktop)

      if (!desktop) {
        clearHideTimer()
        body.classList.remove(CLASSES.open, CLASSES.pinned)
        updatePinButton(pinButton, pinned)
        return
      }

      body.classList.toggle(CLASSES.pinned, pinned)
      if (pinned) {
        body.classList.add(CLASSES.open)
      } else {
        body.classList.remove(CLASSES.open)
      }
      updatePinButton(pinButton, pinned)
    }

    const togglePinned = () => {
      pinned = !pinned
      writePinned(pinned)
      applyState()
    }

    const onFocusOut = () => {
      if (menu.contains(document.activeElement)) return
      scheduleClose()
    }

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return
      if (!mediaQuery.matches || pinned) return
      clearHideTimer()
      body.classList.remove(CLASSES.open)
    }

    addListener(hoverZone, "pointerenter", openMenu)
    addListener(hoverZone, "pointerleave", scheduleClose)
    addListener(menu, "pointerenter", openMenu)
    addListener(menu, "pointerleave", scheduleClose)
    addListener(menu, "focusin", openMenu)
    addListener(menu, "focusout", onFocusOut)
    addListener(pinButton, "click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      togglePinned()
    })
    addListener(document, "keydown", onKeyDown)

    const onMediaChange = () => applyState()
    if (typeof mediaQuery.addEventListener === "function") {
      addListener(mediaQuery, "change", onMediaChange)
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(onMediaChange)
      cleanupFns.push(() => mediaQuery.removeListener(onMediaChange))
    }

    applyState()

    globalState.cleanup = () => {
      clearHideTimer()
      cleanupFns.forEach((dispose) => dispose())
      cleanupFns.length = 0
      body.classList.remove(CLASSES.enabled, CLASSES.open, CLASSES.pinned)
    }
  }

  window.initSidebarAutoHide = init
})()
