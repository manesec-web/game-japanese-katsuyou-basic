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
      showReading: true,
    },
    card: {
      lessons: [],
      from: 'masu-form',
      to: ['dictionary-form'],
      showReading: true,
      showGroup: true,
    },
    quiz: {
      lessons: [],
      from: 'masu-form',
      to: ['dictionary-form'],
      showReading: true,
      autoSubmit: true,
      // 錯 X 題就顯示答案
      revealAfter: DEFAULT_REVEAL_AFTER,
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
    showReading: 'boolean',
  },
  card: {
    lessons: 'lessons',
    from: 'form',
    to: 'forms',
    showReading: 'boolean',
    showGroup: 'boolean',
  },
  quiz: {
    lessons: 'lessons',
    from: 'form',
    to: 'forms',
    showReading: 'boolean',
    autoSubmit: 'boolean',
    revealAfter: 'revealAfter',
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
      if (key === 'lessons') next[mode].lessons = cleanLessons(field)
      else if (key === 'to') next[mode].to = cleanForms(field)
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

// Copy shown above 開始 when the user cleared every 到 chip. Dictionary mode
// has no 轉型 to choose, so it never shows this.
export const NO_TARGET_HINT = '請至少選擇一個轉型才可以開始'

// Copy shown above 開始 when no lesson is chosen yet. It comes first: a run
// with no vocabulary cannot start even when 到 still holds forms.
export const NO_LESSON_HINT = '請至少選擇一門課程才可以開始'

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
