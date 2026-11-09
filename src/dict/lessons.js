// Lesson list helpers shared by the picker command and the picker view.
//
// A lesson entry is { lesson, hasVerbs }. Lessons without verbs (1, 3, 8, 12)
// can never be selected, so the 全選 control ignores them.

export function verbLessons(entries) {
  return entries
    .filter((entry) => entry.hasVerbs)
    .map((entry) => entry.lesson)
    .sort((a, b) => a - b)
}

export function allVerbLessonsSelected(entries, selected) {
  const all = verbLessons(entries)
  return all.length > 0 && all.every((lesson) => selected.includes(lesson))
}

export const SELECT_ALL_LABEL = '全選'
export const CLEAR_ALL_LABEL = '取消全選'

// The picker's lesson-wide control reads 全選 until every lesson with verbs is
// selected; then it offers 取消全選, which is what lessons.selectAll does next.
export function selectAllLabel(entries, selected) {
  return allVerbLessonsSelected(entries, selected) ? CLEAR_ALL_LABEL : SELECT_ALL_LABEL
}

// Copy for the hint on a lesson chip that has no verbs.
export const EMPTY_LESSON_HINT = '該課沒有動詞'
