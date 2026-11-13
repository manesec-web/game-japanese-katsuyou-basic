// Loading-bar percentage. Pure so the view stays thin and the rule is testable.
//
// The bar never moves backwards and never shows work that has not happened:
//
// - While `dict/vol.bin` is streaming, the bar fills from the share of lessons
//   the cache check already verified (`download.base`) up to 100% in proportion
//   to bytes received. A response without Content-Length cannot be measured,
//   so the bar holds at the base until the bytes arrive.
// - When the bytes have arrived (`download.done`), the bar stays at 100% while
//   the extracted lessons are verified and stored: that step is fast, and a
//   full bar reads as "download finished", not as a stall.
// - Without a download (the usual reload, where stored copies are only
//   re-hashed), the bar is verified lessons / total.
export function bootPercent(boot) {
  if (!boot) return 0
  const total = Number(boot.total) || 0
  const checked = Number(boot.checked) || 0
  const verified = total > 0 ? Math.min(1, checked / total) * 100 : 0

  const download = boot.download || {}
  if (download.done) return 100

  const bytes = Number(download.total) || 0
  if (bytes > 0) {
    const base = Math.max(0, Math.min(100, Number(download.base) || 0))
    const received = Math.max(0, Math.min(bytes, Number(download.loaded) || 0))
    return Math.round(Math.min(100, base + (100 - base) * (received / bytes)))
  }

  return Math.round(verified)
}
