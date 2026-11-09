import { describe, expect, it } from 'vitest'
import {
  buildKeyboard,
  DEFAULT_REVEAL_AFTER,
  isCorrect,
  isValidRevealAfter,
  missHint,
  missesUntilReveal,
  normalizeAnswer,
  questionFor,
  revealAfterFor,
  REVEAL_CHOICES,
  shouldReveal,
} from './quiz.js'

function seeded(seed) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const form = {
  vol: '行く',
  japanese: 'いく',
}

describe('normalizeAnswer', () => {
  it('applies NFKC, removes whitespace, and converts katakana', () => {
    expect(normalizeAnswer(' ｲｸ ')).toBe('いく')
    expect(normalizeAnswer('い く')).toBe('いく')
    expect(normalizeAnswer('イク')).toBe('いく')
    expect(normalizeAnswer('　いく　')).toBe('いく')
  })
})

describe('isCorrect', () => {
  it('accepts the reading', () => {
    expect(isCorrect('いく', form)).toBe(true)
    expect(isCorrect('イク', form)).toBe(true)
    expect(isCorrect(' い く ', form)).toBe(true)
  })

  it('accepts the written form', () => {
    expect(isCorrect('行く', form)).toBe(true)
  })

  it('rejects an empty or different answer', () => {
    expect(isCorrect('', form)).toBe(false)
    expect(isCorrect('いきます', form)).toBe(false)
  })
})

describe('buildKeyboard', () => {
  it('contains every distinct character of the reading', () => {
    const keys = buildKeyboard('いく', seeded(1))
    for (const char of Array.from('いく')) {
      expect(keys).toContain(char)
    }
    expect(keys).toHaveLength(25)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps every character of a long mixed reading', () => {
    const reading = 'べんきょうする' // 7 distinct chars
    const keys = buildKeyboard(reading, seeded(7))
    for (const char of new Set(Array.from(reading))) expect(keys).toContain(char)
  })

  it('changes distractor arrangement with the seed', () => {
    const first = buildKeyboard('いく', seeded(1))
    const second = buildKeyboard('いく', seeded(2))
    expect(first).toHaveLength(second.length)
    expect(first).not.toEqual(second)
    for (const char of Array.from('いく')) expect(second).toContain(char)
  })

  it('grows beyond 25 keys when the reading needs more', () => {
    const reading = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめも'
    const distinct = new Set(Array.from(reading)).size
    const keys = buildKeyboard(reading, seeded(3))
    expect(distinct).toBeGreaterThan(25)
    expect(keys.length).toBeGreaterThanOrEqual(distinct)
    expect(keys.length % 5).toBe(0)
  })

  it('does not repeat reading characters among distractors', () => {
    const keys = buildKeyboard('いく', seeded(9))
    expect(new Set(keys).size).toBe(25)
  })
})

describe('questionFor', () => {
  it('asks 原型是什麼？ for the dictionary form', () => {
    expect(questionFor('字典形', 'dictionary-form')).toBe('原型是什麼？')
  })

  it('names the target form otherwise', () => {
    expect(questionFor('て形', 'te-form')).toBe('て形是什麼？')
  })
})

describe('reveal threshold', () => {
  it('offers 1 to 5 misses and defaults to 3', () => {
    expect(REVEAL_CHOICES).toEqual([1, 2, 3, 4, 5])
    expect(DEFAULT_REVEAL_AFTER).toBe(3)
    expect(revealAfterFor({})).toBe(3)
    expect(revealAfterFor({ revealAfter: 5 })).toBe(5)
    expect(revealAfterFor({ revealAfter: 0 })).toBe(3)
    expect(isValidRevealAfter('3')).toBe(false)
  })

  it('reveals exactly on the Xth miss', () => {
    expect(shouldReveal(1, 1)).toBe(true)
    expect(shouldReveal(0, 1)).toBe(false)
    expect(shouldReveal(2, 3)).toBe(false)
    expect(shouldReveal(3, 3)).toBe(true)
    expect(shouldReveal(4, 5)).toBe(false)
    expect(shouldReveal(5, 5)).toBe(true)
  })

  it('counts down the hint and stops at zero', () => {
    expect(missesUntilReveal(1, 3)).toBe(2)
    expect(missesUntilReveal(2, 3)).toBe(1)
    expect(missesUntilReveal(3, 3)).toBe(0)
    expect(missesUntilReveal(4, 5)).toBe(1)
    expect(missHint(1, 3)).toBe('再答錯 2 題就顯示答案')
    expect(missHint(4, 5)).toBe('再答錯 1 題就顯示答案')
    expect(missHint(3, 3)).toBe(null)
  })
})
