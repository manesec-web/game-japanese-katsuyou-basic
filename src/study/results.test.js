import { describe, expect, it } from 'vitest'
import {
  accuracy,
  bandEmojis,
  confettiPieces,
  CONFETTI_EMOJI,
  createResults,
  isPerfectScore,
  PRACTICE_EMOJI,
  practiceEmoji,
  recordCorrect,
  recordMiss,
  resolvedCount,
  SCORE_BANDS,
  scoreBand,
  scoreEmoji,
} from './results.js'

describe('results', () => {
  it('starts empty', () => {
    const results = createResults()
    expect(results).toEqual({ correct: 0, wrong: 0, misses: [] })
    expect(resolvedCount(results)).toBe(0)
    expect(accuracy(results)).toBe(0)
  })

  it('reports 100% when nothing was missed', () => {
    const results = createResults()
    recordCorrect(results)
    recordCorrect(results)
    recordCorrect(results)
    expect(resolvedCount(results)).toBe(3)
    expect(accuracy(results)).toBe(100)
  })

  it('reports 0% when every item was missed', () => {
    const results = createResults()
    recordMiss(results, { vol: 'A', formName: '字典形', answer: 'A' })
    recordMiss(results, { vol: 'B', formName: 'た形', answer: 'B-ta' })
    expect(results.wrong).toBe(2)
    expect(results.misses).toHaveLength(2)
    expect(accuracy(results)).toBe(0)
  })

  it('rounds the percentage to a whole number', () => {
    const results = createResults()
    recordCorrect(results)
    recordCorrect(results)
    recordMiss(results, { vol: 'C', formName: 'て形', answer: 'C-te' })
    expect(accuracy(results)).toBe(67)
  })

  it('keeps one miss per item, not one per wrong keystroke', () => {
    const results = createResults()
    recordMiss(results, { vol: 'A', formName: '字典形', answer: 'A' })
    expect(results.misses).toHaveLength(1)
  })
})

// A tiny deterministic generator for the picks below: seeds differ, sequences
// repeat for the same seed.
function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('scoreBand', () => {
  it('floors a percentage to its decade', () => {
    expect(scoreBand(0)).toBe(0)
    expect(scoreBand(9)).toBe(0)
    expect(scoreBand(10)).toBe(10)
    expect(scoreBand(87)).toBe(80)
    expect(scoreBand(89.9)).toBe(80)
    expect(scoreBand(90)).toBe(90)
    expect(scoreBand(99)).toBe(90)
    expect(scoreBand(100)).toBe(100)
  })

  it('keeps a value outside 0–100 inside the table', () => {
    expect(scoreBand(-5)).toBe(0)
    expect(scoreBand(140)).toBe(100)
    expect(scoreBand('nonsense')).toBe(0)
  })

  it('has a row for every decade', () => {
    expect(SCORE_BANDS.map((row) => row.percent)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ])
  })
})

describe('bandEmojis', () => {
  it('returns the row that matches the score', () => {
    expect(bandEmojis(0)).toEqual(['💀', '☠️', '😭', '🥲', '🫠'])
    expect(bandEmojis(87)).toEqual(['😍', '🥰', '💖', '💯', '🎯'])
    expect(bandEmojis(90)).toEqual(['🥳', '🎊', '🎉', '🏅', '🏆'])
    expect(bandEmojis(100)).toHaveLength(20)
    expect(bandEmojis(100)).toContain('👑')
    expect(bandEmojis(55)).toEqual(['🙂', '😊', '😌', '🌱', '✨'])
  })
})

describe('scoreEmoji', () => {
  it('always picks one emoji from the band', () => {
    for (const row of SCORE_BANDS) {
      const picked = scoreEmoji(row.percent, seeded(row.percent + 7))
      expect(typeof picked).toBe('string')
      expect(row.emojis).toContain(picked)
    }
  })

  it('picks from the row the floored score belongs to', () => {
    const picked = scoreEmoji(87, seeded(1))
    expect(bandEmojis(87)).toContain(picked)
  })

  it('samples the whole 100% row rather than its first five', () => {
    const seen = new Set()
    for (let seed = 1; seed <= 40; seed += 1) {
      seen.add(scoreEmoji(100, seeded(seed)))
    }
    expect(seen.size).toBeGreaterThan(5)
  })

  it('does not depend on the seed to stay inside the row', () => {
    const lazy = () => 0.99
    expect(scoreEmoji(60, lazy)).toBe('⭐')
  })
})

describe('practiceEmoji', () => {
  it('draws one of the three bowing figures', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      expect(PRACTICE_EMOJI).toContain(practiceEmoji(seeded(seed)))
    }
  })

  it('reaches all three', () => {
    const seen = new Set()
    for (let seed = 1; seed <= 20; seed += 1) seen.add(practiceEmoji(seeded(seed)))
    expect(seen.size).toBe(3)
  })
})

describe('isPerfectScore', () => {
  it('is true only at 100', () => {
    expect(isPerfectScore(100)).toBe(true)
    expect(isPerfectScore(99)).toBe(false)
  })
})

describe('confettiPieces', () => {
  it('builds stable pieces with emoji from the fanfare list', () => {
    const pieces = confettiPieces(5, seeded(3))
    expect(pieces).toHaveLength(5)
    for (const piece of pieces) {
      expect(CONFETTI_EMOJI).toContain(piece.emoji)
      expect(piece.left).toBeGreaterThanOrEqual(0)
      expect(piece.left).toBeLessThan(100)
      expect(piece.duration).toBeGreaterThan(2)
    }
  })

  it('places pieces across the width, not all in one column', () => {
    const lefts = new Set(confettiPieces(22, seeded(9)).map((piece) => piece.left))
    expect(lefts.size).toBeGreaterThan(10)
  })
})

