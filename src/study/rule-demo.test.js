import { describe, expect, it } from 'vitest'
import { IRREGULAR_HINT, SAME_FORM_HINT, deriveChange } from './rule-demo.js'

// The derivation now takes the form ids and the dictionary ending, so it uses
// the exact 段 / 音便 tables instead of guessing from a shared prefix.
function d(from, to, fromId = 'masu-form', toId = 'dictionary-form', ending = 'む') {
  return deriveChange({ from, to, fromId, toId, ending })
}

function godan(vol, kana) {
  return { vol, japanese: kana, group: '1' }
}

describe('deriveChange: godan (五段)', () => {
  it('keeps the changing kana and swaps only the 語尾 (ます → 字典, み → む)', () => {
    const result = d(
      godan('読みます', 'よみます'),
      godan('読む', 'よむ'),
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'み → む',
      base: '読',
      fromChange: 'み',
      removed: 'ます',
      changeFrom: 'み',
      changeTo: 'む',
      added: '',
      toChange: 'む',
      result: '読む',
    })
  })

  it('derives ます → ない with the whole new ending', () => {
    const result = d(
      godan('読みます', 'よみます'),
      godan('読まない', 'よまない'),
      'masu-form', 'nai-form',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'み → ま，加「ない」',
      base: '読',
      fromChange: 'み',
      removed: 'ます',
      added: 'ない',
      toChange: 'ま',
      result: '読まない',
    })
  })

  it('derives the reverse 字典 → ます (む → み, added みます)', () => {
    const result = d(
      godan('読む', 'よむ'),
      godan('読みます', 'よみます'),
      'dictionary-form', 'masu-form',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'む → み，加「ます」',
      base: '読',
      fromChange: 'む',
      removed: '',
      changeFrom: 'む',
      changeTo: 'み',
      added: 'ます',
      toChange: 'み',
      result: '読みます',
    })
  })

  it('splits the vol at the okurigana even with a kanji stem', () => {
    const result = d(
      godan('行きます', 'いきます'),
      godan('行く', 'いく'),
      'masu-form', 'dictionary-form', 'く',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      fromChange: 'き',
      removed: 'ます',
      changeFrom: 'き',
      changeTo: 'く',
      result: '行く',
    })
  })

  it('handles 帰ります → 帰る (the look-like-ichidan case)', () => {
    const result = d(
      godan('帰ります', 'かえります'),
      godan('帰る', 'かえる'),
      'masu-form', 'dictionary-form', 'る',
    )
    expect(result).toMatchObject({ kind: 'godan', reason: 'り → る', result: '帰る' })
  })

  it('derives す-ending ます → て with no kana change (し stays)', () => {
    const result = d(
      godan('話します', 'はなします'),
      godan('話して', 'はなして'),
      'masu-form', 'te-form', 'す',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      base: '話し',
      fromChange: null,
      removed: 'ます',
      changeFrom: null,
      changeTo: null,
      added: 'て',
      result: '話して',
    })
    expect(result.reason).toBe('去掉「ます」，直接加「て」')
  })

  it('shows う → わ for a う-ending ない形', () => {
    const result = d(
      godan('買う', 'かう'),
      godan('買わない', 'かわない'),
      'dictionary-form', 'nai-form', 'う',
    )
    expect(result.reason).toBe('う → わ，加「ない」')
    expect(result.added).toBe('ない')
    expect(result.toChange).toBe('わ')
    expect(result.result).toBe('買わない')
  })

  // Regression: the changed row kana must not also be printed as a newly
  // attached 語尾. 泳ぎます → 泳ぐ is 「ぎ → ぐ」 with no 「＋ ぐ」 line.
  it('does not repeat the changed kana in the ＋ line (泳ぎます → 泳ぐ)', () => {
    const result = d(
      godan('泳ぎます', 'およぎます'),
      godan('泳ぐ', 'およぐ'),
      'masu-form', 'dictionary-form', 'ぐ',
    )
    expect(result.kind).toBe('godan')
    expect(result.reason).toBe('ぎ → ぐ')
    expect(result.base).toBe('泳')
    expect(result.fromChange).toBe('ぎ')
    expect(result.removed).toBe('ます')
    expect(result.changeFrom).toBe('ぎ')
    expect(result.changeTo).toBe('ぐ')
    expect(result.added).toBe('')
    expect(result.toChange).toBe('ぐ')
    expect(result.result).toBe('泳ぐ')
    expect(result.base + result.toChange + result.added).toBe('泳ぐ')
  })

  it('keeps a real newly attached 語尾 when the kana also changes (泳ぎます → 泳がない)', () => {
    const result = d(
      godan('泳ぎます', 'およぎます'),
      godan('泳がない', 'およがない'),
      'masu-form', 'nai-form', 'ぐ',
    )
    expect(result.reason).toBe('ぎ → が，加「ない」')
    expect(result.added).toBe('ない')
    expect(result.toChange).toBe('が')
    expect(result.result).toBe('泳がない')
  })

  // Regression: the old longest-common-prefix code cut into shared suffix
  // characters, producing 「洗いますす / す → し / ＋ した」. The two forms
  // must now read as 洗い + ます → ました.
  it('does not invent a kana change when ます and ました share only ま', () => {
    const result = d(
      godan('洗います', 'あらいます'),
      godan('洗いました', 'あらいました'),
      'masu-form', 'masu-form-past', 'う',
    )
    expect(result.kind).toBe('godan')
    expect(result.base).toBe('洗い')
    expect(result.fromChange).toBeNull()
    expect(result.changeFrom).toBeNull()
    expect(result.changeTo).toBeNull()
    expect(result.removed).toBe('ます')
    expect(result.added).toBe('ました')
    expect(result.reason).toBe('去掉「ます」，直接加「ました」')
    expect(result.result).toBe('洗いました')
    expect(result.base + (result.fromChange ?? '') + result.removed).toBe('洗います')
  })
})

describe('deriveChange: addition, deletion, identical forms', () => {
  it('keeps a whole shared 語尾 (ません → ませんでした)', () => {
    const result = d(
      godan('買いません', 'かいません'),
      godan('買いませんでした', 'かいませんでした'),
      'masu-form-negative', 'masu-form-past-negative', 'う',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: '直接加「でした」',
      base: '買いません',
      removed: '',
      added: 'でした',
      result: '買いませんでした',
    })
  })

  it('derives a pure deletion (ませんでした → ません)', () => {
    const result = d(
      godan('買いませんでした', 'かいませんでした'),
      godan('買いません', 'かいません'),
      'masu-form-past-negative', 'masu-form-negative', 'う',
    )
    expect(result).toMatchObject({ kind: 'godan', reason: '去掉「でした」', removed: 'でした', result: '買いません' })
  })

  it('derives identical forms (一段 可能形 = 受身形)', () => {
    const result = deriveChange({
      from: { vol: '食べられる', japanese: 'たべられる', group: '2' },
      to: { vol: '食べられる', japanese: 'たべられる', group: '2' },
      fromId: 'potential-form', toId: 'passive-form', ending: 'る',
    })
    expect(result).toMatchObject({ kind: 'same', reason: SAME_FORM_HINT, result: '食べられる' })
  })
})

describe('deriveChange: ichidan (一段)', () => {
  it('derives ます → 字典', () => {
    const result = deriveChange({
      from: { vol: '食べます', japanese: 'たべます', group: '2' },
      to: { vol: '食べる', japanese: 'たべる', group: '2' },
      fromId: 'masu-form', toId: 'dictionary-form', ending: 'る',
    })
    expect(result).toMatchObject({
      kind: 'ichidan',
      reason: '去掉「ます」，直接加「る」',
      base: '食べ',
      fromChange: null,
      removed: 'ます',
      added: 'る',
      result: '食べる',
    })
  })

  it('derives the reverse 字典 → ます', () => {
    const result = deriveChange({
      from: { vol: '食べる', japanese: 'たべる', group: '2' },
      to: { vol: '食べます', japanese: 'たべます', group: '2' },
      fromId: 'dictionary-form', toId: 'masu-form', ending: 'る',
    })
    expect(result).toMatchObject({
      kind: 'ichidan',
      reason: '去掉「る」，直接加「ます」',
      base: '食べ',
      removed: 'る',
      added: 'ます',
      result: '食べます',
    })
  })
})

describe('deriveChange: irregular (不規則 / 例外)', () => {
  it('returns the hint for します → する', () => {
    expect(d({ vol: 'します', japanese: 'します', group: '3' }, { vol: 'する', japanese: 'する', group: '3' }))
      .toMatchObject({ kind: 'irregular', reason: IRREGULAR_HINT })
  })

  it('returns the hint for きます → くる', () => {
    expect(d({ vol: 'きます', japanese: 'きます', group: '3' }, { vol: 'くる', japanese: 'くる', group: '3' }))
      .toMatchObject({ kind: 'irregular', reason: IRREGULAR_HINT })
  })

  it('returns the hint for 例外 (group 0)', () => {
    expect(d({ vol: 'あります', japanese: 'あります', group: '0' }, { vol: 'ある', japanese: 'ある', group: '0' }))
      .toMatchObject({ kind: 'irregular', reason: IRREGULAR_HINT })
  })
})

describe('deriveChange: fallbacks', () => {
  it('returns null for a missing form', () => {
    expect(deriveChange({ from: null, to: godan('読む', 'よむ') })).toBeNull()
    expect(deriveChange({ from: godan('読みます', 'よみます'), to: null })).toBeNull()
  })

  it('returns null for an empty reading', () => {
    expect(d(godan('読む', ''), godan('読まない', 'よまない'))).toBeNull()
  })

  it('returns null for an unknown group', () => {
    expect(d({ vol: 'A', japanese: 'あ', group: '9' }, { vol: 'B', japanese: 'い', group: '9' })).toBeNull()
  })

  it('falls back to the plain pair when the words do not fit the tables', () => {
    const result = d(
      godan('見える', 'みえる'),
      godan('見た', 'みた'),
      'potential-form', 'ta-form', 'る',
    )
    expect(result.kind).toBe('plain')
    expect(result.result).toBe('見た')
    expect(result.base).toBe('見える')
    expect(result.removed).toBe('')
  })
})
