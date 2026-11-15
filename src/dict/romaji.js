// Hepburn romaji → hiragana, and the small kana normalisations the 單詞目錄
// search needs. The dictionary stores every form's reading as `japanese`
// (kana, sometimes katakana for loan words), and the search accepts a query
// that is a fragment of either the displayed word or that reading — so a
// Latin query like `dekimasu` must be turned into `できます` before it can be
// matched against the reading.

// One romaji syllable (longest first, so `shi` wins over `s`+`hi` and `kyo`
// wins over `k`+`yo`).
const SYLLABLES = [
  ['kya', 'きゃ'], ['kyu', 'きゅ'], ['kyo', 'きょ'],
  ['gya', 'ぎゃ'], ['gyu', 'ぎゅ'], ['gyo', 'ぎょ'],
  ['sha', 'しゃ'], ['shu', 'しゅ'], ['sho', 'しょ'],
  ['cha', 'ちゃ'], ['chu', 'ちゅ'], ['cho', 'ちょ'],
  ['nya', 'にゃ'], ['nyu', 'にゅ'], ['nyo', 'にょ'],
  ['hya', 'ひゃ'], ['hyu', 'ひゅ'], ['hyo', 'ひょ'],
  ['bya', 'びゃ'], ['byu', 'びゅ'], ['byo', 'びょ'],
  ['pya', 'ぴゃ'], ['pyu', 'ぴゅ'], ['pyo', 'ぴょ'],
  ['mya', 'みゃ'], ['myu', 'みゅ'], ['myo', 'みょ'],
  ['rya', 'りゃ'], ['ryu', 'りゅ'], ['ryo', 'りょ'],
  ['jya', 'じゃ'], ['jyu', 'じゅ'], ['jyo', 'じょ'],
  ['shi', 'し'], ['chi', 'ち'], ['tsu', 'つ'], ['fu', 'ふ'],
  ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'],
  ['ga', 'が'], ['gi', 'ぎ'], ['gu', 'ぐ'], ['ge', 'げ'], ['go', 'ご'],
  ['sa', 'さ'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
  ['za', 'ざ'], ['ji', 'じ'], ['zu', 'ず'], ['ze', 'ぜ'], ['zo', 'ぞ'],
  ['ta', 'た'], ['te', 'て'], ['to', 'と'],
  ['da', 'だ'], ['di', 'ぢ'], ['du', 'づ'], ['de', 'で'], ['do', 'ど'],
  ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
  ['ha', 'は'], ['hi', 'ひ'], ['he', 'へ'], ['ho', 'ほ'],
  ['ba', 'ば'], ['bi', 'び'], ['bu', 'ぶ'], ['be', 'べ'], ['bo', 'ぼ'],
  ['pa', 'ぱ'], ['pi', 'ぴ'], ['pu', 'ぷ'], ['pe', 'ぺ'], ['po', 'ぽ'],
  ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'],
  ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
  ['wa', 'わ'], ['wo', 'を'],
  ['ja', 'じゃ'], ['ju', 'じゅ'], ['jo', 'じょ'],
  ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お'],
]

// A macron is one Latin character for a long vowel. It is expanded to the
// plain letters first, so `kyō` → `kyou` → きょう and `gakkō` → がっこう.
// (Hepburn writes both おう and おお as `ō`; the common おう spelling is used,
// and `oo` still covers おお.)
const MACRONS = { ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ei', ō: 'ou' }

// A doubled consonant (small つ) in Hepburn. `n` is deliberately absent: a
// doubled n is ん + n (おんな `onna`), never っ.
const SOKUON = new Set('kgsztdhbprmf')

function expandMacrons(text) {
  return Array.from(text)
    .map((char) => MACRONS[char] ?? char)
    .join('')
}

export function romajiToKana(input) {
  const text = expandMacrons(String(input ?? '').toLowerCase()).replace(/'/g, '')
  let out = ''
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    const char = text[i]

    // `cch` / `tch` double the `ch` syllable: emit the small つ and let the
    // next pass match `chi` / `cha` / `chu` / `cho`.
    if (rest.startsWith('cch') || rest.startsWith('tch')) {
      out += 'っ'
      i += 1
      continue
    }

    // Any other doubled consonant is the small つ; one copy is consumed here
    // and the remaining copy is matched as a normal syllable next (so `ttsu`
    // → っ + つ and `kkya` → っ + きゃ).
    if (SOKUON.has(char) && text[i + 1] === char) {
      out += 'っ'
      i += 1
      continue
    }

    const syllable = SYLLABLES.find(([rom]) => rest.startsWith(rom))
    if (syllable) {
      out += syllable[1]
      i += syllable[0].length
      continue
    }

    // Reaching here with `n` means it is not followed by a vowel or `y` (those
    // are the na/ni/nu/ne/no and nya/nyu/nyo syllables above), so it is ん.
    if (char === 'n') {
      out += 'ん'
      i += 1
      continue
    }

    // Unrecognised Latin passes through, so a trailing half-syllable still
    // keeps the kana that was recognised before it.
    out += char
    i += 1
  }
  return out
}

export function katakanaToHiragana(text) {
  return Array.from(String(text ?? ''))
    .map((char) => {
      const code = char.codePointAt(0)
      if (code >= 0x30a1 && code <= 0x30f6) return String.fromCodePoint(code - 0x60)
      return char
    })
    .join('')
}

// The rows a katakana/kana character belongs to, used to turn ー (the long
// vowel mark) into the vowel of the character before it: コピーする →
// こぴいする, so `kopī` / `kopii` can find it.
const VOWEL_ROWS = [
  ['あ', 'あかがさざただなはばぱまやらわぁゃ'],
  ['い', 'いきぎしじちぢにひびぴみりぃ'],
  ['う', 'うくぐすずつづぬふぶぷむゆるぅゅっゔ'],
  ['え', 'えけげせぜてでねへべぺめれぇ'],
  ['お', 'おこごそとのほぼぽもよろをぉょ'],
]

function kanaVowel(char) {
  const hiragana = katakanaToHiragana(char)
  if (!hiragana) return null
  for (const [vowel, row] of VOWEL_ROWS) {
    if (row.includes(hiragana)) return vowel
  }
  return null
}

export function normalizeProlonged(text) {
  const chars = Array.from(String(text ?? ''))
  return chars
    .map((char, index) => {
      if (char !== 'ー') return char
      const previous = index > 0 ? chars[index - 1] : ''
      return kanaVowel(previous) ?? 'ー'
    })
    .join('')
}
