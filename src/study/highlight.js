// Marking the studied word inside an example sentence.
//
// The dictionary gives every form its own `sentence` list, and each of those
// sentences contains that form's `vol` verbatim (checked by the test that walks
// vol/). So an exact substring match is enough: no reading/kanji guesswork, and
// the sentence is never rewritten.
export const HIGHLIGHT_CLASS = 'sentence-hit'

// Split `text` into plain and highlighted runs around every occurrence of
// `word`. Runs concatenate back to `text`, in order, with no characters lost.
export function highlightSegments(text, word) {
  const source = typeof text === 'string' ? text : ''
  const needle = typeof word === 'string' ? word : ''
  const plainOnly = [{ text: source, highlight: false }]
  if (!needle || !source.includes(needle)) return plainOnly

  const segments = []
  let cursor = 0
  while (cursor < source.length) {
    const at = source.indexOf(needle, cursor)
    if (at === -1) break
    if (at > cursor) segments.push({ text: source.slice(cursor, at), highlight: false })
    segments.push({ text: needle, highlight: true })
    cursor = at + needle.length
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), highlight: false })
  return segments.length ? segments : plainOnly
}

// Convenience for the view: the runs of one sentence, ready to render.
export function sentenceParts(sentence, word) {
  return highlightSegments(sentence?.japanese ?? '', word)
}
