import { CommandError } from '../engine/errors.js'

export function specs(deps = {}) {
  const library = deps.library
  const settingsStorage = deps.settingsStorage

  function modeSettings(session) {
    return session.settings[session.mode]
  }

  function persist(session) {
    if (settingsStorage) settingsStorage.save(session.settings)
  }

  return [
    {
      id: 'lessons.toggle',
      params: ['lesson'],
      enabled: (session, params) =>
        Number.isInteger(params.lesson) && params.lesson >= 1 && params.lesson <= 50,
      run: (session, params) => {
        if (!library || !library.hasVerbs(params.lesson)) {
          throw new CommandError('lesson-empty', `第${params.lesson}課沒有動詞`, {
            lesson: params.lesson,
          })
        }
        const settings = modeSettings(session)
        const selected = settings.lessons.includes(params.lesson)
        settings.lessons = selected
          ? settings.lessons.filter((lesson) => lesson !== params.lesson)
          : [...settings.lessons, params.lesson].sort((a, b) => a - b)
        persist(session)
        return { lessons: settings.lessons }
      },
    },
    {
      id: 'lessons.selectAll',
      params: [],
      run: (session) => {
        const all = library ? library.verbLessons() : []
        const settings = modeSettings(session)
        const allSelected =
          all.length > 0 && all.every((lesson) => settings.lessons.includes(lesson))
        settings.lessons = allSelected ? [] : all
        persist(session)
        return { lessons: settings.lessons }
      },
    },
  ]
}
