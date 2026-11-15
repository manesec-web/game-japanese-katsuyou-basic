// Pure builder for the 210 變形說明 entries in src/data/rule-content.js.
//
// It takes real verbs (read from vol/ by scripts/generate-rule-content.mjs) and
// the conjugation tables in rule-conjugation.js, and returns plain data. The
// Vue view only renders this data; no rule is decided at render time.
//
// Keeping the builder pure makes it possible for the tests to regenerate every
// entry from vol/ and compare it with the shipped file, so a stale generated
// file or a wrong kana pair can never ship.
import { formName, FORM_IDS } from '../dict/forms.js'
import {
  GODAN_ENDINGS, ONBIN_ORDER, GODAN_ROW, ROW_LABEL,
  ICHIDAN_SUFFIX, IRREGULAR_SUFFIX,
  godanParts, godanEnding, isOnbin, suffixLabel,
  mappingLines, mappingLabel, godanRule, ichidanRule,
  specialNotes, ichidanNotes, irregularNotes, exceptionNotes,
  orderedPairs,
} from './rule-conjugation.js'

// --- Example words ---------------------------------------------------------
// Picked from vol/ by their dictionary-form `vol`. Using real dictionary words
// means every cell in every table is a form that actually exists in the app.
export const EXAMPLE_GODAN = ['買う', '書く', '急ぐ', '話す', '待つ', '死ぬ', '遊ぶ', '読む', '作る']
export const EXAMPLE_ICHIDAN = ['食べる', '見る', '起きる', '寝る', '教える', '借りる']
// 第三類: the two textbook irregular verbs, plus three real する compounds.
export const EXAMPLE_IRREGULAR = ['する', '来る', '勉強する', '無理をする', '世話をする']
// 例外 (group 0 in the data): the special verbs the learner must be warned about.
export const EXAMPLE_EXCEPTION = ['行く', '帰る', '切る', 'ある', '持って行く', '持って来る']

const ALL_KEYS = [...EXAMPLE_GODAN, ...EXAMPLE_ICHIDAN, ...EXAMPLE_IRREGULAR, ...EXAMPLE_EXCEPTION]

// Resolve the example list from the dictionary. Each verb is kept as `{ key,
// verb }` where `verb` is the raw 15-form object. Throws on a missing word so a
// renamed dictionary entry cannot silently produce an empty table.
export function collectExamples(verbs) {
  const picked = new Map()
  for (const { verb } of verbs ?? []) {
    const key = verb?.['dictionary-form']?.vol
    if (ALL_KEYS.includes(key) && !picked.has(key)) picked.set(key, { key, verb })
  }
  const missing = ALL_KEYS.filter((key) => !picked.has(key))
  if (missing.length) throw new Error(`missing example verbs in vol/: ${missing.join('、')}`)
  return Object.fromEntries(ALL_KEYS.map((key) => [key, picked.get(key)]))
}

function chars(text) {
  return Array.from(text ?? '')
}

// Split a written form into the kanji/unchanged stem and the kana ending. The
// dictionary vol's trailing hiragana is its okurigana; the kana before it is
// the reading prefix. For every form, `vol = kanjiPrefix + kana.slice(prefix)`.
export function verbShape(verb) {
  const dict = verb['dictionary-form']
  const dictVol = chars(dict.vol)
  let okuriLen = 0
  while (okuriLen < dictVol.length && /^[ぁ-ゖー]+$/.test(dictVol[dictVol.length - okuriLen - 1])) {
    okuriLen += 1
  }
  const kanjiPrefix = dictVol.slice(0, dictVol.length - okuriLen).join('')
  const dictKana = chars(dict.japanese)
  const readingPrefix = dictKana.slice(0, dictKana.length - okuriLen).join('')
  return { kanjiPrefix, readingPrefix, dictKana: dictKana.join(''), okuriLen }
}

// The kana ending of a form (everything after the reading prefix).
export function formEnding(verb, formId) {
  const { readingPrefix } = verbShape(verb)
  const kana = verb[formId].japanese
  return kana.slice(readingPrefix.length)
}

// Sanity check used by the generator and its tests: every example's written
// form must equal kanjiPrefix + kana ending.
export function checkExampleForms(verb) {
  const shape = verbShape(verb)
  const errors = []
  for (const id of FORM_IDS) {
    const expected = shape.kanjiPrefix + formEnding(verb, id)
    if (verb[id].vol !== expected) {
      errors.push({ form: id, vol: verb[id].vol, expected })
    }
  }
  return errors
}

function seg(text, c) {
  return c ? { t: text, c } : { t: text }
}

function segment(text, c) {
  return text ? [seg(text, c)] : []
}

// --- 第一類 (五段) ---------------------------------------------------------
function godanEndingOf(verb) {
  return chars(verb['dictionary-form'].japanese).slice(-1)[0]
}

function godanRow(verb, from, to) {
  const ending = godanEndingOf(verb)
  const f = godanParts(from, ending)
  const t = godanParts(to, ending)
  const shape = verbShape(verb)
  const kanaChanged = f.kana !== t.kana
  const fromSegs = [seg(shape.kanjiPrefix)]
  const toSegs = [seg(shape.kanjiPrefix)]
  fromSegs.push(seg(f.kana, kanaChanged ? 'change' : undefined))
  toSegs.push(seg(t.kana, kanaChanged ? 'change' : undefined))
  fromSegs.push(...segment(f.suffix, f.suffix ? 'removed' : undefined))
  toSegs.push(...segment(t.suffix, t.suffix ? 'change' : undefined))

  let change
  if (kanaChanged) {
    change = [seg(f.kana, 'change'), { t: ' → ' }, seg(t.kana, 'change')]
  } else if (f.suffix && t.suffix) {
    change = [seg(f.suffix, 'removed'), { t: ' → ' }, seg(t.suffix, 'change')]
  } else if (t.suffix) {
    change = [{ t: '＋' }, seg(t.suffix, 'change')]
  } else if (f.suffix) {
    change = [{ t: '去' }, seg(f.suffix, 'removed')]
  } else {
    change = [{ t: '（不變）' }]
  }
  return { from: fromSegs, change, to: toSegs }
}

// --- 第二類 (一段) ---------------------------------------------------------
function ichidanRow(verb, from, to) {
  const fs = ICHIDAN_SUFFIX[from]
  const ts = ICHIDAN_SUFFIX[to]
  const shape = verbShape(verb)
  const stem = verb[from].vol.slice(0, -fs.length)
  if (fs === ts) {
    return {
      from: [{ t: verb[from].vol }],
      change: [{ t: '（同形）' }],
      to: [{ t: verb[to].vol }],
    }
  }
  return {
    from: [seg(stem), seg(fs, 'removed')],
    change: [seg(fs, 'removed'), { t: ' → ' }, seg(ts, 'change')],
    to: [seg(stem), seg(ts, 'change')],
  }
}

// --- 第三類 / 例外 ---------------------------------------------------------
function plainRow(verb, from, to) {
  return {
    from: [{ t: verb[from].vol }],
    to: [{ t: verb[to].vol }],
  }
}

function columns(from, to, withChange = true) {
  return withChange ? [formName(from), '變形', formName(to)] : [formName(from), formName(to)]
}

// Build the one authored entry for a (from, to) pair.
export function buildEntry(examples, from, to) {
  const godanVerbs = (isOnbin(from) || isOnbin(to))
    ? ONBIN_ORDER.map((ending) => EXAMPLE_GODAN.map((key) => examples[key]).find(({ verb }) => godanEndingOf(verb) === ending))
    : EXAMPLE_GODAN.map((key) => examples[key])

  const map = mappingLines(from, to)
  const sections = [
    {
      heading: '1. 第一類動詞（五段動詞／動一）',
      rule: godanRule(from, to),
      map: map ? { label: mappingLabel(from, to), rows: map } : null,
      columns: columns(from, to),
      rows: godanVerbs.filter(Boolean).map(({ verb }) => godanRow(verb, from, to)),
      notes: specialNotes(from, to),
    },
    {
      heading: '2. 第二類動詞（一段動詞／動二）',
      rule: ichidanRule(from, to),
      map: null,
      columns: columns(from, to),
      rows: EXAMPLE_ICHIDAN.map((key) => ichidanRow(examples[key].verb, from, to)),
      notes: ichidanNotes(from, to),
    },
    {
      heading: '3. 第三類動詞（カ變・サ變／不規則動詞）',
      rule: '不套用 段 或 音便，整組記憶。注意 する 的可能形是 できる，来る 的讀音會跟著形改變。',
      map: null,
      columns: columns(from, to, false),
      rows: EXAMPLE_IRREGULAR.map((key) => plainRow(examples[key].verb, from, to)),
      notes: irregularNotes(from, to),
    },
    {
      heading: '4. 例外',
      rule: '行く、ある、帰る、する、来る 等特殊動詞：下面列出它們在這一對形上的實際寫法。',
      map: null,
      columns: columns(from, to, false),
      rows: EXAMPLE_EXCEPTION.map((key) => plainRow(examples[key].verb, from, to)),
      notes: exceptionNotes(from, to),
    },
  ]
  return { from, to, sections }
}

// All 210 ordered pairs.
export function buildRuleContent(examples) {
  return orderedPairs().map(({ from, to }) => buildEntry(examples, from, to))
}
