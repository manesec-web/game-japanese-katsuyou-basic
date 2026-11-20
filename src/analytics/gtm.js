// Google Analytics adapter: the GTM container, gtag.js and the page views.
// Thin DOM layer — the rules live in ./page-view.js.
//
// The IDs come from src/config/analytics.js (a developer edits that file; they
// are not user settings). The GTM container is loaded with the standard
// snippet (dataLayer, gtm.start, one async gtm.js script). Its own config tag
// sends the landing page view, but it does not report this SPA's screen
// changes, so gtag.js is loaded as well with the GA4 measurement ID, configured
// with `send_page_view: false`. Every screen change then sends one GA4 page
// view. An empty ID loads nothing.
import {
  normalizeContainerId,
  normalizeMeasurementId,
  pageViewPayload,
} from './page-view.js'

export const GTM_SCRIPT_URL = 'https://www.googletagmanager.com/gtm.js?id='
export const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js?id='

export function createGtm({ window: win = globalThis.window, document: doc = globalThis.document } = {}) {
  const loaded = new Set()
  const tags = new Set()
  // The container's own page view at load covers the landing (`loading`, then
  // the first `home`); sending one for those too would collide with it inside
  // GA4's page_view window. Every later screen change reports itself.
  let landed = false

  function dataLayer() {
    if (!win) return null
    if (!win.dataLayer) win.dataLayer = []
    return win.dataLayer
  }

  function push(entry) {
    const layer = dataLayer()
    if (!layer) return false
    layer.push(entry)
    return true
  }

  // Load one container, once. An invalid ID loads nothing.
  function load(containerId) {
    const id = normalizeContainerId(containerId)
    if (!id || !doc || !doc.head) return false
    if (loaded.has(id)) return false
    loaded.add(id)
    push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    const script = doc.createElement('script')
    script.async = true
    script.src = GTM_SCRIPT_URL + encodeURIComponent(id)
    script.setAttribute('data-gtm-id', id)
    doc.head.appendChild(script)
    return true
  }

  // Load the GA4 measurement ID with `send_page_view: false`: the container's
  // page view stays the landing one, and the site's own events are the only
  // page views after it. gtag queues through dataLayer until its script runs,
  // so `config` may be pushed right away, like the official snippet.
  function loadTag(measurementId) {
    const id = normalizeMeasurementId(measurementId)
    if (!id) return false
    const layer = dataLayer()
    if (!layer || !doc || !doc.head) return false
    if (typeof win.gtag !== 'function') {
      win.gtag = function gtag() {
        layer.push(arguments)
      }
    }
    if (tags.has(id)) return false
    tags.add(id)
    win.gtag('js', new Date())
    win.gtag('config', id, { send_page_view: false })
    const script = doc.createElement('script')
    script.async = true
    script.src = GTAG_SCRIPT_URL + encodeURIComponent(id)
    script.setAttribute('data-gtag-id', id)
    doc.head.appendChild(script)
    return true
  }

  // One page view for a screen: the dataLayer entry always, and a GA4 event
  // once gtag.js is configured and the screen is not the landing one.
  function screen(screenName) {
    const href = win?.location?.href ?? ''
    const payload = pageViewPayload(screenName, href)
    push(payload)
    if (tags.size === 0) return false
    if (screenName === 'loading') return false
    if (screenName === 'home' && !landed) {
      landed = true
      return false
    }
    landed = true
    win.gtag('event', 'page_view', {
      screen_name: payload.screen_name,
      page_title: payload.page_title,
      page_location: payload.page_location,
    })
    return true
  }

  return { load, loadTag, screen, push, loaded, tags }
}
