import { SCREENS, MODES } from '../engine/session.js'

export function specs() {
  return [
    {
      id: 'nav.go',
      params: ['screen'],
      enabled: (session, params) =>
        SCREENS.includes(params.screen) &&
        (params.mode === undefined || MODES.includes(params.mode)),
      run: (session, params) => {
        session.screen = params.screen
        if (params.mode !== undefined) session.mode = params.mode
        return { screen: session.screen, mode: session.mode }
      },
    },
  ]
}
