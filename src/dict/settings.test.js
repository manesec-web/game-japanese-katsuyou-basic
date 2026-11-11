import { describe, expect, it } from 'vitest'
import {
  allTargetsExcept,
  applyPatch,
  canStart,
  defaultSettings,
  isAllTargetsSelected,
  nextSelectAllDisplayForms,
  nextSelectAllTargets,
  NO_LESSON_HINT,
  NO_TARGET_HINT,
  normalizeSettings,
  selectAllDisplayLabel,
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

describe('跳過錯誤的單詞', () => {
  it('defaults to off', () => {
    expect(defaultSettings().dict.skipErrorUsage).toBe(false)
    expect(defaultSettings().card.skipErrorUsage).toBe(false)
    expect(defaultSettings().quiz.skipErrorUsage).toBe(false)
  })

  it('accepts a boolean patch and rejects a non-boolean', () => {
    expect(validatePatch({ dict: { skipErrorUsage: true } })).toEqual({ ok: true })
    expect(validatePatch({ card: { skipErrorUsage: true } })).toEqual({ ok: true })
    expect(validatePatch({ quiz: { skipErrorUsage: true } })).toEqual({ ok: true })
    expect(validatePatch({ dict: { skipErrorUsage: false } })).toEqual({ ok: true })
    expect(validatePatch({ card: { skipErrorUsage: 'yes' } }).ok).toBe(false)
    expect(validatePatch({ quiz: { skipErrorUsage: 'yes' } }).ok).toBe(false)
  })

  it('persists a patch and survives a restore', () => {
    const patched = applyPatch(defaultSettings(), { card: { skipErrorUsage: true } })
    expect(patched.card.skipErrorUsage).toBe(true)
    expect(normalizeSettings({ card: { skipErrorUsage: true } }).card.skipErrorUsage).toBe(true)
    expect(normalizeSettings({ card: { skipErrorUsage: 'yes' } }).card.skipErrorUsage).toBe(false)
  })
})

describe('選擇顯示的類型', () => {
  it('defaults to every form', () => {
    expect(defaultSettings().dict.displayForms).toEqual(FORM_IDS)
  })

  it('accepts a valid form array and rejects bad values', () => {
    expect(validatePatch({ dict: { displayForms: [DICT, MASU] } })).toEqual({ ok: true })
    expect(validatePatch({ dict: { displayForms: [] } })).toEqual({ ok: true })
    expect(validatePatch({ dict: { displayForms: ['nope'] } }).ok).toBe(false)
    expect(validatePatch({ dict: { displayForms: [DICT, DICT] } }).ok).toBe(false)
  })

  it('cleans to canonical order, persists, and survives a restore', () => {
    // The 預設顯示形式 (ます形 here) is always one of the drawn forms, so it is
    // added back even though the patch did not name it.
    const patched = applyPatch(defaultSettings(), { dict: { displayForms: ['te-form', DICT] } })
    expect(patched.dict.displayForms).toEqual([DICT, MASU, 'te-form'])
    expect(normalizeSettings({ dict: { displayForms: ['te-form'] } }).dict.displayForms).toEqual([
      MASU,
      'te-form',
    ])
    expect(normalizeSettings({ dict: { displayForms: 'nope' } }).dict.displayForms).toEqual(FORM_IDS)
  })

  it('reads 取消全選 only once all 15 forms are selected', () => {
    expect(selectAllDisplayLabel(FORM_IDS)).toBe('取消全選')
    expect(selectAllDisplayLabel(FORM_IDS.slice(1))).toBe('全選')
    expect(selectAllDisplayLabel([MASU])).toBe('全選')
    expect(selectAllDisplayLabel([])).toBe('全選')
  })

  it('selects all 15 from 全選, then leaves only the default from 取消全選', () => {
    const few = [MASU, DICT]
    const all = nextSelectAllDisplayForms(few, MASU)
    expect(all).toEqual(FORM_IDS)
    expect(nextSelectAllDisplayForms(all, MASU)).toEqual([MASU])
    // The same rule follows a different current 預設顯示形式.
    expect(nextSelectAllDisplayForms(all, DICT)).toEqual([DICT])
  })

  it('keeps the label in step with a manually toggled chip', () => {
    const small = nextSelectAllDisplayForms([MASU], MASU)
    expect(selectAllDisplayLabel(small)).toBe('取消全選')
    const patched = applyPatch(defaultSettings(), {
      dict: { displayForms: small.filter((id) => id !== DICT) },
    })
    expect(selectAllDisplayLabel(patched.dict.displayForms)).toBe('全選')
    const restored = applyPatch(patched, { dict: { displayForms: [...patched.dict.displayForms, DICT] } })
    expect(selectAllDisplayLabel(restored.dict.displayForms)).toBe('取消全選')
  })

  it('clears through settings.patch without ever dropping the default form', () => {
    const patched = applyPatch(defaultSettings(), {
      dict: { displayForms: nextSelectAllDisplayForms(FORM_IDS, DICT), defaultForm: DICT },
    })
    expect(patched.dict.displayForms).toEqual([DICT])
    expect(selectAllDisplayLabel(patched.dict.displayForms)).toBe('全選')
    expect(normalizeSettings(patched).dict.displayForms).toEqual([DICT])
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

// The 預設顯示形式 is the block the reader opens on, so it is always one of the
// drawn forms: the settings screen disables its chip, and the data layer keeps
// the invariant for a patch or a stored selection that tries to drop it.
describe('the default form stays displayed', () => {
  it('adds a new default form to the selection', () => {
    const patched = applyPatch(defaultSettings(), { dict: { defaultForm: DICT } })
    expect(patched.dict.defaultForm).toBe(DICT)
    expect(patched.dict.displayForms).toContain(DICT)
  })

  it('restores the default form when a patch removes it', () => {
    const patched = applyPatch(defaultSettings(), {
      dict: { displayForms: FORM_IDS.filter((id) => id !== MASU) },
    })
    expect(patched.dict.defaultForm).toBe(MASU)
    expect(patched.dict.displayForms).toContain(MASU)
    // The rest of the selection is kept, in canonical order.
    expect(patched.dict.displayForms).toEqual(FORM_IDS)
  })

  it('keeps only the default form when every other chip is cleared', () => {
    const patched = applyPatch(defaultSettings(), { dict: { displayForms: [] } })
    expect(patched.dict.displayForms).toEqual([MASU])
  })

  it('repairs a stored selection that misses its default form', () => {
    const restored = normalizeSettings({
      dict: { defaultForm: 'te-form', displayForms: [MASU, 'dictionary-form'] },
    })
    expect(restored.dict.defaultForm).toBe('te-form')
    expect(restored.dict.displayForms).toContain('te-form')
    expect(restored.dict.displayForms).toEqual(['dictionary-form', MASU, 'te-form'])
  })
})
