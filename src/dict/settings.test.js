import { describe, expect, it } from 'vitest'
import {
  allTargetsExcept,
  applyPatch,
  canStart,
  defaultSettings,
  isAllTargetsSelected,
  nextSelectAllTargets,
  NO_LESSON_HINT,
  NO_TARGET_HINT,
  normalizeSettings,
  startHint,
  toggleTarget,
  validatePatch,
} from './settings.js'
import { FORM_IDS } from './forms.js'

const DICT = 'dictionary-form'
const MASU = 'masu-form'

describe('settings defaults', () => {
  it('starts with no lessons and the documented form defaults', () => {
    const settings = defaultSettings()
    expect(settings.dict.lessons).toEqual([])
    expect(settings.dict.defaultForm).toBe(MASU)
    expect(settings.card.from).toBe(MASU)
    expect(settings.quiz.from).toBe(MASU)
    expect(settings.card.to).toEqual([DICT])
    expect(settings.quiz.to).toEqual([DICT])
  })

  it('falls back to ます形 when a stored object has no form default', () => {
    // Older or hand-edited storage: the missing field must take the new default.
    const settings = normalizeSettings({ dict: { lessons: [4] }, card: { lessons: [4] } })
    expect(settings.dict.defaultForm).toBe(MASU)
    expect(settings.card.from).toBe(MASU)
    expect(settings.card.to).toEqual([DICT])
  })
})

describe('normalizeSettings', () => {
  it('falls back per-field on invalid values and drops unknown keys', () => {
    const settings = normalizeSettings({
      dict: { lessons: [2, 1], defaultForm: 'nope', extra: true },
      card: { to: ['ta-form', 'ta-form'], showGroup: 'yes' },
    })
    expect(settings.dict.lessons).toEqual([1, 2])
    expect(settings.dict.defaultForm).toBe(MASU)
    expect(settings.dict).not.toHaveProperty('extra')
    expect(settings.card.to).toEqual([DICT])
    expect(settings.card.showGroup).toBe(true)
  })

  it('removes the source form from 到 when restoring', () => {
    const settings = normalizeSettings({
      quiz: { from: MASU, to: [MASU] },
    })
    expect(settings.quiz.to).toEqual([DICT])
  })
})

describe('settings.patch validation', () => {
  it('accepts a known patch', () => {
    expect(validatePatch({ quiz: { autoSubmit: true } })).toEqual({ ok: true })
  })

  it('rejects unknown sections, unknown fields and bad values', () => {
    expect(validatePatch({ nope: {} }).ok).toBe(false)
    expect(validatePatch({ dict: { nope: 1 } }).ok).toBe(false)
    expect(validatePatch({ dict: { defaultForm: 'nope' } }).ok).toBe(false)
    expect(validatePatch({ card: { to: [MASU, MASU] } }).ok).toBe(false)
    expect(validatePatch({ dict: { lessons: [1, '2'] } }).ok).toBe(false)
    expect(validatePatch(null).ok).toBe(false)
  })
})

describe('applyPatch', () => {
  it('removes the new source form from 到', () => {
    const settings = applyPatch(defaultSettings(), {
      card: { from: DICT },
    })
    expect(settings.card.to).toEqual([MASU])
  })

  it('never leaves 到 empty, falling back to the opposite default', () => {
    const settings = applyPatch(defaultSettings(), {
      card: { from: MASU, to: [MASU] },
    })
    expect(settings.card.to).toEqual([DICT])
  })

  it('sorts lessons and keeps form order canonical', () => {
    const settings = applyPatch(defaultSettings(), {
      dict: { lessons: [5, 2] },
      quiz: { to: [MASU, DICT] },
    })
    expect(settings.dict.lessons).toEqual([2, 5])
    expect(settings.quiz.to).toEqual([DICT])
  })
})

describe('全選 到', () => {
  it('selects every form except 從', () => {
    expect(allTargetsExcept(MASU)).toHaveLength(FORM_IDS.length - 1)
    expect(nextSelectAllTargets([DICT], MASU)).toEqual(allTargetsExcept(MASU))
  })

  it('clears to the 字典形 fallback when everything is already selected', () => {
    const all = allTargetsExcept(MASU)
    expect(isAllTargetsSelected(all, MASU)).toBe(true)
    expect(nextSelectAllTargets(all, MASU)).toEqual([DICT])
    expect(nextSelectAllTargets(allTargetsExcept(DICT), DICT)).toEqual([MASU])
  })
})

describe('canStart', () => {
  it('requires lessons, and 到 for card and quiz', () => {
    const settings = defaultSettings()
    expect(canStart(settings, 'dict')).toBe(false)
    settings.dict.lessons = [2]
    expect(canStart(settings, 'dict')).toBe(true)
    settings.card.lessons = [2]
    settings.card.to = []
    expect(canStart(settings, 'card')).toBe(false)
  })
})

describe('toggleTarget', () => {
  it('adds and removes a form', () => {
    expect(toggleTarget([DICT], MASU)).toEqual([DICT, MASU])
    expect(toggleTarget([DICT, MASU], DICT)).toEqual([MASU])
  })
})

describe('錯 X 題就顯示答案', () => {
  it('defaults to 3', () => {
    expect(defaultSettings().quiz.revealAfter).toBe(3)
  })

  it('accepts 1 to 5 only', () => {
    expect(validatePatch({ quiz: { revealAfter: 1 } })).toEqual({ ok: true })
    expect(validatePatch({ quiz: { revealAfter: 5 } })).toEqual({ ok: true })
    expect(validatePatch({ quiz: { revealAfter: 0 } }).ok).toBe(false)
    expect(validatePatch({ quiz: { revealAfter: 6 } }).ok).toBe(false)
    expect(validatePatch({ quiz: { revealAfter: '3' } }).ok).toBe(false)
    expect(validatePatch({ quiz: { revealAfter: 2.5 } }).ok).toBe(false)
  })

  it('survives a restore and falls back to 3 when invalid', () => {
    expect(normalizeSettings({ quiz: { revealAfter: 4 } }).quiz.revealAfter).toBe(4)
    expect(normalizeSettings({ quiz: { revealAfter: 9 } }).quiz.revealAfter).toBe(3)
  })

  it('persists a patch', () => {
    const patched = applyPatch(defaultSettings(), { quiz: { revealAfter: 2 } })
    expect(patched.quiz.revealAfter).toBe(2)
  })
})

describe('startHint', () => {
  it('asks for a lesson before anything else, in every mode', () => {
    const settings = defaultSettings()
    expect(startHint(settings, 'dict')).toBe(NO_LESSON_HINT)
    expect(startHint(settings, 'card')).toBe(NO_LESSON_HINT)
    expect(startHint(settings, 'quiz')).toBe(NO_LESSON_HINT)
    expect(NO_LESSON_HINT).toBe('請至少選擇一門課程才可以開始')
  })

  it('puts the lesson hint ahead of the 轉型 hint', () => {
    const settings = defaultSettings()
    settings.card.lessons = []
    settings.card.to = []
    expect(startHint(settings, 'card')).toBe(NO_LESSON_HINT)
    settings.card.lessons = [2]
    expect(startHint(settings, 'card')).toBe(NO_TARGET_HINT)
  })

  it('asks for a 轉型 once 到 is emptied', () => {
    const settings = defaultSettings()
    settings.card.lessons = [2]
    settings.card.to = []
    expect(startHint(settings, 'card')).toBe(NO_TARGET_HINT)
    settings.quiz.lessons = [2]
    settings.quiz.to = []
    expect(startHint(settings, 'quiz')).toBe(NO_TARGET_HINT)
    expect(NO_TARGET_HINT).toBe('請至少選擇一個轉型才可以開始')
  })

  it('says nothing while a lesson and a target form are selected', () => {
    const settings = defaultSettings()
    settings.card.lessons = [2]
    settings.quiz.lessons = [2]
    settings.dict.lessons = [2]
    expect(startHint(settings, 'card')).toBe(null)
    expect(startHint(settings, 'quiz')).toBe(null)
    expect(startHint(settings, 'dict')).toBe(null)
  })

  it('never shows the 轉型 hint in dictionary mode', () => {
    const settings = defaultSettings()
    settings.dict.lessons = [2]
    expect(startHint(settings, 'dict')).toBe(null)
  })

  it('matches canStart: the hint shows exactly when 開始 is disabled for 到', () => {
    const settings = defaultSettings()
    settings.card.lessons = [2]
    settings.card.to = []
    expect(canStart(settings, 'card')).toBe(false)
    expect(Boolean(startHint(settings, 'card'))).toBe(true)
    settings.card.to = ['dictionary-form']
    expect(canStart(settings, 'card')).toBe(true)
    expect(startHint(settings, 'card')).toBe(null)
  })
})
