// Pure quiz helpers: answer normalization, grading, and keyboard generation.

const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const KATAKANA_TO_HIRAGANA = 0x60

// Hiragana available as distractor keys: seion, dakuten, handakuten, small
// kana listed in the spec, ん, and the long-vowel mark.
const KANA_POOL = Array.from(
  new Set(
    Array.from(
      'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
        'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ' +
        'ゃゅょぁぃぅぇぉっ' +
        'ー',
    ),
  ),
)

export function toHiragana(text) {
  return Array.from(String(text ?? ''))
    .map((char) => {
      const code = char.codePointAt(0)
      if (code >= KATAKANA_START && code <= KATAKANA_END) {
        return String.fromCodePoint(code - KATAKANA_TO_HIRAGANA)
      }
      return char
    })
    .join('')
}

// NFKC, drop all whitespace, and treat katakana as hiragana.
export function normalizeAnswer(text) {
  return toHiragana(String(text ?? '').normalize('NFKC').replace(/\s+/g, ''))
}

export function isCorrect(input, form) {
  const answer = normalizeAnswer(input)
  if (answer === '') return false
  return answer === normalizeAnswer(form.japanese) || answer === normalizeAnswer(form.vol)
}

// Build a keyboard for the reading. 25 keys minimum, 5 per row, growing for
// readings with more than 25 distinct characters. Every distinct reading
// character is a key; the rest are unique random hiragana; then shuffle.
export function buildKeyboard(reading, random = Math.random) {
  const readingChars = Array.from(toHiragana(reading))
  const distinct = [...new Set(readingChars)]
  const size = Math.max(25, Math.ceil(distinct.length / 5) * 5)

  const keys = [...distinct]
  const pool = KANA_POOL.filter((char) => !keys.includes(char))
  while (keys.length < size && pool.length > 0) {
    const index = Math.floor(random() * pool.length)
    keys.push(pool.splice(index, 1)[0])
  }
  while (keys.length < size) keys.push('あ')

  for (let i = keys.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = keys[i]
    keys[i] = keys[j]
    keys[j] = swap
  }
  return keys
}

// How many misses on one item reveal the answer. The quiz setting holds 1–5
// and defaults to 3.
export const DEFAULT_REVEAL_AFTER = 3
export const REVEAL_CHOICES = [1, 2, 3, 4, 5]

export function isValidRevealAfter(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function revealAfterFor(settings) {
  const value = settings?.revealAfter
  return isValidRevealAfter(value) ? value : DEFAULT_REVEAL_AFTER
}

export function shouldReveal(wrong, revealAfter = DEFAULT_REVEAL_AFTER) {
  return wrong >= revealAfter
}

// How many more misses the user may take on this item.
export function missesUntilReveal(wrong, revealAfter = DEFAULT_REVEAL_AFTER) {
  return Math.max(0, revealAfter - wrong)
}

// Copy shown after a miss, before the answer is revealed.
export function missHint(wrong, revealAfter = DEFAULT_REVEAL_AFTER) {
  const left = missesUntilReveal(wrong, revealAfter)
  if (left <= 0) return null
  return `再答錯 ${left} 題就顯示答案`
}

export function questionFor(formName, targetForm) {
  if (targetForm === 'dictionary-form') return '原型是什麼？'
  return `${formName}是什麼？`
}
