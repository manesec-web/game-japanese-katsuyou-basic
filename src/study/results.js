// Per-run results for the quiz. One item is either answered correctly or
// missed (its answer had to be revealed). Percentage is correct over the
// items that were actually resolved.
export function createResults() {
  return { correct: 0, wrong: 0, misses: [] }
}

export function recordCorrect(results) {
  results.correct += 1
  return results
}

// `miss` is { vol, reading, formName, answer }, taken from the item.
export function recordMiss(results, miss) {
  results.wrong += 1
  results.misses.push(miss)
  return results
}

export function resolvedCount(results) {
  return results.correct + results.wrong
}

export function accuracy(results) {
  const total = resolvedCount(results)
  if (total === 0) return 0
  return Math.round((results.correct / total) * 100)
}

export const COMPLETE_TITLE = '恭喜，你已經做完了練習。'

// Celebration copy for the completion screen.
//
// Both modes show a single emoji above the title, chosen once when the panel
// mounts. Card practice draws from the bowing figures; the quiz draws from the
// row that matches its score.
export const PRACTICE_EMOJI = ['🙇‍♂️', '🙇', '🙇‍♀️']

// One row per ten percent. A score of 87% reads the 80% row: it belongs to
// that band, and only an exact 90 lands in the 90% row.
export const SCORE_BANDS = [
  { percent: 0, emojis: ['💀', '☠️', '😭', '🥲', '🫠'] },
  { percent: 10, emojis: ['😭', '😢', '😿', '🥺', '🫥'] },
  { percent: 20, emojis: ['😔', '😞', '😩', '😫', '😮‍💨'] },
  { percent: 30, emojis: ['😕', '😟', '🙁', '😬', '😓'] },
  { percent: 40, emojis: ['😐', '😶', '😑', '🫤', '🤔'] },
  { percent: 50, emojis: ['🙂', '😊', '😌', '🌱', '✨'] },
  { percent: 60, emojis: ['😁', '😄', '😃', '🌟', '⭐'] },
  { percent: 70, emojis: ['🤩', '😎', '🔥', '💪', '🚀'] },
  { percent: 80, emojis: ['😍', '🥰', '💖', '💯', '🎯'] },
  { percent: 90, emojis: ['🥳', '🎊', '🎉', '🏅', '🏆'] },
  {
    percent: 100,
    emojis: [
      '🎉', '🥳', '🎊', '🎆', '🎇', '🏆', '🥇', '👑', '💐', '🎁',
      '✨', '🌈', '🪅', '🎈', '🤩', '🙌', '👏', '💖', '❤️‍🔥', '💯',
    ],
  },
]

// The decade a percentage belongs to: 87 -> 80, 90 -> 90, 100 -> 100.
export function scoreBand(percent) {
  const value = Number(percent)
  // Floor before bucketing so 89.9 stays in the 80% row.
  const safe = Number.isFinite(value) ? Math.floor(value) : 0
  const clamped = Math.max(0, Math.min(100, safe))
  return Math.floor(clamped / 10) * 10
}

export function bandEmojis(percent) {
  const band = scoreBand(percent)
  return SCORE_BANDS.find((row) => row.percent === band)?.emojis ?? SCORE_BANDS[0].emojis
}

function randomAt(length, rand) {
  const value = Math.min(0.999999, Math.max(0, Number(rand()) || 0))
  return Math.floor(value * length)
}

export function pickOne(list, rand = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null
  return list[randomAt(list.length, rand)]
}

export function practiceEmoji(rand = Math.random) {
  return pickOne(PRACTICE_EMOJI, rand)
}

// The one emoji shown above the title, drawn from that score's band.
export function scoreEmoji(percent, rand = Math.random) {
  return pickOne(bandEmojis(percent), rand)
}

// A perfect run is the only run that gets the confetti.
export function isPerfectScore(percent) {
  return Number(percent) >= 100
}

// Confetti pieces are random in position, delay, size and speed, and the list
// is fixed when the panel mounts so nothing jumps on a re-render.
export const CONFETTI_EMOJI = ['🎉', '🎊', '🎆', '🎇', '🎈', '🪅', '🎁', '💐', '⭐', '✨', '🏆', '🥇']

export function confettiPieces(count = 22, rand = Math.random) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    emoji: CONFETTI_EMOJI[randomAt(CONFETTI_EMOJI.length, rand)],
    left: Math.round(randomAt(1000, rand) / 10), // 0.0–99.9 %
    delay: Math.round(randomAt(2200, rand)) / 1000, // 0–2.2 s
    duration: Math.round((2400 + randomAt(2200, rand))) / 1000, // 2.4–4.6 s
    size: 14 + randomAt(16, rand), // 14–29 px
    drift: Math.round(randomAt(120, rand)) - 60, // -60 to +60 px
  }))
}
