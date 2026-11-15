// Interactive 例如 derivation for the 學習 mode.
//
// Given a verb's two forms, this returns the pieces the 變形說明 page renders:
// the reason line and the 原理 derivation (struck suffix, changed kana, result).
//
// The decomposition uses the SAME conjugation tables as the authored
// explanations (rule-conjugation.js), not a longest-common-prefix guess. A
// naive prefix compare cuts into a suffix when two suffixes share a start:
// 洗います → 洗いました would become 洗いま + す → し + した, and the す was
// drawn twice. Knowing the real 語尾 of each form gives 洗い + ます → ました
// instead, with the 語幹 and the unchanged い段 kana left alone.

import { godanParts, GODAN_SUFFIX, ICHIDAN_SUFFIX } from './rule-conjugation.js'

export const IRREGULAR_HINT = '不規則動詞／例外，不套用 段 與 音便，請直接記住整組變化（見上方第三類與例外表）'
export const SAME_FORM_HINT = '這兩個形在這個動詞上剛好同形，不用改'
export const PLAIN_HINT = '這個形的寫法不照規則，請直接記住兩個形'

function chars(text) {
  return Array.from(text ?? '')
}

function tail(text, count) {
  return chars(text).slice(count).join('')
}

function head(text, dropCount) {
  const list = chars(text)
  return list.slice(0, list.length - dropCount).join('')
}

// Every 語尾 a form can carry. Used only to recognise a *whole* shared 語尾
// (ません → ませんでした keeps ません) rather than an accidental character
// overlap (ます → ました shares only ま, which is not a 語尾).
const KNOWN_SUFFIXES = new Set(
  [...Object.values(GODAN_SUFFIX), ...Object.values(ICHIDAN_SUFFIX), 'だ', 'で'].filter(Boolean),
)

function sharedSuffix(fromSuffix, toSuffix) {
  const limit = Math.min(fromSuffix.length, toSuffix.length)
  for (let len = limit; len > 0; len -= 1) {
    const part = fromSuffix.slice(0, len)
    if (part === toSuffix.slice(0, len) && KNOWN_SUFFIXES.has(part)) return part
  }
  return ''
}

// When the row kana changes, that new kana is drawn by `changeFrom → changeTo`
// (purple) and in the result line as `toChange`; `added` is ONLY the suffix
// that is newly attached. So 泳ぎます → 泳ぐ shows 「ぎ → ぐ」 with no
// redundant 「＋ ぐ」 line, while 泳ぎます → 泳がない shows 「＋ ない」.
function reasonFor({ kanaChanged, fromKana, toKana, removed, added }) {
  if (kanaChanged) {
    if (added) return `${fromKana} → ${toKana}，加「${added}」`
    return `${fromKana} → ${toKana}`
  }
  if (removed && added) return `去掉「${removed}」，直接加「${added}」`
  if (added) return `直接加「${added}」`
  if (removed) return `去掉「${removed}」`
  return SAME_FORM_HINT
}

function resultPiece({ kind, reason, base, fromChange, stem, removed, changeFrom, changeTo, added, result }) {
  return {
    kind, reason, base, fromChange, stem, removed,
    changeFrom, changeTo, toChange: changeTo, added, result,
  }
}

export function deriveChange({ from, to, fromId, toId, ending }) {
  if (!from || !to) return null
  const group = String(from.group)

  // 不規則 and 例外 verbs have no step-by-step rule: the reason line is the
  // hint alone, and nothing is struck through.
  if (group === '3' || group === '0') {
    return { kind: 'irregular', reason: IRREGULAR_HINT }
  }
  if (group !== '1' && group !== '2') return null

  const fromVol = typeof from.vol === 'string' ? from.vol : ''
  const toVol = typeof to.vol === 'string' ? to.vol : ''
  const fromReading = typeof from.japanese === 'string' ? from.japanese : ''
  const toReading = typeof to.japanese === 'string' ? to.japanese : ''
  if (!fromVol || !toVol || !fromReading || !toReading) return null

  // The exact kana + 語尾 of both forms, from the same tables the class
  // blocks use. `ending` is the verb's dictionary-form last kana (う…る).
  let fromKana = ''
  let toKana = ''
  let fromSuffix = ''
  let toSuffix = ''
  if (group === '1') {
    if (!fromId || !toId || !ending) return null
    const f = godanParts(fromId, ending)
    const t = godanParts(toId, ending)
    if (!f.kana || !t.kana) return null
    fromKana = f.kana
    toKana = t.kana
    fromSuffix = f.suffix
    toSuffix = t.suffix
  } else {
    fromSuffix = ICHIDAN_SUFFIX[fromId] ?? ''
    toSuffix = ICHIDAN_SUFFIX[toId] ?? ''
  }

  const kanaChanged = group === '1' && fromKana !== toKana
  // 語幹 (including the unchanged row kana) = the written 從-form minus its
  // 語尾. For a 一段 verb this is simply the stem.
  const writtenStem = head(fromVol, chars(fromSuffix).length)

  let base
  let fromChange
  if (kanaChanged) {
    // The last kana moves to another 段 / 音便 stem: paint it purple and take
    // it out of `base`, so the result line can add the whole new ending.
    base = head(writtenStem, chars(fromKana).length)
    fromChange = fromKana
  } else {
    // Same kana: only the 語尾 changes. A shared *whole* 語尾 stays in `base`,
    // so ません → ませんでした reads as 直接加「でした」 rather than removing
    // and re-adding ません.
    base = writtenStem + sharedSuffix(fromSuffix, toSuffix)
    fromChange = null
  }

  const baseLen = chars(base).length
  const removed = tail(fromVol, baseLen + (kanaChanged ? chars(fromKana).length : 0))
  // `added` is the newly attached 語尾 ONLY. When the row kana changes, the
  // new kana is already expressed by `changeTo` / `toChange`, so it must not
  // also appear here (that was the duplicate 「＋ ぐ」 line).
  const added = kanaChanged ? toSuffix : tail(toVol, baseLen)
  const changeFrom = kanaChanged ? fromKana : null
  const changeTo = kanaChanged ? toKana : null
  const result = base + (changeTo ?? '') + added

  // Both written words must be reproduced exactly. An intentionally wrong
  // 練習用 form (error_usage) can break the table pattern; show the plain
  // pair instead of inventing a kana change.
  if (result !== toVol || base + (fromChange ?? '') + removed !== fromVol) {
    return resultPiece({
      kind: 'plain', reason: PLAIN_HINT, base: fromVol, fromChange: null,
      stem: fromVol, removed: '', changeFrom: null, changeTo: null,
      added: '', result: toVol,
    })
  }

  const identical = fromReading === toReading && fromVol === toVol
  return resultPiece({
    kind: identical ? 'same' : group === '1' ? 'godan' : 'ichidan',
    reason: identical ? SAME_FORM_HINT : reasonFor({ kanaChanged, fromKana, toKana, removed, added }),
    base,
    fromChange,
    stem: writtenStem,
    removed,
    changeFrom,
    changeTo,
    added,
    result,
  })
}
