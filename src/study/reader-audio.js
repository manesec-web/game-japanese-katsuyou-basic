// Pure helpers that turn a reader entry into the data `audio.play` needs.
// The target id is stable for the run (item index + form id + sentence
// index), so the transient playing/downloading state can attach to the right
// element across the paging window.
export function wordAudioTarget(entry, form) {
  return {
    target: `word:${entry.at}:${form.id}`,
    lesson: entry.lesson,
    text: form.data?.vol ?? '',
  }
}

export function sentenceAudioTarget(entry, form, index) {
  const sentence = form.data?.sentence?.[index]
  return {
    target: `sentence:${entry.at}:${form.id}:${index}`,
    lesson: entry.lesson,
    text: sentence?.japanese ?? '',
  }
}

export function audioState(states, target) {
  return states?.[target] ?? null
}
