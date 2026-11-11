import { describe, expect, it } from 'vitest'
import { buildItems, isErrorUsageItem, reconcileQuizQueue } from './items.js'

function fakeLibrary(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
  }
}

const verbA = { id: 'a', 'dictionary-form': { vol: 'A' } }
const verbB = { id: 'b', 'dictionary-form': { vol: 'B' } }
const verbC = { id: 'c', 'dictionary-form': { vol: 'C' } }

describe('buildItems', () => {
  it('builds dictionary items in lesson order and JSON order', () => {
    const library = fakeLibrary({ 2: [verbA, verbB], 5: [verbC] })
    const items = buildItems('dict', library, { lessons: [2, 5] })
    expect(items.map((item) => item.verb.id)).toEqual(['a', 'b', 'c'])
    expect(items.map((item) => item.lesson)).toEqual([2, 2, 5])
  })

  it('crosses verbs with target forms, verb order first', () => {
    const library = fakeLibrary({ 2: [verbA, verbB] })
    const modeSettings = { lessons: [2], to: ['dictionary-form', 'ta-form'] }
    const items = buildItems('card', library, modeSettings, { shuffled: false })
    expect(items.map((item) => [item.verb.id, item.targetForm])).toEqual([
      ['a', 'dictionary-form'],
      ['a', 'ta-form'],
      ['b', 'dictionary-form'],
      ['b', 'ta-form'],
    ])
  })

  it('returns nothing when no lessons are selected', () => {
    expect(buildItems('dict', fakeLibrary({}), { lessons: [] })).toEqual([])
  })

  it('never shuffles the dictionary list', () => {
    const library = fakeLibrary({ 2: [verbA, verbB], 5: [verbC] })
    const items = buildItems('dict', library, { lessons: [2, 5] }, { random: () => 0 })
    expect(items.map((item) => item.verb.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps one item where it is', () => {
    const library = fakeLibrary({ 2: [verbA] })
    const items = buildItems('card', library, { lessons: [2], to: ['dictionary-form'] }, {
      random: () => 0,
    })
    expect(items).toHaveLength(1)
    expect(items[0].verb.id).toBe('a')
  })
})

describe('跳過錯誤的單詞 in card/quiz item lists', () => {
  const errorVerb = {
    id: 'e',
    'dictionary-form': { vol: 'E' },
    'te-form': { vol: 'Eて' },
    'passive-form': { vol: 'E受', error_usage: true },
  }
  const library = fakeLibrary({ 2: [errorVerb] })
  const modeSettings = {
    lessons: [2],
    to: ['dictionary-form', 'te-form', 'passive-form'],
  }

  it('drops the error_usage targets when skipping is on', () => {
    const items = buildItems('card', library, { ...modeSettings, skipErrorUsage: true }, { shuffled: false })
    expect(items.map((item) => item.targetForm)).toEqual(['dictionary-form', 'te-form'])
  })

  it('keeps them when skipping is off', () => {
    const items = buildItems('card', library, { ...modeSettings, skipErrorUsage: false }, { shuffled: false })
    expect(items.map((item) => item.targetForm)).toEqual(['dictionary-form', 'te-form', 'passive-form'])
  })
})

describe('isErrorUsageItem', () => {
  it('is true only for an error_usage target', () => {
    const ok = { verb: { 'x-form': { vol: 'a' } }, targetForm: 'x-form' }
    const bad = { verb: { 'x-form': { vol: 'b', error_usage: true } }, targetForm: 'x-form' }
    expect(isErrorUsageItem(ok)).toBe(false)
    expect(isErrorUsageItem(bad)).toBe(true)
    expect(isErrorUsageItem(null)).toBe(false)
  })
})

describe('reconcileQuizQueue', () => {
  const ok = (id) => ({ id, verb: { 'x-form': { vol: id } }, targetForm: 'x-form' })
  const err = (id) => ({ id, verb: { 'x-form': { vol: id, error_usage: true } }, targetForm: 'x-form' })

  it('removes the error_usage items from the unanswered portion when skipping on', () => {
    const items = [ok('a'), err('b'), ok('c'), err('d')]
    const result = reconcileQuizQueue(items, [], 1, true)
    expect(result.items.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result.skipped.map((item) => item.id)).toEqual(['b', 'd'])
  })

  it('removes the current error item too', () => {
    const items = [ok('a'), err('b'), err('c')]
    const result = reconcileQuizQueue(items, [], 1, true)
    expect(result.items.map((item) => item.id)).toEqual(['a'])
    expect(result.skipped.map((item) => item.id)).toEqual(['b', 'c'])
  })

  it('empties the queue when everything unanswered is error_usage', () => {
    const items = [err('x')]
    const result = reconcileQuizQueue(items, [], 0, true)
    expect(result.items).toEqual([])
    expect(result.skipped.map((item) => item.id)).toEqual(['x'])
  })

  it('appends the skipped items to the tail when skipping off', () => {
    const items = [ok('a'), ok('c')]
    const skipped = [err('b'), err('d')]
    const result = reconcileQuizQueue(items, skipped, 0, false)
    expect(result.items.map((item) => item.id)).toEqual(['a', 'c', 'b', 'd'])
    expect(result.skipped).toEqual([])
  })

  it('leaves the queue alone when nothing unanswered is error_usage', () => {
    const items = [ok('a')]
    const result = reconcileQuizQueue(items, [], 0, true)
    expect(result.items.map((item) => item.id)).toEqual(['a'])
    expect(result.skipped).toEqual([])
  })
})

// Deterministic PRNG so the shuffle assertions do not depend on Math.random.
function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

function key(item) {
  return `${item.verb.id}:${item.targetForm}`
}

describe('shuffled card and quiz items', () => {
  const library = fakeLibrary({ 2: [verbA, verbB, verbC] })
  const modeSettings = { lessons: [2], to: ['dictionary-form', 'ta-form'] }
  const inOrder = () =>
    buildItems('card', library, modeSettings, { shuffled: false }).map(key)

  it('keeps every item and drops none', () => {
    const items = buildItems('card', library, modeSettings, { random: seeded(7) })
    expect(items).toHaveLength(6)
    expect(items.map(key).sort()).toEqual(inOrder().sort())
  })

  it('changes the order for a different seed', () => {
    const a = buildItems('card', library, modeSettings, { random: seeded(1) }).map(key)
    const b = buildItems('card', library, modeSettings, { random: seeded(2) }).map(key)
    expect(a).not.toEqual(inOrder())
    expect(a).not.toEqual(b)
  })

  it('is stable for the same seed, so one start keeps one order', () => {
    const a = buildItems('quiz', library, modeSettings, { random: seeded(3) }).map(key)
    const b = buildItems('quiz', library, modeSettings, { random: seeded(3) }).map(key)
    expect(a).toEqual(b)
  })
})
