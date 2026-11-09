// Kanji / reading alignment for furigana.
//
// The reading has no per-character alignment. Rules from the spec:
// 1. Katakana in the word is treated as hiragana while aligning, rendered
//    as katakana.
// 2. A kana character on the word (including the long-vowel mark) that
//    equals the next reading character is okurigana: rendered alone.
// 3. A run of kanji takes the reading up to the next okurigana; that slice
//    is the <rt> for the run.
// 4. If the strings do not align, put the full reading above the whole word.

const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const KATAKANA_TO_HIRAGANA = 0x60

function isKana(char) {
  const code = char.codePointAt(0)
  return (
    (code >= 0x3041 && code <= 0x3096) ||
    (code >= KATAKANA_START && code <= KATAKANA_END) ||
    char === 'ー'
  )
}

function normalizeKana(char) {
  const code = char.codePointAt(0)
  if (code >= KATAKANA_START && code <= KATAKANA_END) {
    return String.fromCodePoint(code - KATAKANA_TO_HIRAGANA)
  }
  return char
}

function fallback(vol, japanese) {
  return {
    ok: false,
    tokens: [{ text: vol, ruby: japanese }],
  }
}

// Returns { ok, tokens: [{ text, ruby }] }. `ruby` null means render plain.
export function alignReading(vol, japanese) {
  if (typeof vol !== 'string' || vol === '') return fallback(vol ?? '', japanese ?? '')
  if (typeof japanese !== 'string' || japanese === '') {
    return { ok: true, tokens: Array.from(vol).map((char) => ({ text: char, ruby: null })) }
  }

  const word = Array.from(vol)
  const reading = Array.from(japanese)
  const tokens = []
  let i = 0
  let j = 0

  while (i < word.length) {
    if (isKana(word[i])) {
      if (j >= reading.length || normalizeKana(word[i]) !== normalizeKana(reading[j])) {
        return fallback(vol, japanese)
      }
      tokens.push({ text: word[i], ruby: null })
      i += 1
      j += 1
      continue
    }

    let end = i
    while (end < word.length && !isKana(word[end])) end += 1
    const run = word.slice(i, end).join('')

    if (end === word.length) {
      if (j >= reading.length) return fallback(vol, japanese)
      tokens.push({ text: run, ruby: reading.slice(j).join('') })
      j = reading.length
      i = end
      continue
    }

    const nextOkurigana = normalizeKana(word[end])
    let stop = -1
    for (let p = j; p < reading.length; p += 1) {
      if (normalizeKana(reading[p]) === nextOkurigana) {
        stop = p
        break
      }
    }
    if (stop <= j) return fallback(vol, japanese)

    tokens.push({ text: run, ruby: reading.slice(j, stop).join('') })
    j = stop
    i = end
  }

  if (j !== reading.length) return fallback(vol, japanese)
  return { ok: true, tokens }
}
