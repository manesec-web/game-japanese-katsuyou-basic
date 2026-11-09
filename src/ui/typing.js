// Maps the text-field value the browser reports to quiz.input operations, so
// the view only renders and dispatches.
export function typingEdits(current, next) {
  if (next === current) return []
  if (next.startsWith(current)) {
    return [{ op: 'append', text: next.slice(current.length) }]
  }
  if (current.startsWith(next)) {
    const deletes = current.length - next.length
    return Array.from({ length: deletes }, () => ({ op: 'backspace' }))
  }
  // A replacement (e.g. IME composition): clear, then type the new text.
  const ops = Array.from({ length: current.length }, () => ({ op: 'backspace' }))
  if (next !== '') ops.push({ op: 'append', text: next })
  return ops
}
