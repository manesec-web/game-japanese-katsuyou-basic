// 學習 (grammar reference) helpers. Pure, except that the injected `library`
// supplies the dictionary verbs; the commands and views both call these, so no
// screen derives a rule or a list itself.
import { FORM_IDS, FORMS } from '../dict/forms.js'
import { highlightSegments, matchFormRanges } from './toc.js'

// Global tips shown as a numbered list at the bottom of every 變形說明 page.
// Plain strings: the view renders them as 1. / 2. / … so the reader can work
// through the mechanism step by step.
export const RULE_TIPS = [
  '先認「從」和「到」兩個形，再看第一類的段／音便對應，最後用「例如」挑一個單詞，對著原理把紅色語尾劃掉、換上紫色假名。',
  '五段的口訣是「一個語幹，五個段」：辭書形 う段、ます形 い段、ない形 あ段、可能／命令／ば形 え段、意向形 お段。語尾（ます、ない、た……）只是再接上去，先找到最後一個假名就不會亂。',
  '第二類（一段）語幹完全不動，只換語尾（食べる → 食べます／食べない／食べて）；第三類只有 する 與 来る，連語幹讀音都會變，整組背起來反而快。',
  '三個最常錯的地方：① う 結尾接 あ段 要寫「わ」不是「あ」（買う → 買わない）；② 行く 是 か行 例外，走促音便 行った／行って；③ た／て 前面是 ぐ・む・ぶ・ぬ 時要濁音 だ／で（読んだ、泳いで）。',
  '「看似二類，其實一類」的 る 結尾動詞要個別記：帰る、切る、知る、入る、要る、走る、減る、滑る → 帰ります／帰らない／帰って（不是 帰ます／帰ない／帰て）。',
  'ある 的否定直接是 ない／なかった（沒有「あらない」）；「名詞＋する」的可能形是 できる（勉強する → 勉強できる），「〜をする」還要把 を 改成 が（無理をする → 無理ができる）。',
  '反向也一樣：把「到」當起點倒推回去即可。例如 行って → 行く 要先還原促音便（って → う／つ／る），再靠單詞本身判斷是哪一個；音便無法單靠字形反推，所以辭書形一定要記。',
]

// The heading above the explanation: 從 {from} 到 {to} 的變形如下.
export function ruleTitle(fromId, toId) {
  const from = FORMS.find((form) => form.id === fromId)
  const to = FORMS.find((form) => form.id === toId)
  if (!from || !to) return ''
  return `從 ${from.name} 到 ${to.name} 的變形如下`
}

// The 到 dropdown lists every form except 從, so the two are never equal.
export function targetFormIds(fromId) {
  return FORM_IDS.filter((id) => id !== fromId)
}

// Look up the authored explanation for an ordered (from, to) pair. Returns the
// entry or null; a null entry is a data error that must not ship (see
// missingPairs), but while a pair is still being authored it renders a muted
// fallback in the view.
export function findRule(content, fromId, toId) {
  if (!Array.isArray(content)) return null
  return content.find((entry) => entry.from === fromId && entry.to === toId) ?? null
}

// Every ordered pair with 從 ≠ 到 that has no entry yet (15 × 14 = 210 pairs
// in total). The completeness test locks this at zero once authoring is done.
export function missingPairs(content) {
  const missing = []
  for (const from of FORM_IDS) {
    for (const to of FORM_IDS) {
      if (from === to) continue
      if (!findRule(content, from, to)) missing.push({ from, to })
    }
  }
  return missing
}

// Resolve the chosen example word (`{ lesson, index }`) back to a verb inside
// the library's lesson order, or null when the reference points nowhere.
export function exampleVerb(library, example) {
  if (!library || !example) return null
  if (!Number.isInteger(example.lesson) || !Number.isInteger(example.index)) return null
  const entry = library.getVerbs([example.lesson])[example.index]
  if (!entry) return null
  return { lesson: entry.lesson, verb: entry.verb }
}

// Every verb in the dictionary, one row each, in lesson order then JSON order.
// `index` is the verb's position inside its lesson — the reference the
// `rule.selectExample` command stores and `exampleVerb` resolves.
export function exampleRows(library) {
  if (!library) return []
  const rows = []
  for (const lesson of library.verbLessons()) {
    library.getVerbs([lesson]).forEach(({ verb }, index) => {
      rows.push({ lesson, index, verb })
    })
  }
  return rows
}

// Group the example rows by lesson for the 選字 screen, and filter them by the
// search query. The list shows the given form (the current 從), not always the
// dictionary form: a row matches when the query appears in that form's `vol`,
// in its `japanese` reading (a Latin query converted to kana first), or in the
// lesson number; the matched word is painted red — the same rules 單詞目錄 uses.
// Lessons with no surviving row leave no heading.
export function exampleGroups(rows, query = '', formId = 'dictionary-form') {
  const needle = (query ?? '').trim()
  const groups = []
  for (const row of rows ?? []) {
    const form = row?.verb?.[formId]
    const vol = typeof form?.vol === 'string' ? form.vol : ''
    const japanese = typeof form?.japanese === 'string' ? form.japanese : ''
    let ranges = []
    if (needle) {
      ranges = matchFormRanges(needle, vol, japanese)
      const lessonMatch = String(row.lesson).includes(needle)
      if (ranges.length === 0 && !lessonMatch) continue
    }
    const parts = highlightSegments(vol, ranges)
    let group = groups[groups.length - 1]
    if (!group || group.lesson !== row.lesson) {
      group = { lesson: row.lesson, rows: [] }
      groups.push(group)
    }
    group.rows.push({ ...row, parts })
  }
  return groups
}
