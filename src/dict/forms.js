// The 15 conjugation forms, in the canonical order used everywhere
// (data files, pickers, card ordering). On-screen names are product copy.
export const FORMS = [
  { id: 'dictionary-form', name: '字典形' },
  { id: 'masu-form', name: 'ます形' },
  { id: 'masu-form-negative', name: 'ません形' },
  { id: 'masu-form-past', name: 'ました形' },
  { id: 'masu-form-past-negative', name: 'ませんでした形' },
  { id: 'nai-form', name: 'ない形' },
  { id: 'ta-form', name: 'た形' },
  { id: 'nakatta-form', name: 'なかった形' },
  { id: 'te-form', name: 'て形' },
  { id: 'potential-form', name: '可能形' },
  { id: 'volitional-form', name: '意向形' },
  { id: 'imperative-form', name: '命令形' },
  { id: 'conditional-form', name: 'ば形' },
  { id: 'passive-form', name: '受身形' },
  { id: 'causative-form', name: '使役形' },
]

export const FORM_IDS = FORMS.map((form) => form.id)

export const GROUP_LABELS = {
  0: '例外',
  1: '1類動詞',
  2: '2類動詞',
  3: '3類動詞',
}

export function formName(id) {
  return FORMS.find((form) => form.id === id)?.name ?? id
}

export function groupLabel(group) {
  return GROUP_LABELS[group] ?? String(group)
}
