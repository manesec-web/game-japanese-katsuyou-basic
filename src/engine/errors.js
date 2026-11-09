// Typed command error. dispatch converts { code, message, details } into the
// `{ ok: false, error }` envelope.
export class CommandError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'CommandError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}
