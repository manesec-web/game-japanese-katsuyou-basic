import { describe, expect, it } from 'vitest'
import { IRREGULAR_HINT, SAME_FORM_HINT, deriveChange } from './rule-demo.js'

function d(from, to, fromId = 'masu-form', toId = 'dictionary-form') {
  return deriveChange({ from, to, fromId, toId })
}

describe('deriveChange: godan (五段)', () => {
  it('keeps the changing kana and swaps only the 語尾 (ます → 字典, み → む)', () => {
    const result = d(
      { vol: '読みます', japanese: 'よみます', group: '1' },
      { vol: '読む', japanese: 'よむ', group: '1' },
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'み → む',
      base: '読',
      fromChange: 'み',
      stem: '読み',
      removed: 'ます',
      changeFrom: 'み',
      changeTo: 'む',
      toChange: 'む',
      added: 'む',
      result: '読む',
    })
  })

  it('derives ます → ない with the added suffix', () => {
    const result = d(
      { vol: '読みます', japanese: 'よみます', group: '1' },
      { vol: '読まない', japanese: 'よまない', group: '1' },
      'masu-form', 'nai-form',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'み → ま',
      stem: '読み',
      removed: 'ます',
      changeFrom: 'み',
      changeTo: 'ま',
      added: 'まない',
      result: '読まない',
    })
  })

  it('derives the reverse 字典 → ます (む → み, added みます)', () => {
    const result = d(
      { vol: '読む', japanese: 'よむ', group: '1' },
      { vol: '読みます', japanese: 'よみます', group: '1' },
      'dictionary-form', 'masu-form',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'む → み',
      stem: '読む',
      removed: 'む',
      changeFrom: 'む',
      changeTo: 'み',
      added: 'みます',
      result: '読みます',
    })
  })

  it('splits the vol at the okurigana even with a kanji stem', () => {
    const result = d(
      { vol: '行きます', japanese: 'いきます', group: '1' },
      { vol: '行く', japanese: 'いく', group: '1' },
    )
    expect(result).toMatchObject({
      kind: 'godan',
      stem: '行き',
      removed: 'ます',
      changeFrom: 'き',
      changeTo: 'く',
      result: '行く',
    })
  })

  it('handles 帰ります → 帰る (the look-like-ichidan case)', () => {
    const result = d(
      { vol: '帰ります', japanese: 'かえります', group: '1' },
      { vol: '帰る', japanese: 'かえる', group: '1' },
    )
    expect(result).toMatchObject({
      kind: 'godan',
      reason: 'り → る',
      stem: '帰り',
      removed: 'ます',
      result: '帰る',
    })
  })

  it('derives す-ending ます → て with no kana change (し stays)', () => {
    const result = d(
      { vol: '話します', japanese: 'はなします', group: '1' },
      { vol: '話して', japanese: 'はなして', group: '1' },
      'masu-form', 'te-form',
    )
    expect(result).toMatchObject({
      kind: 'godan',
      base: '話し',
      fromChange: null,
      removed: 'ます',
      changeFrom: null,
      changeTo: null,
      toChange: null,
      added: 'て',
      result: '話して',
    })
  })

  it('shows う → わ for a う-ending ない形', () => {
    const result = d(
      { vol: '買う', japanese: 'かう', group: '1' },
      { vol: '買わない', japanese: 'かわない', group: '1' },
      'dictionary-form', 'nai-form',
    )
    expect(result.reason).toContain('わない')
    expect(result.result).toBe('買わない')
  })
})

describe('deriveChange: addition, deletion, identical forms', () => {
  it('derives a pure addition (ません → ませんでした)', () => {
    const result = d(
      { vol: '買いません', japanese: 'かいません', group: '1' },
      { vol: '買いませんでした', japanese: 'かいませんでした', group: '1' },
      'masu-form-negative', 'masu-form-past-negative',
    )
    expect(result).toMatchObject({ kind: 'godan', reason: '直接加「でした」', added: 'でした', result: '買いませんでした' })
  })

  it('derives a pure deletion (ませんでした → ません)', () => {
    const result = d(
      { vol: '買いませんでした', japanese: 'かいませんでした', group: '1' },
      { vol: '買いません', japanese: 'かいません', group: '1' },
      'masu-form-past-negative', 'masu-form-negative',
    )
    expect(result).toMatchObject({ kind: 'godan', reason: '去掉「でした」', removed: 'でした', result: '買いません' })
  })

  it('derives identical forms (一段 可能形 = 受身形)', () => {
    const result = d(
      { vol: '食べられる', japanese: 'たべられる', group: '2' },
      { vol: '食べられる', japanese: 'たべられる', group: '2' },
      'potential-form', 'passive-form',
    )
    expect(result).toMatchObject({ kind: 'same', reason: SAME_FORM_HINT, result: '食べられる' })
  })
})

describe('deriveChange: ichidan (一段)', () => {
  it('derives ます → 字典', () => {
    const result = d(
      { vol: '食べます', japanese: 'たべます', group: '2' },
      { vol: '食べる', japanese: 'たべる', group: '2' },
    )
    expect(result).toMatchObject({
      kind: 'ichidan',
      reason: '去掉「ます」，直接加「る」',
      base: '食べ',
      fromChange: null,
      stem: '食べ',
      removed: 'ます',
      toChange: null,
      added: 'る',
      result: '食べる',
    })
    expect(result.changeFrom).toBeNull()
  })

  it('derives the reverse 字典 → ます', () => {
    const result = d(
      { vol: '食べる', japanese: 'たべる', group: '2' },
      { vol: '食べます', japanese: 'たべます', group: '2' },
      'dictionary-form', 'masu-form',
    )
    expect(result).toMatchObject({
      kind: 'ichidan',
      reason: '去掉「る」，直接加「ます」',
      stem: '食べ',
      removed: 'る',
      added: 'ます',
      result: '食べます',
    })
  })
})

describe('deriveChange: irregular (不規則 / 例外)', () => {
  it('returns the hint for します → する', () => {
    const result = d(
      { vol: 'します', japanese: 'します', group: '3' },
      { vol: 'する', japanese: 'する', group: '3' },
    )
    expect(result).toMatchObject({ kind: 'irregular', reason: IRREGULAR_HINT })
  })

  it('returns the hint for きます → くる', () => {
    const result = d(
      { vol: 'きます', japanese: 'きます', group: '3' },
      { vol: 'くる', japanese: 'くる', group: '3' },
    )
    expect(result).toMatchObject({ kind: 'irregular', reason: IRREGULAR_HINT })
  })

  it('returns the hint for 例外 (group 0)', () => {
    const result = d(
      { vol: 'あります', japanese: 'あります', group: '0' },
      { vol: 'ある', japanese: 'ある', group: '0' },
    )
    expect(result).toMatchObject({ kind: 'irregular', reason: IRREGULAR_HINT })
  })
})

describe('deriveChange: fallbacks', () => {
  it('returns null for a missing form', () => {
    expect(d(null, { vol: '読む', japanese: 'よむ', group: '1' })).toBeNull()
    expect(d({ vol: '読みます', japanese: 'よみます', group: '1' }, null)).toBeNull()
  })

  it('returns null for an empty reading', () => {
    expect(d({ vol: '読む', japanese: '', group: '1' }, { vol: '読まない', japanese: 'よまない', group: '1' })).toBeNull()
  })

  it('returns null for an unknown group', () => {
    expect(d({ vol: 'A', japanese: 'あ', group: '9' }, { vol: 'B', japanese: 'い', group: '9' })).toBeNull()
  })

  it('returns null when the readings share no prefix', () => {
    expect(d({ vol: '読む', japanese: 'あ', group: '1' }, { vol: '読まない', japanese: 'い', group: '1' })).toBeNull()
  })
})
