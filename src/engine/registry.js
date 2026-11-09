// Command registry and dispatch.
//
// A command spec is plain data plus functions:
//   { id, params?, enabled?(session, params), run(session, params) }
// dispatch never throws; every failure is an { ok: false, error } result.
// An async run returns a Promise of that same envelope.
import { settle } from './settle.js'

function failure(code, message, details) {
  const error = { code, message }
  if (details !== undefined) error.details = details
  return { ok: false, error }
}

export function createRegistry() {
  const commands = new Map()

  function register(spec) {
    if (!spec || typeof spec !== 'object') {
      throw new TypeError('command spec must be an object')
    }
    if (typeof spec.id !== 'string' || spec.id === '') {
      throw new TypeError('command spec needs a non-empty string id')
    }
    if (typeof spec.run !== 'function') {
      throw new TypeError(`command ${spec.id} needs a run function`)
    }
    if (commands.has(spec.id)) {
      throw new Error(`duplicate command id: ${spec.id}`)
    }
    const params = Array.isArray(spec.params) ? [...spec.params] : []
    commands.set(spec.id, {
      id: spec.id,
      params,
      enabled: typeof spec.enabled === 'function' ? spec.enabled : null,
      run: spec.run,
    })
    return spec.id
  }

  function registerAll(specs) {
    for (const spec of specs) register(spec)
    return commands.size
  }

  function get(id) {
    return commands.get(id) ?? null
  }

  function list() {
    return [...commands.values()]
  }

  function dispatch(session, id, params = {}) {
    if (typeof id !== 'string' || id === '') {
      return failure('unknown-command', `Unknown command: ${String(id)}`)
    }
    const command = commands.get(id)
    if (!command) {
      return failure('unknown-command', `Unknown command: ${id}`)
    }
    if (params !== null && typeof params !== 'object') {
      return failure('invalid-params', `${id} expects a params object`)
    }
    const supplied = params ?? {}
    const missing = command.params.filter((name) => !(name in supplied))
    if (missing.length > 0) {
      return failure('missing-param', `${id} requires: ${missing.join(', ')}`, {
        missing,
      })
    }

    if (command.enabled) {
      let allowed
      try {
        allowed = command.enabled(session, supplied)
      } catch (error) {
        return failure('command-failed', errorMessage(error))
      }
      if (!allowed) {
        return failure('command-disabled', `${id} is not available`)
      }
    }

    return settle(() => command.run(session, supplied))
  }

  return { register, registerAll, get, list, dispatch }
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

export const registry = createRegistry()
export const dispatch = registry.dispatch
