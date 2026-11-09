import { CommandError } from '../engine/errors.js'
import { formName } from '../dict/forms.js'
import { recordCorrect, recordMiss } from '../study/results.js'
import {
  isCorrect,
  missHint,
  missesUntilReveal,
  revealAfterFor,
  shouldReveal,
} from '../dict/quiz.js'

function freshAnswer() {
  return { input: '', wrong: 0, revealed: false, verdict: null }
}

export function specs() {
  const ready = (session) => session.screen === 'quiz' && session.items.length > 0
  const formOf = (session) => {
    const item = session.items[session.index]
    return item?.verb?.[item.targetForm] ?? null
  }

  const isLast = (session) => session.index >= session.items.length - 1

  // What goes into the wrong-word list: the prompt word and the form that was
  // asked, plus the answer that was revealed.
  function missEntry(session) {
    const item = session.items[session.index]
    const source = item?.verb?.[session.settings.quiz.from] ?? null
    const asked = formOf(session)
    return {
      vol: source?.vol ?? '',
      reading: source?.japanese ?? '',
      formName: formName(item?.targetForm),
      answer: asked?.vol ?? '',
    }
  }

  function moveToNext(session) {
    if (session.index < session.items.length - 1) session.index += 1
    session.answer = freshAnswer()
  }

  function grade(session) {
    const form = formOf(session)
    if (!form) throw new CommandError('quiz-no-item', 'no quiz item is loaded')

    if (isCorrect(session.answer.input, form)) {
      recordCorrect(session.results)
      if (isLast(session)) {
        session.finished = true
        session.answer = freshAnswer()
        return {
          status: 'correct',
          index: session.index,
          finished: true,
          vol: form.vol,
          japanese: form.japanese,
        }
      }
      moveToNext(session)
      return {
        status: 'correct',
        index: session.index,
        vol: form.vol,
        japanese: form.japanese,
      }
    }

    const revealAfter = revealAfterFor(session.settings.quiz)
    session.answer.wrong += 1
    if (shouldReveal(session.answer.wrong, revealAfter)) {
      session.answer.revealed = true
      session.answer.verdict = 'revealed'
      recordMiss(session.results, missEntry(session))
      return {
        status: 'revealed',
        wrong: session.answer.wrong,
        vol: form.vol,
        japanese: form.japanese,
      }
    }
    session.answer.verdict = 'wrong'
    return {
      status: 'wrong',
      wrong: session.answer.wrong,
      remaining: missesUntilReveal(session.answer.wrong, revealAfter),
      hint: missHint(session.answer.wrong, revealAfter),
    }
  }

  return [
    {
      id: 'quiz.input',
      params: ['op'],
      enabled: (session, params) => {
        if (!ready(session) || session.answer.revealed) return false
        if (params.op === 'append') return typeof params.text === 'string' && params.text !== ''
        return params.op === 'backspace'
      },
      run: (session, params) => {
        if (params.op === 'append') session.answer.input += params.text
        else session.answer.input = session.answer.input.slice(0, -1)
        session.answer.verdict = null

        const form = formOf(session)
        if (
          session.settings.quiz.autoSubmit &&
          form &&
          session.answer.input !== '' &&
          isCorrect(session.answer.input, form)
        ) {
          const outcome = grade(session)
          return { input: session.answer.input, autoSubmitted: true, ...outcome }
        }
        return { input: session.answer.input, autoSubmitted: false }
      },
    },
    {
      id: 'quiz.submit',
      params: [],
      enabled: (session) =>
        ready(session) && !session.answer.revealed && session.answer.input.trim() !== '',
      run: (session) => grade(session),
    },
    {
      id: 'quiz.advance',
      params: [],
      enabled: (session) => ready(session) && session.answer.revealed,
      run: (session) => {
        // The revealed answer waits for this press; only then does the run
        // move on, and the last item ends it.
        if (isLast(session)) {
          session.finished = true
          session.answer = freshAnswer()
          return { index: session.index, finished: true }
        }
        moveToNext(session)
        return { index: session.index }
      },
    },
  ]
}
