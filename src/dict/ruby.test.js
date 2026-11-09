import { describe, expect, it } from 'vitest'
import { alignReading } from './ruby.js'

function joined(tokens) {
  return tokens.map((token) => token.text).join('')
}

function rubyOf(tokens, text) {
  return tokens.find((token) => token.text === text)?.ruby ?? null
}

describe('alignReading', () => {
  it('aligns 置く / おく', () => {
    const result = alignReading('置く', 'おく')
    expect(result.ok).toBe(true)
    expect(joined(result.tokens)).toBe('置く')
    expect(rubyOf(result.tokens, '置')).toBe('お')
    expect(rubyOf(result.tokens, 'く')).toBeNull()
  })

  it('aligns 置きます / おきます', () => {
    const result = alignReading('置きます', 'おきます')
    expect(result.ok).toBe(true)
    expect(rubyOf(result.tokens, '置')).toBe('お')
    expect(result.tokens.filter((token) => token.ruby !== null)).toHaveLength(1)
    expect(joined(result.tokens)).toBe('置きます')
  })

  it('aligns 勉強する / べんきょうする', () => {
    const result = alignReading('勉強する', 'べんきょうする')
    expect(result.ok).toBe(true)
    expect(rubyOf(result.tokens, '勉強')).toBe('べんきょう')
    expect(rubyOf(result.tokens, 'する')).toBeNull()
  })

  it('keeps コピーする / コピーする as katakana without ruby', () => {
    const result = alignReading('コピーする', 'コピーする')
    expect(result.ok).toBe(true)
    expect(result.tokens.every((token) => token.ruby === null)).toBe(true)
    expect(joined(result.tokens)).toBe('コピーする')
  })

  it('aligns 持って行く / もっていく with two kanji runs', () => {
    const result = alignReading('持って行く', 'もっていく')
    expect(result.ok).toBe(true)
    expect(rubyOf(result.tokens, '持')).toBe('も')
    expect(rubyOf(result.tokens, '行')).toBe('い')
    expect(joined(result.tokens)).toBe('持って行く')
  })

  it('aligns 来ます / きます', () => {
    const result = alignReading('来ます', 'きます')
    expect(result.ok).toBe(true)
    expect(rubyOf(result.tokens, '来')).toBe('き')
    expect(rubyOf(result.tokens, 'ます')).toBeNull()
  })

  it('falls back to the full reading above the whole word on mismatch', () => {
    const result = alignReading('来ます', 'きません')
    expect(result.ok).toBe(false)
    expect(result.tokens).toEqual([{ text: '来ます', ruby: 'きません' }])
  })

  it('falls back when the reading runs out early', () => {
    const result = alignReading('食べる', 'た')
    expect(result.ok).toBe(false)
    expect(result.tokens).toEqual([{ text: '食べる', ruby: 'た' }])
  })

  it('handles an empty reading without inventing ruby', () => {
    const result = alignReading('する', '')
    expect(result.tokens).toEqual([
      { text: 'す', ruby: null },
      { text: 'る', ruby: null },
    ])
  })
})
