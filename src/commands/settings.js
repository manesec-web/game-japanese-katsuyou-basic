import { CommandError } from '../engine/errors.js'
import { applyPatch, validatePatch } from '../dict/settings.js'
import { reconcileQuizQueue } from '../study/items.js'

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
        const before = session.settings.quiz.skipErrorUsage
        session.settings = applyPatch(session.settings, params.patch)
        const after = session.settings.quiz.skipErrorUsage
        if (settingsStorage) settingsStorage.save(session.settings)

        // 跳過錯誤的單詞 can flip while a quiz is running: reconcile the queue
        // without disturbing the answered items behind the current one. Turning
        // it on also removes the item on screen when that item is error_usage;
        // when nothing follows, the run ends right away.
        const quizPatch = params.patch?.quiz
        if (
          session.mode === 'quiz' &&
          !session.finished &&
          session.items.length > 0 &&
          quizPatch &&
          'skipErrorUsage' in quizPatch &&
          before !== after
        ) {
          const reconciled = reconcileQuizQueue(
            session.items,
            session.quizSkipped ?? [],
            session.index,
            after,
          )
          session.items = reconciled.items
          session.quizSkipped = reconciled.skipped
          if (after && session.index >= session.items.length) {
            session.finished = true
          }
        }
        return { settings: session.settings }
      },
    },
  ]
}
