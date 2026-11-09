// Which pills each card side carries.
//
// The front's verb-class pill follows 一開始顯示幾類動詞. The answer side always
// carries both pills — the form that was asked, then the verb's class — because
// the reader needs to know what the answer is and which class it belongs to.
// Neither answer pill reads a setting.
import { formName, groupLabel } from '../dict/forms.js'

export function frontTags(settings, source) {
  if (!settings?.showGroup || !source) return []
  return [{ kind: 'group', text: groupLabel(source.group), className: 'tag--group' }]
}

export function backTags(targetFormId, target) {
  if (!targetFormId) return []
  const tags = [{ kind: 'form', text: formName(targetFormId), className: 'tag--form' }]
  const group = target?.group
  if (group !== undefined && group !== null) {
    tags.push({ kind: 'group', text: groupLabel(group), className: 'tag--group' })
  }
  return tags
}
