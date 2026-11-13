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
