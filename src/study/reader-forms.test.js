import { describe, expect, it } from 'vitest'
import { orderedFormEntries } from './reader-forms.js'

const verb = {
  'dictionary-form': { vol: '立つ' },
  'masu-form': { vol: '立ちます' },
  'nai-form': { vol: '立たない' },
  'te-form': { vol: '立って' },
}

describe('orderedFormEntries', () => {
  it('puts the default form first and keeps the rest canonical', () => {
    const entries = orderedFormEntries(verb, 'te-form')
    expect(entries.map((entry) => entry.id)).toEqual([
      'te-form',
      'dictionary-form',
      'masu-form',
      'nai-form',
    ])
    expect(entries[0].isDefault).toBe(true)
    expect(entries.slice(1).every((entry) => !entry.isDefault)).toBe(true)
  })

  it('marks exactly one block as default', () => {
    const entries = orderedFormEntries(verb, 'masu-form')
    expect(entries.filter((entry) => entry.isDefault)).toHaveLength(1)
    expect(entries[0].id).toBe('masu-form')
  })

  it('leaves the canonical order alone when the default is already first', () => {
    const entries = orderedFormEntries(verb, 'dictionary-form')
    expect(entries.map((entry) => entry.id)).toEqual([
      'dictionary-form',
      'masu-form',
      'nai-form',
      'te-form',
    ])
  })

  it('keeps canonical order when the default form is not in the verb', () => {
    const entries = orderedFormEntries(verb, 'conditional-form')
    expect(entries.map((entry) => entry.id)).toEqual([
      'dictionary-form',
      'masu-form',
      'nai-form',
      'te-form',
    ])
    expect(entries.some((entry) => entry.isDefault)).toBe(false)
  })

  it('returns nothing without a verb', () => {
    expect(orderedFormEntries(null, 'masu-form')).toEqual([])
  })
})

describe('first-block labelling', () => {
  it('marks exactly the first entry as the tagged block', () => {
    const entries = orderedFormEntries(verb, 'masu-form')
    expect(entries.filter((entry) => entry.isFirst)).toHaveLength(1)
    expect(entries[0].isFirst).toBe(true)
    expect(entries[0].id).toBe('masu-form')
    expect(entries.slice(1).every((entry) => entry.isFirst === false)).toBe(true)
  })

  it('keeps a form name for every block', () => {
    const entries = orderedFormEntries(verb, 'te-form')
    expect(entries.map((entry) => entry.name)).toEqual(['て形', '字典形', 'ます形', 'ない形'])
    expect(entries.every((entry) => Boolean(entry.name) && Boolean(entry.data))).toBe(true)
  })

  it('does not invent a first block when there is no verb', () => {
    expect(orderedFormEntries(null, 'masu-form')).toEqual([])
  })
})
