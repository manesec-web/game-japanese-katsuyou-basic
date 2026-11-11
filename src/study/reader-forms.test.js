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

// The note layer: the form's own note rides on the entry (the view shows it
// above the example sentences), and each sentence keeps its own note in
// `data.sentence`. A form flagged `error_usage` is marked on the entry so the
// view can strike its word through twice.
describe('note and error_usage passthrough', () => {
  const notedVerb = {
    'dictionary-form': {
      vol: 'ある',
      note: '字典有但是不常用：「あろう」日常不用',
      error_usage: false,
      sentence: [
        { japanese: '例文一。', chinese: '一。', note: '句子自己的註解' },
        { japanese: '例文二。', chinese: '二。', note: null },
      ],
    },
    'passive-form': {
      vol: 'あられる',
      note: '錯誤詞語，僅供轉詞練習：「あられる」是尊敬用法，不是受身形',
      error_usage: true,
      sentence: [],
    },
  }

  it('carries the form note on the entry', () => {
    const entries = orderedFormEntries(notedVerb, 'dictionary-form')
    const dict = entries.find((entry) => entry.id === 'dictionary-form')
    expect(dict.note).toBe('字典有但是不常用：「あろう」日常不用')
  })

  it('carries no note when the form has none', () => {
    const entries = orderedFormEntries(verb, 'masu-form')
    expect(entries.every((entry) => entry.note === null)).toBe(true)
  })

  it('marks error_usage forms and only those', () => {
    const entries = orderedFormEntries(notedVerb, 'dictionary-form')
    const dict = entries.find((entry) => entry.id === 'dictionary-form')
    const passive = entries.find((entry) => entry.id === 'passive-form')
    expect(dict.errorUsage).toBe(false)
    expect(passive.errorUsage).toBe(true)
    expect(passive.note).toContain('錯誤詞語')
    expect(passive.data.sentence).toEqual([])
  })

  it('keeps each sentence note beside its own sentence', () => {
    const entries = orderedFormEntries(notedVerb, 'dictionary-form')
    const dict = entries.find((entry) => entry.id === 'dictionary-form')
    expect(dict.data.sentence.map((line) => line.note)).toEqual(['句子自己的註解', null])
  })

  it('treats a missing error_usage flag as a plain form', () => {
    const entries = orderedFormEntries(verb, 'masu-form')
    expect(entries.every((entry) => entry.errorUsage === false)).toBe(true)
  })
})

describe('跳過錯誤的單詞', () => {
  const skipVerb = {
    'dictionary-form': { vol: 'ある' },
    'masu-form': { vol: 'あります' },
    'passive-form': { vol: 'あられる', error_usage: true },
  }

  it('removes the error_usage forms and keeps the rest', () => {
    const entries = orderedFormEntries(skipVerb, 'dictionary-form', { skipErrorUsage: true })
    expect(entries.map((entry) => entry.id)).toEqual(['dictionary-form', 'masu-form'])
    expect(entries.every((entry) => entry.errorUsage === false)).toBe(true)
  })

  it('leaves the error_usage forms when skipping is off', () => {
    const entries = orderedFormEntries(skipVerb, 'dictionary-form', { skipErrorUsage: false })
    expect(entries.map((entry) => entry.id)).toEqual(['dictionary-form', 'masu-form', 'passive-form'])
  })

  it('replaces a skipped default with the first remaining form', () => {
    const entries = orderedFormEntries(skipVerb, 'passive-form', { skipErrorUsage: true })
    expect(entries[0].id).toBe('dictionary-form')
    expect(entries[0].isDefault).toBe(true)
    expect(entries[0].isFirst).toBe(true)
  })
})

describe('選擇顯示的類型 (displayForms)', () => {
  it('shows only the selected forms', () => {
    const entries = orderedFormEntries(verb, 'masu-form', { displayForms: ['masu-form', 'te-form'] })
    expect(entries.map((entry) => entry.id)).toEqual(['masu-form', 'te-form'])
  })

  it('hides the default form and promotes the first visible one', () => {
    const entries = orderedFormEntries(verb, 'te-form', { displayForms: ['dictionary-form', 'masu-form'] })
    expect(entries.map((entry) => entry.id)).toEqual(['dictionary-form', 'masu-form'])
    expect(entries[0].id).toBe('dictionary-form')
    expect(entries[0].isDefault).toBe(true)
    expect(entries[0].isFirst).toBe(true)
  })

  it('shows all forms when displayForms is empty or missing', () => {
    const all = ['masu-form', 'dictionary-form', 'nai-form', 'te-form']
    expect(orderedFormEntries(verb, 'masu-form', { displayForms: [] }).map((entry) => entry.id)).toEqual(all)
    expect(orderedFormEntries(verb, 'masu-form').map((entry) => entry.id)).toEqual(all)
  })

  it('combines with 跳過錯誤的單詞', () => {
    const skipVerb = {
      'dictionary-form': { vol: 'ある' },
      'masu-form': { vol: 'あります' },
      'passive-form': { vol: 'あられる', error_usage: true },
    }
    const entries = orderedFormEntries(skipVerb, 'dictionary-form', {
      displayForms: ['dictionary-form', 'passive-form'],
      skipErrorUsage: true,
    })
    expect(entries.map((entry) => entry.id)).toEqual(['dictionary-form'])
  })
})
