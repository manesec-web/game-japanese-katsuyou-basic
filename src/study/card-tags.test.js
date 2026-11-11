import { describe, expect, it } from 'vitest'
import { backTags, frontTags } from './card-tags.js'

const source = { group: '1' }

describe('frontTags', () => {
  it('shows the verb class while 一開始顯示幾類動詞 is on', () => {
    expect(frontTags({ showGroup: true, showReading: true }, source)).toEqual([
      { kind: 'group', text: '1類動詞', className: 'tag--group' },
    ])
  })

  it('hides the verb class when the switch is off', () => {
    expect(frontTags({ showGroup: false, showReading: true }, source)).toEqual([])
  })

  it('shows nothing without a source form', () => {
    expect(frontTags({ showGroup: true }, null)).toEqual([])
  })
})

describe('backTags', () => {
  const target = { group: '1' }

  it('always names the asked form and the verb class', () => {
    const tags = backTags('dictionary-form', target)
    expect(tags).toHaveLength(2)
    expect(tags[0]).toEqual({ kind: 'form', text: '字典形', className: 'tag--form' })
    expect(tags[1]).toEqual({ kind: 'group', text: '1類動詞', className: 'tag--group' })
  })

  it('keeps both answer tags while the class switch is off', () => {
    // Neither setting is read: the answer carries both pills in both states,
    // so turning 一開始顯示幾類動詞 off only clears the face.
    expect(frontTags({ showGroup: false, showReading: true }, source)).toEqual([])
    const off = backTags('masu-form', { group: '2' })
    expect(off.map((tag) => tag.text)).toEqual(['ます形', '2類動詞'])
  })

  it('uses the on-screen name for every one of the 15 forms', () => {
    expect(backTags('te-form', target)[0].text).toBe('て形')
    expect(backTags('causative-form', target)[0].text).toBe('使役形')
  })

  it('labels every verb class', () => {
    expect(backTags('ta-form', { group: '0' })[1].text).toBe('例外')
    expect(backTags('ta-form', { group: '1' })[1].text).toBe('1類動詞')
    expect(backTags('ta-form', { group: '2' })[1].text).toBe('2類動詞')
    expect(backTags('ta-form', { group: '3' })[1].text).toBe('3類動詞')
  })

  it('falls back to the raw value for an unknown class', () => {
    expect(backTags('ta-form', { group: '9' })[1].text).toBe('9')
  })

  it('names only the form when the target data is missing', () => {
    expect(backTags('te-form')).toHaveLength(1)
    expect(backTags('te-form', {})).toHaveLength(1)
    expect(backTags('te-form', { group: null })).toHaveLength(1)
  })

  it('adds the lesson tag when a lesson is supplied', () => {
    const tags = backTags('dictionary-form', target, { lesson: 7 })
    expect(tags.map((tag) => tag.text)).toEqual(['字典形', '1類動詞', '第7課'])
    expect(tags[2]).toEqual({ kind: 'lesson', text: '第7課', className: 'tag--lesson' })
  })

  it('marks an error_usage target with 錯誤單詞', () => {
    const tags = backTags('passive-form', { group: '1' }, { lesson: 3, errorUsage: true })
    expect(tags.map((tag) => tag.text)).toEqual(['受身形', '1類動詞', '第3課', '錯誤單詞'])
    expect(tags[3]).toEqual({ kind: 'error', text: '錯誤單詞', className: 'tag--error' })
  })

  it('does not add the error tag for a usable target', () => {
    const tags = backTags('dictionary-form', target, { lesson: 3, errorUsage: false })
    expect(tags.some((tag) => tag.kind === 'error')).toBe(false)
  })

  it('shows nothing without a target form', () => {
    expect(backTags(undefined)).toEqual([])
    expect(backTags(null)).toEqual([])
  })
})
