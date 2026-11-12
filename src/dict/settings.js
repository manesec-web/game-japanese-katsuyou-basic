// Settings defaults, validation, and patching. Plain data; no storage here.
import { FORM_IDS } from './forms.js'
import { DEFAULT_REVEAL_AFTER, isValidRevealAfter } from './quiz.js'

export const SETTINGS_KEY = 'katsuyou-settings'
export const MODE_KEYS = ['dict', 'card', 'quiz']

export function makeDefaults() {
  return {
    dict: {
      lessons: [],
      // 預設顯示形式 starts at ます形, like 從 in cards and quiz.
      defaultForm: 'masu-form',
      // 選擇顯示的類型: every form is shown by default; the user can hide
      // forms they have not learned yet.
      displayForms: [...FORM_IDS],
      showReading: true,
      // 跳過錯誤的單詞: hide the error_usage forms in the reader.
      skipErrorUsage: false,
    },
    card: {
      lessons: [],
      from: 'masu-form',
      to: ['dictionary-form'],
      showReading: true,
      showGroup: true,
      // 跳過錯誤的單詞: drop cards whose target is an error_usage form.
      skipErrorUsage: false,
    },
    quiz: {
      lessons: [],
      from: 'masu-form',
      to: ['dictionary-form'],
      showReading: true,
      autoSubmit: true,
      // 錯 X 題就顯示答案
      revealAfter: DEFAULT_REVEAL_AFTER,
      // 跳過錯誤的單詞: drop quiz items whose target is an error_usage form.
      skipErrorUsage: false,
    },
  }
}

export function defaultSettings() {
  return makeDefaults()
}

const SCHEMA = {
  dict: {
    lessons: 'lessons',
    defaultForm: 'form',
    displayForms: 'forms',
    showReading: 'boolean',
    skipErrorUsage: 'boolean',
  },
  card: {
    lessons: 'lessons',
    from: 'form',
    to: 'forms',
    showReading: 'boolean',
    showGroup: 'boolean',
    skipErrorUsage: 'boolean',
  },
  quiz: {
    lessons: 'lessons',
    from: 'form',
    to: 'forms',
    showReading: 'boolean',
    autoSubmit: 'boolean',
    revealAfter: 'revealAfter',
    skipErrorUsage: 'boolean',
  },
}

function isForm(value) {
  return typeof value === 'string' && FORM_IDS.includes(value)
}

function isBoolean(value) {
  return typeof value === 'boolean'
}

function isLessonArray(value) {
  return (
    Array.isArray(value) &&
    value.every((n) => Number.isInteger(n) && n >= 1 && n <= 50) &&
    new Set(value).size === value.length
  )
}

function isFormArray(value) {
  return (
    Array.isArray(value) &&
    value.every(isForm) &&
    new Set(value).size === value.length
  )
}

function validValue(kind, value) {
  switch (kind) {
    case 'lessons':
      return isLessonArray(value)
    case 'form':
      return isForm(value)
    case 'forms':
      return isFormArray(value)
    case 'boolean':
      return isBoolean(value)
    case 'revealAfter':
      return isValidRevealAfter(value)
    default:
      return false
  }
}

function cleanLessons(value) {
  return [...value].sort((a, b) => a - b)
}

function cleanForms(value) {
  return FORM_IDS.filter((id) => value.includes(id))
}

// Merge stored/session data onto defaults. Unknown keys are dropped and an
// invalid value falls back to that field's default (the spec says a missing
// field uses the default; invalid JSON resets the whole object upstream).
export function normalizeSettings(raw) {
  const defaults = makeDefaults()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults
  for (const mode of MODE_KEYS) {
    const source = raw[mode]
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    for (const [key, kind] of Object.entries(SCHEMA[mode])) {
      const value = source[key]
      if (!validValue(kind, value)) continue
      if (kind === 'lessons') defaults[mode][key] = cleanLessons(value)
      else if (kind === 'forms') defaults[mode][key] = cleanForms(value)
      else defaults[mode][key] = value
    }
  }
  for (const mode of ['card', 'quiz']) {
    const settings = defaults[mode]
    if (settings.to.includes(settings.from)) {
      settings.to = settings.to.filter((id) => id !== settings.from)
      if (settings.to.length === 0) settings.to = [fallbackTarget(settings.from)]
    }
  }
  // The 預設顯示形式 is always one of the drawn forms: it is the block the
  // reader opens on, so a stored selection that misses it gets it back.
  const dict = defaults.dict
  if (!dict.displayForms.includes(dict.defaultForm)) {
    dict.displayForms = cleanForms([...dict.displayForms, dict.defaultForm])
  }
  return defaults
}

// Validate a settings.patch payload. Any unknown key or bad value rejects the
// whole patch, as the spec requires.
export function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, message: 'patch must be an object' }
  }
  for (const [mode, value] of Object.entries(patch)) {
    if (!MODE_KEYS.includes(mode)) {
      return { ok: false, message: `unknown settings section: ${mode}` }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, message: `${mode} patch must be an object` }
    }
    const schema = SCHEMA[mode]
    for (const [key, field] of Object.entries(value)) {
      if (!(key in schema)) {
        return { ok: false, message: `unknown setting: ${mode}.${key}` }
      }
      if (!validValue(schema[key], field)) {
        return { ok: false, message: `invalid value for ${mode}.${key}` }
      }
    }
  }
  return { ok: true }
}

export function applyPatch(settings, patch) {
  const next = JSON.parse(JSON.stringify(settings))
  for (const [mode, value] of Object.entries(patch)) {
    for (const [key, field] of Object.entries(value)) {
      const kind = SCHEMA[mode]?.[key]
      if (key === 'lessons') next[mode].lessons = cleanLessons(field)
      else if (kind === 'forms') next[mode][key] = cleanForms(field)
      else next[mode][key] = field
    }
  }
  for (const mode of ['card', 'quiz']) {
    if (next[mode].to.includes(next[mode].from)) {
      next[mode].to = next[mode].to.filter((id) => id !== next[mode].from)
      if (next[mode].to.length === 0) {
        next[mode].to = [fallbackTarget(next[mode].from)]
      }
    }
  }
  // The 預設顯示形式 is always displayed (spec): a patch that removes it, or
  // that picks a new default that is not in the selection, leaves it selected.
  if (!next.dict.displayForms.includes(next.dict.defaultForm)) {
    next.dict.displayForms = cleanForms([...next.dict.displayForms, next.dict.defaultForm])
  }
  return next
}

export function fallbackTarget(from) {
  return from === 'dictionary-form' ? 'masu-form' : 'dictionary-form'
}

export function allTargetsExcept(from) {
  return FORM_IDS.filter((id) => id !== from)
}

export function isAllTargetsSelected(to, from) {
  const expected = allTargetsExcept(from)
  return expected.length === to.length && expected.every((id) => to.includes(id))
}

// 全選 beside 到: select every form except 從; when that is already complete,
// leave only 字典形, or ます形 when 從 is already 字典形.
export function nextSelectAllTargets(to, from) {
  if (isAllTargetsSelected(to, from)) return [fallbackTarget(from)]
  return allTargetsExcept(from)
}

export function toggleTarget(to, id) {
  return to.includes(id) ? to.filter((item) => item !== id) : [...to, id]
}

// 選擇顯示的類型: the control follows the selection, like the lesson-wide
// 全選. Pressing 取消全選 cannot clear the reader's opening block, so the
// default form is the one form that stays.
export const SELECT_ALL_DISPLAY_FORMS = '全選'
export const CLEAR_ALL_DISPLAY_FORMS = '取消全選'

export function allDisplayFormsSelected(displayForms) {
  return FORM_IDS.length === displayForms.length && FORM_IDS.every((id) => displayForms.includes(id))
}

export function selectAllDisplayLabel(displayForms) {
  return allDisplayFormsSelected(displayForms) ? CLEAR_ALL_DISPLAY_FORMS : SELECT_ALL_DISPLAY_FORMS
}

export function nextSelectAllDisplayForms(displayForms, defaultForm) {
  return allDisplayFormsSelected(displayForms) ? [defaultForm] : [...FORM_IDS]
}

// Copy shown on the disabled 開始 button when the user cleared every 到 chip.
// Dictionary mode has no 轉型 to choose, so it never shows this.
export const NO_TARGET_HINT = '請至少選擇一個轉型才可以開始'

// Copy shown on the disabled 開始 button when no lesson is chosen yet. It comes
// first: a run with no vocabulary cannot start even when 到 still holds forms.
export const NO_LESSON_HINT = '請至少選擇一門課程才可以開始'

// The button's own label names the missing requirement, so a disabled action
// always says why instead of showing a bare red 開始. A lesson comes before a
// 轉型, so the lesson message never shares the button with the 轉型 message.
export function startHint(settings, mode) {
  const modeSettings = settings[mode]
  if (!modeSettings) return null
  if (modeSettings.lessons.length === 0) return NO_LESSON_HINT
  if (mode === 'dict') return null
  return modeSettings.to.length === 0 ? NO_TARGET_HINT : null
}

export function canStart(settings, mode) {
  const modeSettings = settings[mode]
  if (!modeSettings || modeSettings.lessons.length === 0) return false
  if (mode === 'dict') return true
  return modeSettings.to.length > 0
}
