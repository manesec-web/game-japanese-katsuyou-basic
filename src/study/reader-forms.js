// Reader form ordering and labelling.
//
// The block for the 預設顯示形式 form comes first; the other forms keep the
// canonical order. Every block names its form, but only the first block shows
// the 群組 / 第N課 pills, so those are not repeated 15 times.
import { FORMS } from '../dict/forms.js'

export function orderedFormEntries(verb, defaultFormId) {
  if (!verb) return []
  const entries = FORMS.filter((form) => verb[form.id]).map((form) => ({
    id: form.id,
    name: form.name,
    data: verb[form.id],
    isDefault: form.id === defaultFormId,
  }))
  const at = entries.findIndex((entry) => entry.isDefault)
  if (at > 0) entries.unshift(...entries.splice(at, 1))
  return entries.map((entry, index) => ({ ...entry, isFirst: index === 0 }))
}
