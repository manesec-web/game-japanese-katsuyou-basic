// URL deep-link parsing and word resolution. Pure rules — no DOM, no storage.
//
// The page URL's query string is read once at load and turned into a deep-link
// intent, then the intent is applied after boot. `parseDeepLink` accepts
// `location.search` (or any query string) and returns a validated intent or
// null; `resolveWord` turns `lesson` + (`word` or `index`) into the verb
// reference `{ lesson, index }` in the library's JSON order.
import { FORM_IDS } from '../dict/forms.js'
import { katakanaToHiragana } from '../dict/romaji.js'
import { matchFormRanges } from './toc.js'
import { exampleVerb } from './rule.js'

export const DEEP_LINK_SCREENS = ['reader', 'toc', 'rule', 'learn']

function nonEmpty(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseLesson(raw) {
  if (raw === null || raw === '') return null
  const lesson = Number(raw)
  if (!Number.isInteger(lesson) || lesson < 1 || lesson > 50) return null
  return lesson
}

function parseIndex(raw) {
  if (raw === null || raw === '') return null
  const index = Number(raw)
  if (!Number.isInteger(index) || index < 0) return null
  return index
}

function parseForm(raw) {
  if (raw === null || raw === '') return null
  return FORM_IDS.includes(raw) ? raw : null
}

// Parse the query string into a deep-link intent, or null when it is not a
// valid deep link. Any bad parameter makes the whole link a no-op (the site
// boots to `home` as usual); a malformed value is never half-applied.
export function parseDeepLink(search) {
  if (typeof search !== 'string' || search.trim() === '') return null
  let params
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }

  const screen = params.get('screen')
  if (!DEEP_LINK_SCREENS.includes(screen)) return null

  const intent = { screen, lesson: null, word: null, index: null, from: null, to: null }

  // `from` / `to` are form ids; a present-but-unknown id is an invalid link.
  const from = parseForm(params.get('from'))
  const to = parseForm(params.get('to'))
  if (params.get('from') !== null && from === null) return null
  if (params.get('to') !== null && to === null) return null

  const lessonRaw = params.get('lesson')
  const lesson = parseLesson(lessonRaw)
  if (lessonRaw !== null && lessonRaw !== '' && lesson === null) return null

  const word = nonEmpty(params.get('word'))

  const indexRaw = params.get('index')
  const index = parseIndex(indexRaw)
  if (indexRaw !== null && indexRaw !== '' && index === null) return null

  intent.lesson = lesson
  intent.word = word
  intent.index = index
  intent.from = from
  intent.to = to

  if (screen === 'reader' || screen === 'toc') {
    // A word to land on is required, and the lesson it lives in too.
    if (lesson === null) return null
    if (index === null && word === null) return null
  }

  if (screen === 'rule') {
    if (from === null || to === null) return null
    if (from === to) return null
  }

  return intent
}

function formMatches(query, form) {
  if (!form) return false
  const vol = typeof form.vol === 'string' ? form.vol : ''
  const japanese = typeof form.japanese === 'string' ? form.japanese : ''
  return matchFormRanges(query, vol, japanese).length > 0
}

// A verb matches when the query matches any of its 15 forms — the displayed
// word literally, or the reading after a Latin query is converted to kana
// (the same rules 單詞目錄 search uses).
function verbMatches(query, verb) {
  if (!verb || typeof verb !== 'object') return false
  return FORM_IDS.some((formId) => formMatches(query, verb[formId]))
}

// Resolve `lesson` + (`word` or `index`) to a verb reference in the library's
// JSON order, or null. `index` wins when both are present: it names the verb
// exactly. A word matches the first verb in JSON order.
export function resolveWord(library, lesson, word, index) {
  if (!library || !Number.isInteger(lesson) || lesson < 1 || lesson > 50) return null
  const verbs = library.getVerbs([lesson])
  if (!Array.isArray(verbs) || verbs.length === 0) return null

  if (Number.isInteger(index)) {
    if (index < 0 || index >= verbs.length) return null
    return { lesson, index }
  }

  const query = nonEmpty(word)
  if (query === null) return null
  for (let i = 0; i < verbs.length; i += 1) {
    if (verbMatches(query, verbs[i].verb)) return { lesson, index: i }
  }
  return null
}

// The full deep-link URL for the current screen, or null when the screen is
// not deep-linkable. `href` is the page URL; any query it already carries is
// dropped and replaced with the generated deep-link query.
export function deepLinkUrl(href, session, library = null) {
  const query = deepLinkQuery(session, library)
  if (!query) return null
  const base = typeof href === 'string' && href !== '' ? href.split('?')[0] : ''
  return base + query
}
// Build a query string from [key, value] pairs, dropping empty values. Values
// here are screen/form ids, lesson numbers and the word, all URL-safe, so the
// result stays readable (e.g. `word=行く`) instead of percent-encoded.
function joinQuery(entries) {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function hasKanji(text) {
  return Array.from(text).some((char) => {
    const code = char.codePointAt(0)
    return code >= 0x4e00 && code <= 0x9fff
  })
}

// The word a deep link names for a verb: the dictionary-form written form when
// it carries kanji (kanji disambiguates homophones like 帰る / 変える), else
// the reading converted to hiragana (so コピーする becomes こぴーする).
export function deepLinkWord(verb) {
  const dict = verb?.['dictionary-form']
  const vol = typeof dict?.vol === 'string' ? dict.vol : ''
  const japanese = typeof dict?.japanese === 'string' ? dict.japanese : ''
  if (vol !== '' && hasKanji(vol)) return vol
  const reading = japanese !== '' ? japanese : vol
  return katakanaToHiragana(reading)
}

// The reverse of parsing: the deep-link query string for the current screen,
// or null when the screen is not a deep-link target. The reader and 單詞目錄
// name the word on screen via `deepLinkWord` (kanji first, then hiragana);
// 變形說明 names 從/到 and, when an example is chosen, that verb.
export function deepLinkQuery(session, library = null) {
  const screen = session?.screen
  if (screen === 'learn') return '?screen=learn'

  if (screen === 'rule') {
    const { from, to } = session.rule ?? {}
    if (!from || !to) return '?screen=rule'
    const entries = [
      ['screen', 'rule'],
      ['from', from],
      ['to', to],
    ]
    const example = session.rule?.example
    const entry = example ? exampleVerb(library, example) : null
    const word = deepLinkWord(entry?.verb)
    if (example && word !== '') {
      entries.push(['lesson', String(example.lesson)], ['word', word])
    }
    return `?${joinQuery(entries)}`
  }

  if (screen === 'reader' || screen === 'toc') {
    const item = session.items?.[session.index]
    const lesson = item?.lesson
    const word = deepLinkWord(item?.verb)
    if (!Number.isInteger(lesson)) return null
    if (word === '') return null
    return `?${joinQuery([['screen', screen], ['lesson', String(lesson)], ['word', word]])}`
  }

  return null
}
