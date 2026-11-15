import { describe, expect, it } from 'vitest'
import { katakanaToHiragana, normalizeProlonged, romajiToKana } from './romaji.js'

describe('romajiToKana', () => {
  it('converts the example queries', () => {
    expect(romajiToKana('dekimasu')).toBe('できます')
    expect(romajiToKana('deki')).toBe('でき')
  })

  it('converts plain syllables', () => {
    expect(romajiToKana('taberu')).toBe('たべる')
    expect(romajiToKana('iku')).toBe('いく')
    expect(romajiToKana('kaerimasu')).toBe('かえります')
  })

  it('handles the digraphs', () => {
    expect(romajiToKana('kyou')).toBe('きょう')
    expect(romajiToKana('shinai')).toBe('しない')
    expect(romajiToKana('chigau')).toBe('ちがう')
    expect(romajiToKana('jisho')).toBe('じしょ')
  })

  it('handles macrons by expanding them to plain vowels', () => {
    expect(romajiToKana('kyō')).toBe('きょう')
    expect(romajiToKana('tōkyō')).toBe('とうきょう')
    expect(romajiToKana('gakkō')).toBe('がっこう')
  })

  it('handles the small つ (doubled consonants)', () => {
    expect(romajiToKana('itta')).toBe('いった')
    expect(romajiToKana('katte')).toBe('かって')
    expect(romajiToKana('gakkou')).toBe('がっこう')
    expect(romajiToKana('issho')).toBe('いっしょ')
    expect(romajiToKana('matcha')).toBe('まっちゃ')
    expect(romajiToKana('mittsu')).toBe('みっつ')
    expect(romajiToKana('yappari')).toBe('やっぱり')
  })

  it('turns ん before a consonant or at the end into ん', () => {
    expect(romajiToKana('kin')).toBe('きん')
    expect(romajiToKana('denwa')).toBe('でんわ')
    expect(romajiToKana('shinbun')).toBe('しんぶん')
    expect(romajiToKana('onna')).toBe('おんな')
  })

  it('keeps n before a vowel as the n-row syllable', () => {
    expect(romajiToKana('kinai')).toBe('きない')
    expect(romajiToKana('neru')).toBe('ねる')
  })

  it('passes unrecognised Latin through after the recognised prefix', () => {
    expect(romajiToKana('dek')).toBe('でk')
    expect(romajiToKana('abc')).toBe('あbc')
  })

  it('lowercases the input', () => {
    expect(romajiToKana('DEKIMASU')).toBe('できます')
  })
})

describe('katakanaToHiragana', () => {
  it('leaves hiragana and kanji alone', () => {
    expect(katakanaToHiragana('行きます')).toBe('行きます')
  })

  it('converts katakana, leaving ー for the prolonged-vowel step', () => {
    expect(katakanaToHiragana('コピーする')).toBe('こぴーする')
  })
})

describe('normalizeProlonged', () => {
  it('replaces ー with the previous character vowel', () => {
    expect(normalizeProlonged('こぴーする')).toBe('こぴいする')
  })

  it('works on a loan word after katakana→hiragana', () => {
    expect(normalizeProlonged(katakanaToHiragana('コピーする'))).toBe('こぴいする')
  })

  it('leaves text without ー unchanged', () => {
    expect(normalizeProlonged('いきます')).toBe('いきます')
  })

  it('keeps a leading ー as-is', () => {
    expect(normalizeProlonged('ーあ')).toBe('ーあ')
  })
})
