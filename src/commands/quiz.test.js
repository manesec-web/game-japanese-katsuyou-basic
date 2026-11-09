import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as studySpecs } from './study.js'
import { specs as quizSpecs } from './quiz.js'

const VERB_A = {
  'dictionary-form': { vol: '行く', japanese: 'いく' },
  'masu-form': { vol: '行きます', japanese: 'いきます' },
}
const VERB_B = {
  'dictionary-form': { vol: '来る', japanese: 'くる' },
  'masu-form': { vol: '来ます', japanese: 'きます' },
}

function fakeLibrary(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
  }
}

function setup({ autoSubmit = true, revealAfter } = {}) {
  const registry = createRegistry()
  const library = fakeLibrary({ 5: [VERB_A, VERB_B] })
  // Grading tests use the unshuffled order: a random() just below 1 makes
  // Fisher–Yates swap each slot with itself.
  registry.registerAll([...studySpecs({ library, random: () => 0.99 }), ...quizSpecs()])
  const session = createSession()
  session.mode = 'quiz'
  session.settings.quiz.lessons = [5]
  session.settings.quiz.from = 'masu-form'
  session.settings.quiz.to = ['dictionary-form']
  session.settings.quiz.autoSubmit = autoSubmit
  if (revealAfter !== undefined) session.settings.quiz.revealAfter = revealAfter
  registry.dispatch(session, 'study.start', {})
  return { registry, session }
}

describe('quiz.input', () => {
  it('appends and deletes characters, keeping the input on a wrong item', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    expect(session.answer.input).toBe('あ')
    registry.dispatch(session, 'quiz.input', { op: 'backspace' })
    expect(session.answer.input).toBe('')
  })

  it('rejects an empty append and an unknown op', () => {
    const { registry, session } = setup()
    expect(registry.dispatch(session, 'quiz.input', { op: 'append', text: '' }).ok).toBe(false)
    expect(registry.dispatch(session, 'quiz.input', { op: 'nope' }).ok).toBe(false)
  })

  it('submits automatically while 自動提交答案 is on', () => {
    const { registry, session } = setup({ autoSubmit: true })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'い' })
    const result = registry.dispatch(session, 'quiz.input', { op: 'append', text: 'く' })
    expect(result.ok).toBe(true)
    expect(result.result.status).toBe('correct')
    expect(result.result.autoSubmitted).toBe(true)
    expect(session.index).toBe(1)
    expect(session.answer.input).toBe('')
  })

  it('does not grade automatically while the switch is off', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'い' })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'く' })
    expect(session.answer.input).toBe('いく')
    expect(session.index).toBe(0)
  })
})

describe('quiz.submit grading', () => {
  it('accepts the reading and moves to the next item', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'いく' })
    const result = registry.dispatch(session, 'quiz.submit', {})
    expect(result.result.status).toBe('correct')
    expect(session.index).toBe(1)
    expect(session.answer).toEqual({ input: '', wrong: 0, revealed: false, verdict: null })
  })

  it('accepts the written form with katakana or whitespace', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: ' イ ク ' })
    const result = registry.dispatch(session, 'quiz.submit', {})
    expect(result.result.status).toBe('correct')
  })

  it('stays on the item after a wrong answer and keeps the input', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    const result = registry.dispatch(session, 'quiz.submit', {})
    expect(result.result.status).toBe('wrong')
    expect(session.index).toBe(0)
    expect(session.answer.input).toBe('あ')
    expect(session.answer.wrong).toBe(1)
    expect(session.answer.revealed).toBe(false)
  })

  it('reveals on the third wrong answer and blocks input until advance', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    for (let i = 0; i < 2; i += 1) {
      registry.dispatch(session, 'quiz.submit', {})
    }
    expect(session.answer.revealed).toBe(false)
    expect(session.answer.wrong).toBe(2)

    const third = registry.dispatch(session, 'quiz.submit', {})
    expect(third.result.status).toBe('revealed')
    expect(session.answer.revealed).toBe(true)
    expect(session.answer.wrong).toBe(3)
    expect(third.result.vol).toBe('行く')
    expect(third.result.japanese).toBe('いく')

    expect(registry.dispatch(session, 'quiz.input', { op: 'append', text: 'い' }).ok).toBe(false)
    expect(registry.dispatch(session, 'quiz.submit', {}).ok).toBe(false)

    const advanced = registry.dispatch(session, 'quiz.advance', {})
    expect(advanced.ok).toBe(true)
    expect(session.index).toBe(1)
    expect(session.answer.revealed).toBe(false)
    expect(session.answer.input).toBe('')
  })

  it('cannot advance before the answer is revealed', () => {
    const { registry, session } = setup({ autoSubmit: false })
    const result = registry.dispatch(session, 'quiz.advance', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.index).toBe(0)
  })

  it('requires a non-empty answer before submitting', () => {
    const { registry, session } = setup()
    expect(registry.dispatch(session, 'quiz.submit', {}).ok).toBe(false)
  })

  it('counts down the misses before the reveal', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    const first = registry.dispatch(session, 'quiz.submit', {})
    expect(first.result.hint).toBe('再答錯 2 題就顯示答案')
    expect(first.result.remaining).toBe(2)
    const second = registry.dispatch(session, 'quiz.submit', {})
    expect(second.result.hint).toBe('再答錯 1 題就顯示答案')
    expect(session.answer.revealed).toBe(false)
  })

  it('reveals on the first miss when 錯 1 題 is set', () => {
    const { registry, session } = setup({ autoSubmit: false, revealAfter: 1 })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    const first = registry.dispatch(session, 'quiz.submit', {})
    expect(first.result.status).toBe('revealed')
    expect(session.answer.revealed).toBe(true)
    expect(session.answer.wrong).toBe(1)
    expect(registry.dispatch(session, 'quiz.input', { op: 'append', text: 'い' }).ok).toBe(false)
  })

  it('waits for the fifth miss when 錯 5 題 is set', () => {
    const { registry, session } = setup({ autoSubmit: false, revealAfter: 5 })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    for (let i = 0; i < 4; i += 1) {
      const miss = registry.dispatch(session, 'quiz.submit', {})
      expect(miss.result.status).toBe('wrong')
      expect(session.answer.revealed).toBe(false)
      expect(session.index).toBe(0)
    }
    expect(session.answer.wrong).toBe(4)
    const fifth = registry.dispatch(session, 'quiz.submit', {})
    expect(fifth.result.status).toBe('revealed')
    expect(fifth.result.vol).toBe('行く')
    expect(fifth.result.japanese).toBe('いく')
    expect(session.answer.wrong).toBe(5)
    // The revealed answer does not advance by itself.
    expect(session.index).toBe(0)
    registry.dispatch(session, 'quiz.advance', {})
    expect(session.index).toBe(1)
  })

  it('falls back to 3 misses when the setting is missing', () => {
    const { registry, session } = setup({ autoSubmit: false })
    delete session.settings.quiz.revealAfter
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    for (let i = 0; i < 2; i += 1) registry.dispatch(session, 'quiz.submit', {})
    expect(session.answer.revealed).toBe(false)
    expect(registry.dispatch(session, 'quiz.submit', {}).result.status).toBe('revealed')
  })
})

describe('finishing a quiz run', () => {
  it('finishes right after a correct answer on the last item', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'いく' })
    const first = registry.dispatch(session, 'quiz.submit', {})
    expect(first.result.status).toBe('correct')
    expect(session.index).toBe(1)
    expect(session.finished).toBe(false)

    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'くる' })
    const last = registry.dispatch(session, 'quiz.submit', {})
    expect(last.result.status).toBe('correct')
    expect(session.finished).toBe(true)
    expect(session.results.correct).toBe(2)
    expect(session.results.wrong).toBe(0)
  })

  it('tallies correct and missed items and lists the missed word', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'いく' })
    registry.dispatch(session, 'quiz.submit', {})
    expect(session.index).toBe(1)

    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'あ' })
    for (let i = 0; i < 3; i += 1) registry.dispatch(session, 'quiz.submit', {})
    expect(session.answer.revealed).toBe(true)
    expect(session.results.wrong).toBe(1)
    expect(session.results.misses).toEqual([
      { vol: '来ます', reading: 'きます', formName: '字典形', answer: '来る' },
    ])
    // The answer is revealed but the run only ends on 下一題.
    expect(session.finished).toBe(false)

    const advanced = registry.dispatch(session, 'quiz.advance', {})
    expect(advanced.result.finished).toBe(true)
    expect(session.finished).toBe(true)
    expect(session.results.correct).toBe(1)
    expect(session.results.wrong).toBe(1)
  })

  it('resets the tally when a new run starts', () => {
    const { registry, session } = setup({ autoSubmit: false })
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'いく' })
    registry.dispatch(session, 'quiz.submit', {})
    expect(session.results.correct).toBe(1)
    registry.dispatch(session, 'study.start', {})
    expect(session.results).toEqual({ correct: 0, wrong: 0, misses: [] })
    expect(session.finished).toBe(false)
    expect(session.index).toBe(0)
  })
})
