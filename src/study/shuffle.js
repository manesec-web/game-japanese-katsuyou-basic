// Fisher–Yates shuffle. Pure: returns a new array and never mutates the input,
// so a started study session keeps one frozen order.
export function shuffle(items, random = Math.random) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return out
}
