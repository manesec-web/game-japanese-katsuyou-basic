// Asynchronous commands (app.boot) return a Promise of the same envelope.
// Synchronous commands return the envelope directly.
export function settle(fn) {
  try {
    const value = fn()
    if (value && typeof value.then === 'function') {
      return value.then(
        (result) => ({ ok: true, result: result === undefined ? null : result }),
        (error) => toFailure(error),
      )
    }
    return { ok: true, result: value === undefined ? null : value }
  } catch (error) {
    return toFailure(error)
  }
}

function toFailure(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string') {
    const failure = { code: error.code, message: error.message ?? error.code }
    if (error.details !== undefined) failure.details = error.details
    return { ok: false, error: failure }
  }
  return {
    ok: false,
    error: { code: 'command-failed', message: errorMessage(error) },
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
