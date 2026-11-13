import { SCREENS, MODES } from '../engine/session.js'

// 單詞目錄 belongs to the dictionary reader only: it lists that run's frozen
// words, so there is nothing to show before a run started or from another mode.
function reachable(session, screen) {
  if (screen === 'toc') return session.screen === 'reader' && session.items.length > 0
  return true
}

export function specs() {
  return [
    {
      id: 'nav.go',
      params: ['screen'],
      enabled: (session, params) =>
        SCREENS.includes(params.screen) &&
        reachable(session, params.screen) &&
        (params.mode === undefined || MODES.includes(params.mode)),
      run: (session, params) => {
        session.screen = params.screen
        if (params.mode !== undefined) session.mode = params.mode
        return { screen: session.screen, mode: session.mode }
      },
    },
  ]
}
