// Reader form ordering and labelling.
//
// The block for the 預設顯示形式 form comes first; the other forms keep the
// canonical order. Every block names its form, but only the first block shows
// the 群組 / 第N課 pills, so those are not repeated 15 times.
//
// Each entry also carries the note layer the view renders: the form's own
// `note` (shown above the example sentences, marked with colour), and
// `errorUsage` — a form flagged `error_usage` is kept for conjugation
// practice only, so its word is coloured with the error colour and it never
// has example sentences. Each sentence's own `note` rides along in `data.sentence`.
import { FORMS } from '../dict/forms.js'

export function orderedFormEntries(verb, defaultFormId, options = {}) {
  if (!verb) return []
  const { skipErrorUsage = false, displayForms = null } = options
  const visible =
    Array.isArray(displayForms) && displayForms.length > 0 ? new Set(displayForms) : null
  let entries = FORMS.filter((form) => verb[form.id]).map((form) => ({
    id: form.id,
    name: form.name,
    data: verb[form.id],
    note: verb[form.id].note || null,
    errorUsage: verb[form.id].error_usage === true,
    isDefault: form.id === defaultFormId,
  }))
  // The default form was present but 選擇顯示的類型 or 跳過錯誤的單詞 hides it:
  // the first remaining form takes its place and opens the word.
  const defaultWasHidden =
    (visible !== null && entries.some((entry) => entry.isDefault && !visible.has(entry.id))) ||
    (skipErrorUsage && entries.some((entry) => entry.isDefault && entry.errorUsage))
  if (visible !== null) entries = entries.filter((entry) => visible.has(entry.id))
  if (skipErrorUsage) entries = entries.filter((entry) => !entry.errorUsage)
  let at = entries.findIndex((entry) => entry.isDefault)
  if (at < 0 && defaultWasHidden && entries.length > 0) {
    entries[0] = { ...entries[0], isDefault: true }
    at = 0
  }
  if (at > 0) entries.unshift(...entries.splice(at, 1))
  return entries.map((entry, index) => ({ ...entry, isFirst: index === 0 }))
}
