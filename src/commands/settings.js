import { CommandError } from '../engine/errors.js'
import { applyPatch, validatePatch } from '../dict/settings.js'

export function specs(deps = {}) {
  const settingsStorage = deps.settingsStorage

  return [
    {
      id: 'settings.patch',
      params: ['patch'],
      run: (session, params) => {
        const validation = validatePatch(params.patch)
        if (!validation.ok) {
          throw new CommandError('invalid-settings', validation.message)
        }
        session.settings = applyPatch(session.settings, params.patch)
        if (settingsStorage) settingsStorage.save(session.settings)
        return { settings: session.settings }
      },
    },
  ]
}
