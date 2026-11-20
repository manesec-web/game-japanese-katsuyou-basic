// Analytics rules: the two Google IDs, the per-screen title and the dataLayer /
// GA4 page view entry. Pure — no DOM and no storage access.
//
// Two IDs are needed because a GTM container alone does not report an SPA's
// screen changes to Analytics: its own page view fires once at load, and its
// enhanced-measurement page view only follows browser history changes, which
// this site does not make. gtag.js, loaded with the GA4 measurement ID that
// lives inside the container, is what reports one page view per screen.

// The container the site ships with. It loads the container snippet.
export const DEFAULT_CONTAINER_ID = 'GTM-W7387LLQ'

// The GA4 destination inside that container. It is the ID that receives the
// per-screen page views.
export const DEFAULT_MEASUREMENT_ID = 'G-NFDK8SXY0M'

// `GTM-` plus 4 to 12 letters or digits; `G-` plus 6 to 20 letters or digits.
const CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/

export const SITE_TITLE = '大家の動詞轉型練習'

// On-screen names of the eleven screens, used for the page title.
export const SCREEN_TITLES = {
  loading: '載入中',
  home: '主頁',
  picker: '詞彙',
  reader: '字典',
  toc: '單詞目錄',
  card: '練習',
  quiz: '測驗',
  settings: '設定',
  learn: '變形目錄',
  rule: '變形說明',
  example: '選字',
}

// Normalise a typed ID (trim, uppercase); null when it is not one.
export function normalizeContainerId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toUpperCase()
  return CONTAINER_ID_PATTERN.test(trimmed) ? trimmed : null
}

export function isValidContainerId(value) {
  return normalizeContainerId(value) !== null
}

export function normalizeMeasurementId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toUpperCase()
  return MEASUREMENT_ID_PATTERN.test(trimmed) ? trimmed : null
}

export function isValidMeasurementId(value) {
  return normalizeMeasurementId(value) !== null
}

// `home` carries the site title alone; every other screen names itself first.
export function pageTitle(screen) {
  if (screen === 'home') return SITE_TITLE
  const name = SCREEN_TITLES[screen]
  return name ? `${name} · ${SITE_TITLE}` : SITE_TITLE
}

// The page location reported for a screen: the page's own URL with the screen
// as its fragment. `home` is the site title's screen but still names itself, so
// a return home is a page view of its own. The browser URL is never changed —
// a screen is reported, not routed.
export function screenPageLocation(href, screen) {
  if (typeof href !== 'string' || href === '') return ''
  const base = href.split('#')[0]
  return screen ? `${base}#/${screen}` : base
}

// The dataLayer / GA4 entry for one screen.
export function pageViewPayload(screen, href) {
  return {
    event: 'page_view',
    screen_name: screen,
    page_title: pageTitle(screen),
    page_location: screenPageLocation(href, screen),
  }
}
