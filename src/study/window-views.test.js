import { describe, expect, it } from 'vitest'
import { CARD_WINDOW, CURRENT_SLOT, READER_WINDOW, windowSlots } from '../ui/window.js'
import { cardEntries, readerEntries } from './window-views.js'

const settings = { from: 'masu-form', showGroup: true, showReading: true, defaultForm: 'masu-form' }

function verb(name, group = '1') {
  return {
    'dictionary-form': { vol: name.dict, japanese: name.reading, chinese: name.gloss, group },
    'masu-form': { vol: name.masu, japanese: name.masuReading ?? name.reading, chinese: name.gloss, group },
  }
}

function cardItems(count) {
  return Array.from({ length: count }, (_, at) => ({
    mode: 'card',
    lesson: 5,
    targetForm: 'dictionary-form',
    verb: verb({ dict: `辞${at}`, reading: `よみ${at}`, masu: `ます${at}`, gloss: `語義${at}` }, '1'),
  }))
}

function dictItems(count) {
  return Array.from({ length: count }, (_, at) => ({
    mode: 'dict',
    lesson: 5,
    verb: verb({ dict: `辞${at}`, reading: `よみ${at}`, masu: `ます${at}`, gloss: `語義${at}` }, '1'),
  }))
}

describe('cardEntries', () => {
  it('mounts nine slots with the current card in the 3rd', () => {
    const entries = cardEntries(cardItems(20), windowSlots(20, 5, CARD_WINDOW), settings)
    expect(entries).toHaveLength(CARD_WINDOW)
    expect(entries.filter((entry) => entry.current)).toHaveLength(1)
    expect(entries[CURRENT_SLOT].current).toBe(true)
    expect(entries[CURRENT_SLOT].at).toBe(5)
  })

  it('puts the current slot at 0 and the neighbours a full width away', () => {
    const entries = cardEntries(cardItems(20), windowSlots(20, 5, CARD_WINDOW), settings)
    expect(entries[CURRENT_SLOT].offset).toBe(0)
    expect(entries[CURRENT_SLOT - 1].offset).toBe(-100)
    expect(entries[CURRENT_SLOT + 1].offset).toBe(100)
    expect(entries[0].offset).toBe(-200)
  })

  it('gives every slot its own item, not a copy of the current one', () => {
    const entries = cardEntries(cardItems(20), windowSlots(20, 5, CARD_WINDOW), settings)
    for (const entry of entries) {
      if (entry.at === null) continue
      expect(entry.face.word).toBe(`ます${entry.at}`)
      expect(entry.back.word).toBe(`辞${entry.at}`)
      expect(entry.back.gloss).toBe(`語義${entry.at}`)
      expect(entry.face.prompt).toBe('變成字典形')
    }
    const words = entries.filter((entry) => entry.at !== null).map((entry) => entry.face.word)
    expect(new Set(words).size).toBe(words.length)
  })

  it('leaves the slots past the ends empty and named', () => {
    const entries = cardEntries(cardItems(3), windowSlots(3, 0, CARD_WINDOW), settings)
    expect(entries.filter((entry) => entry.at === null)).toHaveLength(CARD_WINDOW - 3)
    expect(entries[0].key).toBe('empty-0')
    expect(entries[CURRENT_SLOT].key).toBe('item-0')
    expect(entries[0].face).toBeNull()
    expect(entries[CURRENT_SLOT].current).toBe(true)
  })

  it('keys slots by the item, so a move only names one new node', () => {
    const before = cardEntries(cardItems(20), windowSlots(20, 5, CARD_WINDOW), settings).map((entry) => entry.key)
    const after = cardEntries(cardItems(20), windowSlots(20, 6, CARD_WINDOW), settings).map((entry) => entry.key)
    expect(before).toEqual([
      'item-3', 'item-4', 'item-5', 'item-6', 'item-7', 'item-8', 'item-9', 'item-10', 'item-11',
    ])
    expect(after).toEqual([
      'item-4', 'item-5', 'item-6', 'item-7', 'item-8', 'item-9', 'item-10', 'item-11', 'item-12',
    ])
    // Everything but the dropped front and the appended back is shared.
    expect(after.slice(0, CARD_WINDOW - 1)).toEqual(before.slice(1))
  })

  it('carries the face and answer tags for the current card only', () => {
    const entries = cardEntries(cardItems(20), windowSlots(20, 5, CARD_WINDOW), settings)
    const current = entries[CURRENT_SLOT]
    expect(current.face.tags).toEqual([{ kind: 'group', text: '1類動詞', className: 'tag--group' }])
    expect(current.back.tags.map((tag) => tag.text)).toEqual(['字典形', '1類動詞'])
    const off = cardEntries(cardItems(20), windowSlots(20, 5, CARD_WINDOW), { ...settings, showGroup: false })
    expect(off[CURRENT_SLOT].face.tags).toEqual([])
    // The answer side names the form and the class even with the switch off.
    expect(off[CURRENT_SLOT].back.tags.map((tag) => tag.text)).toEqual(['字典形', '1類動詞'])
  })
})

describe('readerEntries', () => {
  it('mounts five slots with the current word in the 3rd', () => {
    const entries = readerEntries(dictItems(20), windowSlots(20, 8, READER_WINDOW), settings)
    expect(entries).toHaveLength(READER_WINDOW)
    expect(entries.filter((entry) => entry.current)).toHaveLength(1)
    expect(entries[CURRENT_SLOT].at).toBe(8)
    expect(entries[CURRENT_SLOT - 2].at).toBe(6)
    expect(entries[CURRENT_SLOT + 2].at).toBe(10)
  })

  it('gives every slot its own word', () => {
    const entries = readerEntries(dictItems(20), windowSlots(20, 8, READER_WINDOW), settings)
    for (const entry of entries) {
      if (entry.at === null) continue
      expect(entry.forms[0].data.vol).toBe(`ます${entry.at}`)
      expect(entry.lesson).toBe(5)
    }
  })

  it('leaves the slots past an end empty', () => {
    const first = readerEntries(dictItems(3), windowSlots(3, 0, READER_WINDOW), settings)
    expect(first.slice(0, 2).every((entry) => entry.at === null)).toBe(true)
    const last = readerEntries(dictItems(3), windowSlots(3, 2, READER_WINDOW), settings)
    expect(last.slice(3).every((entry) => entry.at === null)).toBe(true)
  })

  it('keys slots by the item across a move', () => {
    const before = readerEntries(dictItems(20), windowSlots(20, 8, READER_WINDOW), settings).map((entry) => entry.key)
    const after = readerEntries(dictItems(20), windowSlots(20, 9, READER_WINDOW), settings).map((entry) => entry.key)
    expect(after.slice(0, READER_WINDOW - 1)).toEqual(before.slice(1))
  })
})
