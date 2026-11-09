// Flashcards: tap flips, swipe moves. Every move returns the card to its face.
export function specs() {
  function ready(session) {
    return session.screen === 'card' && session.items.length > 0
  }

  function move(session, delta) {
    const next = session.index + delta
    if (next >= 0 && next < session.items.length) session.index = next
    session.flipped = false
    return { index: session.index, flipped: session.flipped }
  }

  return [
    {
      id: 'card.flip',
      params: [],
      enabled: ready,
      run: (session) => {
        session.flipped = !session.flipped
        return { flipped: session.flipped }
      },
    },
    {
      id: 'card.next',
      params: [],
      enabled: ready,
      run: (session) => move(session, 1),
    },
    {
      id: 'card.prev',
      params: [],
      enabled: ready,
      run: (session) => move(session, -1),
    },
  ]
}
