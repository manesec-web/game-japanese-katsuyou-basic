import { describe, expect, it } from 'vitest'
import { typingEdits } from './typing.js'

describe('typingEdits', () => {
  it('appends the newly typed suffix', () => {
    expect(typingEdits('い', 'いく')).toEqual([{ op: 'append', text: 'く' }])
    expect(typingEdits('', 'い')).toEqual([{ op: 'append', text: 'い' }])
  })

  it('turns a shorter value into backspaces', () => {
    expect(typingEdits('いく', 'い')).toEqual([{ op: 'backspace' }])
    expect(typingEdits('いく', '')).toEqual([{ op: 'backspace' }, { op: 'backspace' }])
  })

  it('does nothing when the value is unchanged', () => {
    expect(typingEdits('いく', 'いく')).toEqual([])
  })

  it('replaces a composed value', () => {
    expect(typingEdits('あ', 'い')).toEqual([{ op: 'backspace' }, { op: 'append', text: 'い' }])
  })
})
