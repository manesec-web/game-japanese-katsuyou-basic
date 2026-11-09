import { describe, expect, it } from 'vitest'
import { allVerbLessonsSelected, selectAllLabel, verbLessons } from './lessons.js'

function entries(lessonNumbers, emptyLessons = []) {
  return lessonNumbers.map((lesson) => ({
    lesson,
    hasVerbs: !emptyLessons.includes(lesson),
  }))
}

describe('verbLessons', () => {
  it('skips lessons without verbs', () => {
    const list = entries([1, 2, 3, 4], [1, 3])
    expect(verbLessons(list)).toEqual([2, 4])
  })
})

describe('selectAllLabel', () => {
  it('reads 全選 while some verb lesson is still unselected', () => {
    const list = entries([1, 2, 5], [1])
    expect(selectAllLabel(list, [])).toBe('全選')
    expect(selectAllLabel(list, [2])).toBe('全選')
  })

  it('reads 全選 when an empty lesson is the only thing missing', () => {
    const list = entries([1, 2], [1])
    expect(allVerbLessonsSelected(list, [2])).toBe(true)
    expect(selectAllLabel(list, [2])).toBe('取消全選')
  })

  it('reads 取消全選 once every verb lesson is selected', () => {
    const list = entries([1, 2, 5], [1])
    expect(selectAllLabel(list, [2, 5])).toBe('取消全選')
  })

  it('has no 取消全選 state when every lesson is empty', () => {
    const list = entries([1, 3], [1, 3])
    expect(allVerbLessonsSelected(list, [])).toBe(false)
    expect(selectAllLabel(list, [])).toBe('全選')
  })
})
