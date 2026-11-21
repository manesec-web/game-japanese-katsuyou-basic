import { describe, expect, it } from 'vitest'
import {
  RULE_TIPS,
  exampleGroups,
  exampleRows,
  exampleVerb,
  findRule,
  missingPairs,
  ruleTitle,
  targetFormIds,
} from './rule.js'
import { RULE_CONTENT } from '../data/rule-content.js'

describe('ruleTitle', () => {
  it('names the two forms in the heading', () => {
    expect(ruleTitle('masu-form', 'dictionary-form')).toBe('從 ます形 到 辭書形 的變形如下')
    expect(ruleTitle('dictionary-form', 'te-form')).toBe('從 辭書形 到 て形 的變形如下')
  })

  it('returns an empty string for an unknown form', () => {
    expect(ruleTitle('nope', 'dictionary-form')).toBe('')
  })
})

describe('targetFormIds', () => {
  it('lists every form except 從', () => {
    const ids = targetFormIds('masu-form')
    expect(ids).toHaveLength(14)
    expect(ids).not.toContain('masu-form')
    expect(ids).toContain('dictionary-form')
  })
})

describe('findRule / missingPairs', () => {
  it('finds entries in both directions', () => {
    expect(findRule(RULE_CONTENT, 'masu-form', 'dictionary-form')).toBeTruthy()
    expect(findRule(RULE_CONTENT, 'dictionary-form', 'masu-form')).toBeTruthy()
    expect(findRule(RULE_CONTENT, 'nope', 'dictionary-form')).toBeNull()
  })

  it('has an entry for every ordered pair with 從 ≠ 到', () => {
    expect(RULE_CONTENT).toHaveLength(210)
    expect(missingPairs(RULE_CONTENT)).toEqual([])
  })
})

describe('exampleVerb', () => {
  const verbA = { 'dictionary-form': { vol: 'A' } }
  const verbB = { 'dictionary-form': { vol: 'B' } }
  const library = {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) => (lesson === 2 ? [verbA, verbB].map((verb) => ({ lesson, verb })) : [])),
    verbLessons: () => [2],
  }

  it('resolves a valid reference', () => {
    expect(exampleVerb(library, { lesson: 2, index: 1 })).toEqual({ lesson: 2, verb: verbB })
  })

  it('returns null for a missing or non-integer reference', () => {
    expect(exampleVerb(library, { lesson: 2, index: 5 })).toBeNull()
    expect(exampleVerb(library, { lesson: 9, index: 0 })).toBeNull()
    expect(exampleVerb(library, { lesson: 2, index: '1' })).toBeNull()
    expect(exampleVerb(library, null)).toBeNull()
  })
})

describe('exampleRows / exampleGroups', () => {
  const verbA = {
    'dictionary-form': { vol: '食べる', japanese: 'たべる' },
    'masu-form': { vol: '食べます', japanese: 'たべます' },
  }
  const verbB = {
    'dictionary-form': { vol: '飲む', japanese: 'のむ' },
    'masu-form': { vol: '飲みます', japanese: 'のみます' },
  }
  const library = {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) => {
        if (lesson === 2) return [verbA, verbB].map((verb) => ({ lesson, verb }))
        if (lesson === 5) return [verbA].map((verb) => ({ lesson, verb }))
        return []
      }),
    verbLessons: () => [2, 5],
  }

  it('lists every verb once, in lesson then JSON order', () => {
    const rows = exampleRows(library)
    expect(rows).toEqual([
      { lesson: 2, index: 0, verb: verbA },
      { lesson: 2, index: 1, verb: verbB },
      { lesson: 5, index: 0, verb: verbA },
    ])
  })

  it('groups by lesson and keeps the full word when the query is empty', () => {
    const groups = exampleGroups(exampleRows(library))
    expect(groups.map((group) => group.lesson)).toEqual([2, 5])
    expect(groups[0].rows).toHaveLength(2)
    expect(groups[0].rows[0].parts).toEqual([{ text: '食べる', highlight: false }])
  })

  it('shows the requested 從 form, not always the dictionary form', () => {
    const groups = exampleGroups(exampleRows(library), '', 'masu-form')
    expect(groups[0].rows[0].parts).toEqual([{ text: '食べます', highlight: false }])
    expect(groups[0].rows[1].parts).toEqual([{ text: '飲みます', highlight: false }])
  })

  it('filters by the word and paints the match red', () => {
    const groups = exampleGroups(exampleRows(library), '食べ')
    expect(groups).toHaveLength(2)
    expect(groups[0].rows).toHaveLength(1)
    expect(groups[0].rows[0].parts).toEqual([
      { text: '食べ', highlight: true },
      { text: 'る', highlight: false },
    ])
  })

  it('matches the reading and maps it back onto the word', () => {
    const groups = exampleGroups(exampleRows(library), 'た')
    expect(groups).toHaveLength(2)
    expect(groups[0].rows[0].parts).toEqual([
      { text: '食', highlight: true },
      { text: 'べる', highlight: false },
    ])
  })

  it('matches the lesson number with no painted text', () => {
    const groups = exampleGroups(exampleRows(library), '5')
    expect(groups).toHaveLength(1)
    expect(groups[0].lesson).toBe(5)
    expect(groups[0].rows[0].parts).toEqual([{ text: '食べる', highlight: false }])
  })

  it('returns no group when nothing matches', () => {
    expect(exampleGroups(exampleRows(library), 'zzz')).toEqual([])
  })
})

describe('RULE_TIPS', () => {
  it('explains the mechanism, the 段 mnemonic and the special cases', () => {
    const text = RULE_TIPS.join(' ')
    expect(text).toContain('原理')
    expect(text).toContain('一個語幹，五個段')
    expect(text).toContain('買う → 買わない')
    expect(text).toContain('行った／行って')
    expect(text).toContain('帰る')
    expect(text).toContain('勉強できる')
  })

  it('is a plain numbered list of strings', () => {
    expect(RULE_TIPS.length).toBe(7)
    expect(RULE_TIPS.every((tip) => typeof tip === 'string')).toBe(true)
  })
})
