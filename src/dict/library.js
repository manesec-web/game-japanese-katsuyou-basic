// In-memory dictionary library. Loads the verified IndexedDB copies once, then
// answers selection questions for the picker and item builders.
import { CommandError } from '../engine/errors.js'

export function createLibrary({ store, manifest } = {}) {
  let loaded = false
  let lessons = []

  async function load() {
    if (loaded) return summary()
    if (!store || !manifest) throw new CommandError('library-missing', 'library dependencies are not configured')
    const next = []
    for (const entry of manifest.lessons) {
      const bytes = await store.read(entry.file)
      if (!bytes) {
        throw new CommandError('library-missing', `dictionary file not in IndexedDB: ${entry.file}`, {
          lesson: entry.lesson,
        })
      }
      let vols
      try {
        const text = new TextDecoder().decode(bytes)
        vols = JSON.parse(text)?.[`lesson_${entry.lesson}`]?.vols
      } catch (error) {
        throw new CommandError('library-invalid', `cannot parse ${entry.file}: ${error.message}`, {
          lesson: entry.lesson,
        })
      }
      next.push({ lesson: entry.lesson, vols: Array.isArray(vols) ? vols : [] })
    }
    lessons = next
    loaded = true
    return summary()
  }

  function summary() {
    return lessons.map(({ lesson, vols }) => ({
      lesson,
      hasVerbs: vols.length > 0,
      verbCount: vols.length,
    }))
  }

  function hasVerbs(lesson) {
    const entry = lessons.find((item) => item.lesson === lesson)
    return Boolean(entry && entry.vols.length > 0)
  }

  function verbLessons() {
    return lessons.filter((entry) => entry.vols.length > 0).map((entry) => entry.lesson)
  }

  // Verbs for the given lessons in lesson order, keeping the JSON order inside
  // each lesson. Each item keeps the lesson number and the verb object.
  function getVerbs(lessonNumbers) {
    const wanted = new Set(lessonNumbers)
    const result = []
    for (const entry of lessons) {
      if (!wanted.has(entry.lesson)) continue
      for (const vol of entry.vols) {
        result.push({ lesson: entry.lesson, verb: vol })
      }
    }
    return result
  }

  function lessonCount() {
    return lessons.length
  }

  function isValidForm(verb, formId) {
    return Boolean(verb && verb[formId])
  }

  return {
    load,
    summary,
    hasVerbs,
    verbLessons,
    getVerbs,
    lessonCount,
    isValidForm,
  }
}
