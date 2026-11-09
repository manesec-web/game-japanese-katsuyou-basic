import { reactive } from 'vue'
import { createSession } from '../engine/session.js'

// Thin Vue adapter: the session is the source of truth, `send` is dispatch.
export function createStore(reg, deps = {}) {
  const session = reactive(createSession())

  function send(id, params) {
    return reg.dispatch(session, id, params)
  }

  return { session, send, deps }
}
