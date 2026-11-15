import { describe, expect, it } from 'vitest'
import { filterTocGroups, highlightSegments, matchFormRanges, tocGroups } from './toc.js'

const f = (vol, japanese = vol) => ({ vol, japanese })
const item = (lesson, verb) => ({ mode: 'dict', lesson, verb })

describe('tocGroups', () => {
  it('is empty for an empty run', () => {
    expect(tocGroups([])).toEqual([])
  })

  it('expands every verb into its forms, run order then canonical form order', () => {
    const groups = tocGroups([
      item(2, { 'masu-form': f('行きます', 'いきます'), 'dictionary-form': f('行く', 'いく') }),
      item(5, { 'dictionary-form': f('来る', 'くる') }),
    ])
    expect(groups.map((group) => group.lesson)).toEqual([2, 5])
    expect(groups[0].rows.map((row) => row.formId)).toEqual(['dictionary-form', 'masu-form'])
    expect(groups[0].rows.map((row) => row.word)).toEqual(['行く', '行きます'])
    // The index is the verb's run position, shared by every form row.
    expect(groups[0].rows.map((row) => row.index)).toEqual([0, 0])
    expect(groups[1].rows[0].word).toBe('来る')
    expect(groups[1].rows[0].index).toBe(1)
  })

  it('starts a new group when a lesson reappears after another one', () => {
    const groups = tocGroups([
      item(2, { 'dictionary-form': f('A') }),
      item(5, { 'dictionary-form': f('B') }),
      item(2, { 'dictionary-form': f('C') }),
    ])
    expect(groups.map((group) => group.lesson)).toEqual([2, 5, 2])
  })

  it('marks exactly the dictionary-form row of the current verb', () => {
    const groups = tocGroups(
      [
        item(2, { 'dictionary-form': f('A'), 'masu-form': f('Aます') }),
        item(5, { 'dictionary-form': f('B'), 'te-form': f('Bて') }),
      ],
      1,
    )
    const rows = groups.flatMap((group) => group.rows)
    expect(rows.filter((row) => row.current)).toHaveLength(1)
    const current = rows.find((row) => row.current)
    expect(current.index).toBe(1)
    expect(current.formId).toBe('dictionary-form')
  })

  it('marks nothing when no index is current', () => {
    const rows = tocGroups([item(2, { 'dictionary-form': f('A') })]).flatMap(
      (group) => group.rows,
    )
    expect(rows.some((row) => row.current)).toBe(false)
  })

  it('skips a verb with no forms', () => {
    expect(tocGroups([{ lesson: 3, verb: {} }])).toEqual([])
  })

  it('names each form row and carries one plain part', () => {
    const groups = tocGroups([item(2, { 'te-form': f('行って', 'いって') })])
    expect(groups[0].rows[0].formName).toBe('て形')
    expect(groups[0].rows[0].parts).toEqual([{ text: '行って', highlight: false }])
  })
})

describe('matchFormRanges', () => {
  it('matches the displayed word literally (kanji/kana)', () => {
    expect(matchFormRanges('行き', '行きます', 'いきます')).toEqual([[0, 2]])
    expect(matchFormRanges('行く', '行く', 'いく')).toEqual([[0, 2]])
    expect(matchFormRanges('ます', '行きます', 'いきます')).toEqual([[2, 4]])
  })

  it('matches a kana query inside the reading and maps it to the word', () => {
    expect(matchFormRanges('いき', '行きます', 'いきます')).toEqual([[0, 2]])
  })

  it('matches a romaji query against the reading', () => {
    expect(matchFormRanges('ikimasu', '行きます', 'いきます')).toEqual([[0, 4]])
    expect(matchFormRanges('iki', '行きます', 'いきます')).toEqual([[0, 2]])
    expect(matchFormRanges('dekimasu', 'できます', 'できます')).toEqual([[0, 4]])
  })

  it('highlights the whole kanji run for a partial reading match', () => {
    expect(matchFormRanges('chiga', '違う', 'ちがう')).toEqual([[0, 1]])
    expect(matchFormRanges('gau', '違う', 'ちがう')).toEqual([[0, 2]])
  })

  it('matches loan-word katakana through the normalised reading', () => {
    expect(matchFormRanges('kopi', 'コピーする', 'コピーする')).toEqual([[0, 2]])
    expect(matchFormRanges('kopii', 'コピーする', 'コピーする')).toEqual([[0, 3]])
  })

  it('returns no ranges when the query does not match', () => {
    expect(matchFormRanges('ない', '行く', 'いく')).toEqual([])
    expect(matchFormRanges('zzz', '行く', 'いく')).toEqual([])
    expect(matchFormRanges('', '行く', 'いく')).toEqual([])
  })

  it('does not treat a lesson-number query as a word match', () => {
    expect(matchFormRanges('5', '行く', 'いく')).toEqual([])
  })
})

describe('highlightSegments', () => {
  it('returns one plain run for no ranges', () => {
    expect(highlightSegments('行きます', [])).toEqual([{ text: '行きます', highlight: false }])
  })

  it('splits around the ranges without losing characters', () => {
    expect(highlightSegments('行きます', [[2, 4]])).toEqual([
      { text: '行き', highlight: false },
      { text: 'ます', highlight: true },
    ])
  })

  it('merges overlapping ranges', () => {
    expect(highlightSegments('できます', [[0, 2], [1, 3]])).toEqual([
      { text: 'できま', highlight: true },
      { text: 'す', highlight: false },
    ])
  })
})

describe('filterTocGroups', () => {
  it('returns every form when the query is blank', () => {
    const groups = filterTocGroups(
      [item(2, { 'dictionary-form': f('行く', 'いく'), 'masu-form': f('行きます', 'いきます') })],
      -1,
      '  ',
    )
    expect(groups.flatMap((group) => group.rows).map((row) => row.word)).toEqual([
      '行く',
      '行きます',
    ])
  })

  it('keeps only the form whose reading matches a romaji query', () => {
    const groups = filterTocGroups(
      [
        item(2, {
          'dictionary-form': f('できる', 'できる'),
          'masu-form': f('できます', 'できます'),
          'nai-form': f('できない', 'できない'),
        }),
      ],
      -1,
      'dekimasu',
    )
    expect(
      groups.flatMap((group) => group.rows).map((row) => ({ word: row.word, form: row.formName })),
    ).toEqual([{ word: 'できます', form: 'ます形' }])
  })

  it('highlights the matched part in the surviving rows', () => {
    const groups = filterTocGroups([item(2, { 'masu-form': f('できます', 'できます') })], -1, 'deki')
    expect(groups[0].rows[0].parts).toEqual([
      { text: 'でき', highlight: true },
      { text: 'ます', highlight: false },
    ])
  })

  it('keeps every form of a lesson when the query is the lesson number', () => {
    const groups = filterTocGroups(
      [
        item(2, { 'dictionary-form': f('行く', 'いく'), 'masu-form': f('行きます', 'いきます') }),
        item(5, { 'dictionary-form': f('来る', 'くる') }),
      ],
      -1,
      '5',
    )
    expect(groups.map((group) => group.lesson)).toEqual([5])
    expect(groups[0].rows.map((row) => row.word)).toEqual(['来る'])
  })

  it('drops a lesson heading when none of its forms match', () => {
    const groups = filterTocGroups(
      [
        item(2, { 'dictionary-form': f('会う', 'あう') }),
        item(5, { 'dictionary-form': f('行く', 'いく') }),
      ],
      -1,
      '行く',
    )
    expect(groups.map((group) => group.lesson)).toEqual([5])
  })

  it('marks the current row only when it survives the filter', () => {
    const items = [
      item(2, { 'dictionary-form': f('行く', 'いく'), 'masu-form': f('行きます', 'いきます') }),
      item(5, { 'dictionary-form': f('来る', 'くる') }),
    ]
    const hidden = filterTocGroups(items, 1, '行く')
    expect(hidden.flatMap((group) => group.rows).some((row) => row.current)).toBe(false)

    const kept = filterTocGroups(items, 0, '行く')
    const current = kept.flatMap((group) => group.rows).find((row) => row.current)
    expect(current).toBeTruthy()
    expect(current.word).toBe('行く')
  })

  it('returns no groups when nothing matches', () => {
    expect(filterTocGroups([item(2, { 'dictionary-form': f('行く', 'いく') })], -1, 'ない')).toEqual([])
  })
})
