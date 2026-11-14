// 單詞目錄 rows: the frozen run list, grouped by lesson.
//
// The reader's item list is already lesson-ascending, with the run order kept
// inside a lesson (the dictionary builds it straight from the JSON order), so a
// new group starts whenever the lesson changes. Each row keeps the list index
// the jump command needs, the word shown on screen, and the current flag the
// view prints — the view never re-derives a row.
export function tocGroups(items, currentIndex = -1) {
  const groups = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    let group = groups[groups.length - 1]
    if (!group || group.lesson !== item?.lesson) {
      group = { lesson: item?.lesson, rows: [] }
      groups.push(group)
    }
    group.rows.push({
      index,
      lesson: item?.lesson,
      word: item?.verb?.['dictionary-form']?.vol ?? '',
      current: index === currentIndex,
    })
  }
  return groups
}

// A search row matches when the query appears as a substring of the word's
// dictionary-form text, or of the lesson number (the digits of the 第N課 tag),
// so 5 matches lessons 5, 15, 25, … A blank query matches every row.
export function tocRowMatches(item, query) {
  const needle = (query ?? '').trim()
  if (!needle) return true
  const word = item?.verb?.['dictionary-form']?.vol ?? ''
  const lesson = item?.lesson ?? ''
  return word.includes(needle) || String(lesson).includes(needle)
}

// The filtered 單詞目錄: same grouping as tocGroups, but only rows that match
// the query survive, and a lesson with no surviving row leaves no heading.
export function filterTocGroups(items, currentIndex = -1, query = '') {
  const needle = (query ?? '').trim()
  if (!needle) return tocGroups(items, currentIndex)
  const groups = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!tocRowMatches(item, needle)) continue
    const lesson = item?.lesson
    let group = groups[groups.length - 1]
    if (!group || group.lesson !== lesson) {
      group = { lesson, rows: [] }
      groups.push(group)
    }
    group.rows.push({
      index,
      lesson,
      word: item?.verb?.['dictionary-form']?.vol ?? '',
      current: index === currentIndex,
    })
  }
  return groups
}
