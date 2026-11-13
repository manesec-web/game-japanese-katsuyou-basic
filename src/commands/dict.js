// Dictionary reader navigation. Index is clamped: the first item does not
// move backward, the last item does not move forward.
import { CommandError } from '../engine/errors.js'

export function specs() {
  function ready(session) {
    return session.screen === 'reader' && session.items.length > 0
  }

  // 單詞目錄 lists the run's words; a press on a row jumps the reader to that
  // word. Only an integer inside the list is a jump: anything else is an error
  // and leaves the session on the list, so the press cannot move the run to a
  // word that is not there.
  function jumpable(session) {
    return session.screen === 'toc' && session.items.length > 0
  }

  return [
    {
      id: 'dict.next',
      params: [],
      enabled: ready,
      run: (session) => {
        if (session.index < session.items.length - 1) session.index += 1
        return { index: session.index }
      },
    },
    {
      id: 'dict.prev',
      params: [],
      enabled: ready,
      run: (session) => {
        if (session.index > 0) session.index -= 1
        return { index: session.index }
      },
    },
    {
      id: 'dict.goto',
      params: ['index'],
      enabled: jumpable,
      run: (session, params) => {
        const index = params.index
        if (!Number.isInteger(index) || index < 0 || index >= session.items.length) {
          throw new CommandError('invalid-index', `No word at index ${String(index)}`, {
            index,
            count: session.items.length,
          })
        }
        session.index = index
        session.screen = 'reader'
        return { index: session.index, screen: session.screen }
      },
    },
  ]
}
