import { describe, expect, it } from 'vitest'
import { filterTocGroups, tocGroups, tocRowMatches } from './toc.js'

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

describe('tocRowMatches', () => {
  it('matches every row when the query is blank', () => {
    expect(tocRowMatches(item(2, '会う'), '')).toBe(true)
    expect(tocRowMatches(item(2, '会う'), '   ')).toBe(true)
  })

  it('matches the word text by substring', () => {
    expect(tocRowMatches(item(2, '会う'), '会')).toBe(true)
    expect(tocRowMatches(item(2, '会う'), 'う')).toBe(true)
    expect(tocRowMatches(item(2, '会う'), '会う')).toBe(true)
    expect(tocRowMatches(item(2, '会う'), '行く')).toBe(false)
  })

  it('matches the lesson number by substring', () => {
    expect(tocRowMatches(item(5, '行く'), '5')).toBe(true)
    expect(tocRowMatches(item(15, '見る'), '5')).toBe(true)
    expect(tocRowMatches(item(50, '来る'), '5')).toBe(true)
    expect(tocRowMatches(item(2, '会う'), '5')).toBe(false)
  })

  it('survives a row with no word or lesson', () => {
    expect(tocRowMatches({}, '5')).toBe(false)
    expect(tocRowMatches({}, '')).toBe(true)
  })
})

describe('filterTocGroups', () => {
  it('returns every group when the query is blank', () => {
    const groups = filterTocGroups([item(2, 'A'), item(2, 'B'), item(5, 'C')], -1, '  ')
    expect(groups.map((group) => group.lesson)).toEqual([2, 5])
    expect(groups.flatMap((group) => group.rows).map((row) => row.word)).toEqual(['A', 'B', 'C'])
  })

  it('keeps only rows whose word matches', () => {
    const groups = filterTocGroups([item(2, '会う'), item(2, '行く'), item(5, '行く')], -1, '行く')
    expect(groups.map((group) => group.lesson)).toEqual([2, 5])
    expect(groups.flatMap((group) => group.rows).map((row) => row.word)).toEqual(['行く', '行く'])
  })

  it('drops a lesson heading when none of its rows match', () => {
    const groups = filterTocGroups([item(2, '会う'), item(5, '行く')], -1, '行く')
    expect(groups.map((group) => group.lesson)).toEqual([5])
    expect(groups[0].rows.map((row) => row.word)).toEqual(['行く'])
  })

  it('keeps the original run index on the surviving rows', () => {
    const groups = filterTocGroups([item(2, '会う'), item(5, '行く')], -1, '行く')
    expect(groups[0].rows[0].index).toBe(1)
  })

  it('filters by lesson number and hides the rest', () => {
    const groups = filterTocGroups([item(2, '会う'), item(5, '行く'), item(50, '来る')], -1, '5')
    expect(groups.map((group) => group.lesson)).toEqual([5, 50])
    expect(groups.flatMap((group) => group.rows).map((row) => row.word)).toEqual(['行く', '来る'])
  })

  it('marks the current row only when it survives the filter', () => {
    const groups = filterTocGroups([item(2, '会う'), item(5, '行く')], 1, '行く')
    const rows = groups.flatMap((group) => group.rows)
    expect(rows.find((row) => row.index === 1).current).toBe(true)

    const hidden = filterTocGroups([item(2, '会う'), item(5, '行く')], 1, '会う')
    expect(hidden.flatMap((group) => group.rows).some((row) => row.current)).toBe(false)
  })

  it('returns no groups when nothing matches', () => {
    expect(filterTocGroups([item(2, '会う')], -1, 'ない')).toEqual([])
  })
})
