// Dictionary reader navigation. Index is clamped: the first item does not
// move backward, the last item does not move forward.
export function specs() {
  function ready(session) {
    return session.screen === 'reader' && session.items.length > 0
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
  ]
}
