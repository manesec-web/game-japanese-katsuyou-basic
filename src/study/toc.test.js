import { describe, expect, it } from 'vitest'
import { tocGroups } from './toc.js'

function item(lesson, word) {
  return { mode: 'dict', lesson, verb: { 'dictionary-form': { vol: word } } }
}

describe('tocGroups', () => {
  it('is empty for an empty run', () => {
    expect(tocGroups([])).toEqual([])
  })

  it('groups rows by lesson in run order', () => {
    const groups = tocGroups([item(2, 'A'), item(2, 'B'), item(5, 'C')])
    expect(groups.map((group) => group.lesson)).toEqual([2, 5])
    expect(groups[0].rows.map((row) => row.word)).toEqual(['A', 'B'])
    expect(groups[1].rows.map((row) => row.word)).toEqual(['C'])
    // The index is the run position, not a position inside the group.
    expect(groups[0].rows.map((row) => row.index)).toEqual([0, 1])
    expect(groups[1].rows[0].index).toBe(2)
  })

  it('starts a new group when a lesson reappears after another one', () => {
    const groups = tocGroups([item(2, 'A'), item(5, 'B'), item(2, 'C')])
    expect(groups.map((group) => group.lesson)).toEqual([2, 5, 2])
  })

  it('marks exactly the current row', () => {
    const groups = tocGroups([item(2, 'A'), item(2, 'B')], 1)
    const rows = groups.flatMap((group) => group.rows)
    expect(rows.filter((row) => row.current)).toHaveLength(1)
    expect(rows.find((row) => row.current).index).toBe(1)
  })

  it('marks nothing when no index is current', () => {
    const rows = tocGroups([item(2, 'A')]).flatMap((group) => group.rows)
    expect(rows[0].current).toBe(false)
  })

  it('leaves the word empty when the item carries no dictionary form', () => {
    const rows = tocGroups([{ lesson: 3, verb: {} }]).flatMap((group) => group.rows)
    expect(rows[0].word).toBe('')
  })
})
