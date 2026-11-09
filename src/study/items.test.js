import { describe, expect, it } from 'vitest'
import { buildItems } from './items.js'

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
