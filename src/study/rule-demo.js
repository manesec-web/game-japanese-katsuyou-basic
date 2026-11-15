// Interactive 例如 derivation for the 學習 mode.
//
// Given a verb's two forms, this returns the pieces the 變形說明 page renders:
// the reason line and the 原理 derivation (struck suffix, changed kana, result).
// It compares the two readings (kana) and uses the verb class to pick the
// pattern. When the two forms do not fit the regular pattern it falls back to
// the plain 從 → 到 pair rather than guessing.
//
// The shared conjugation tables live in rule-conjugation.js; the suffix set
// below is only used to tell a 五段 「語尾だけ」 swap (話します → 話して, where
// し stays) from a real kana-row change (読みます → 読む, み → む).

export const IRREGULAR_HINT = '不規則動詞／例外，不套用 段 與 音便，請直接記住整組變化（見上方第三類與例外表）'
export const SAME_FORM_HINT = '這兩個形在這個動詞上剛好同形，不用改'

// The suffixes a 五段 form can end in after the row kana. When the shared
// prefix has already eaten the row kana (す-ending verbs keep し in ます/て/た),
// the remaining suffix is one of these and the derivation is a pure swap.
const GODAN_SUFFIXES = new Set([
  'ます', 'ません', 'ました', 'ませんでした',
  'ない', 'なかった',
  'た', 'だ', 'て', 'で',
  'る', 'う', 'ば', 'れる', 'せる', 'ろ', 'よう',
])

function chars(text) {
  return Array.from(text ?? '')
}

function lastChars(text, count) {
  const list = chars(text)
  if (count <= 0) return ''
  return list.slice(list.length - count).join('')
}

function dropLastChars(text, count) {
  const list = chars(text)
  if (count <= 0) return text ?? ''
  return list.slice(0, list.length - count).join('')
}

// A regular result keeps every field the view renders, so an empty suffix or a
// missing kana change simply hides that line instead of leaving a blank block.
function regular({ kind, reason, base, fromChange, removed, changeFrom, changeTo, toChange, added, result, stem }) {
  return {
    kind, reason, base, fromChange, stem, removed,
    changeFrom, changeTo, toChange, added, result,
  }
}

export function deriveChange({ from, to }) {
  if (!from || !to) return null
  const group = String(from.group)

  // 不規則 and 例外 verbs have no step-by-step rule: the reason line is the
  // hint alone, and nothing is struck through.
  if (group === '3' || group === '0') {
    return { kind: 'irregular', reason: IRREGULAR_HINT }
  }
  if (group !== '1' && group !== '2') return null

  const fromReading = chars(from.japanese)
  const toReading = chars(to.japanese)
  if (fromReading.length === 0 || toReading.length === 0) return null

  // The two readings share the stem up to the first changed kana.
  let lcp = 0
  while (lcp < fromReading.length && lcp < toReading.length && fromReading[lcp] === toReading[lcp]) {
    lcp += 1
  }
  if (lcp === 0) return null

  const fromSuffix = fromReading.slice(lcp)
  const toSuffix = toReading.slice(lcp)

  // Case 1: identical readings (可能形 = 受身形 for a 一段 verb, etc.).
  if (fromSuffix.length === 0 && toSuffix.length === 0) {
    return regular({
      kind: 'same',
      reason: SAME_FORM_HINT,
      base: from.vol,
      fromChange: null,
      stem: from.vol,
      removed: '',
      changeFrom: null,
      changeTo: null,
      toChange: null,
      added: '',
      result: to.vol,
    })
  }

  // Case 2: pure addition (ません → ませんでした). The written form keeps the
  // same kanji stem, so the added text is the trailing part of the 到 word.
  if (fromSuffix.length === 0) {
    const writtenAdded = typeof from.vol === 'string' && typeof to.vol === 'string' && to.vol.startsWith(from.vol)
      ? to.vol.slice(from.vol.length)
      : null
    if (!writtenAdded) return null
    return regular({
      kind: group === '1' ? 'godan' : 'ichidan',
      reason: `直接加「${writtenAdded}」`,
      base: from.vol,
      fromChange: null,
      stem: from.vol,
      removed: '',
      changeFrom: null,
      changeTo: null,
      toChange: null,
      added: writtenAdded,
      result: to.vol,
    })
  }

  // Case 3: pure deletion (ませんでした → ません).
  if (toSuffix.length === 0) {
    const writtenRemoved = typeof from.vol === 'string' && typeof to.vol === 'string' && from.vol.startsWith(to.vol)
      ? from.vol.slice(to.vol.length)
      : null
    if (!writtenRemoved) return null
    return regular({
      kind: group === '1' ? 'godan' : 'ichidan',
      reason: `去掉「${writtenRemoved}」`,
      base: to.vol,
      fromChange: null,
      stem: to.vol,
      removed: writtenRemoved,
      changeFrom: null,
      changeTo: null,
      toChange: null,
      added: '',
      result: to.vol,
    })
  }

  if (group === '1') {
    // 五段: the last kana of the 語幹 moves onto another 段 / 音便 stem, and
    // the 語尾 after it is swapped. The 從-form's own written ending is
    // `row kana + suffix`; keeping that kana as the purple "fromChange" makes
    // the 原理 line agree with the 音便 table above (う → い、い → っ …).
    const fromEnding = fromSuffix.join('')
    const toEnding = toSuffix.join('')
    const pureSwap = GODAN_SUFFIXES.has(fromEnding)
    const changeFrom = pureSwap ? null : fromSuffix[0]
    const changeTo = pureSwap ? null : toSuffix[0]
    // One kana is kept and changed; only the 語尾 after it is removed / added.
    const removedCount = pureSwap ? fromSuffix.length : fromSuffix.length - 1
    const added = pureSwap ? toEnding : toSuffix.slice(1).join('')
    if (removedCount >= chars(from.vol).length) return null
    const stem = dropLastChars(from.vol, removedCount)
    // When 從 has no 語尾 (字典形 / 命令形), the changing kana itself is the
    // part to remove: paint it purple and strike it, then add the whole new
    // ending. This keeps 字典形→ます形 (`買う → 買います`) consistent with the
    // 段 table rather than silently dropping the う.
    const removedWritten = lastChars(from.vol, removedCount)
    const noSuffix = !GODAN_SUFFIXES.has(fromEnding) && removedCount === 0 && !pureSwap
    return regular({
      kind: 'godan',
      reason: changeFrom
        ? `${changeFrom} → ${changeTo}`
        : `去掉「${removedWritten}」，直接加「${added}」`,
      base: pureSwap ? stem : dropLastChars(stem, 1),
      fromChange: changeFrom,
      stem,
      // 字典形 has no 語尾 to strike: the changing kana is struck instead.
      removed: noSuffix ? changeFrom : removedWritten,
      changeFrom,
      changeTo,
      toChange: changeTo,
      added: pureSwap ? added : `${changeTo ?? ''}${added}`,
      result: to.vol,
    })
  }

  // 一段: the whole from-suffix is removed and the whole to-suffix is added;
  // the stem itself does not change.
  const removedCount = fromSuffix.length
  const added = toSuffix.join('')
  if (removedCount >= chars(from.vol).length) return null
  const stem = dropLastChars(from.vol, removedCount)
  return regular({
    kind: 'ichidan',
    reason: `去掉「${lastChars(from.vol, removedCount)}」，直接加「${added}」`,
    base: stem,
    fromChange: null,
    stem,
    removed: lastChars(from.vol, removedCount),
    changeFrom: null,
    changeTo: null,
    toChange: null,
    added,
    result: to.vol,
  })
}
