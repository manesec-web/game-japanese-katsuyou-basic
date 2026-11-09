import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { highlightSegments, sentenceParts } from './highlight.js'

const withoutHighlight = (segments) =>
  segments.filter((segment) => !segment.highlight).map((segment) => segment.text).join('')

describe('highlightSegments', () => {
  it('returns one plain run when the word is absent', () => {
    expect(highlightSegments('この 傘は 私のと 色が 違う。', 'ありません')).toEqual([
      { text: 'この 傘は 私のと 色が 違う。', highlight: false },
    ])
  })

  it('marks a kanji form where it appears', () => {
    expect(highlightSegments('値段は 店によって 違う。', '違う')).toEqual([
      { text: '値段は 店によって ', highlight: false },
      { text: '違う', highlight: true },
      { text: '。', highlight: false },
    ])
  })

  it('marks a kana form where it appears', () => {
    expect(highlightSegments('この 言葉の 意味が わかる。', 'わかる')).toEqual([
      { text: 'この 言葉の 意味が ', highlight: false },
      { text: 'わかる', highlight: true },
      { text: '。', highlight: false },
    ])
  })

  it('marks a katakana form where it appears', () => {
    expect(highlightSegments('彼は 毎日 コピーします。', 'コピーします')).toEqual([
      { text: '彼は 毎日 ', highlight: false },
      { text: 'コピーします', highlight: true },
      { text: '。', highlight: false },
    ])
  })

  it('marks every occurrence, in order', () => {
    expect(highlightSegments('違う と 違う は 違う', '違う')).toEqual([
      { text: '違う', highlight: true },
      { text: ' と ', highlight: false },
      { text: '違う', highlight: true },
      { text: ' は ', highlight: false },
      { text: '違う', highlight: true },
    ])
  })

  it('keeps the text intact when the word is the whole sentence', () => {
    expect(highlightSegments('違う', '違う')).toEqual([{ text: '違う', highlight: true }])
  })

  it('has a plain fallback for empty input', () => {
    expect(highlightSegments('', '違う')).toEqual([{ text: '', highlight: false }])
    expect(highlightSegments('違う', '')).toEqual([{ text: '違う', highlight: false }])
    expect(highlightSegments(undefined, undefined)).toEqual([{ text: '', highlight: false }])
  })

  it('never loses or reorders characters', () => {
    const text = 'この 本の 内容は 前のと 違います。'
    const segments = highlightSegments(text, '違います')
    expect(segments.map((segment) => segment.text).join('')).toBe(text)
    expect(withoutHighlight([{ text, highlight: false }])).toBe(text)
  })
})

describe('sentenceParts', () => {
  it('reads the japanese line of a sentence', () => {
    const sentence = { japanese: '私の 答えは 教科書のと 違いません。', chinese: '我的答案…' }
    expect(sentenceParts(sentence, '違いません')).toEqual([
      { text: '私の 答えは 教科書のと ', highlight: false },
      { text: '違いません', highlight: true },
      { text: '。', highlight: false },
    ])
  })

  it('survives a missing sentence', () => {
    expect(sentenceParts(null, '違う')).toEqual([{ text: '', highlight: false }])
  })
})

// The rule above only holds if the data keeps the form's own word inside its
// example sentences. This walks every lesson and fails if a form loses it.
describe('vol/ sentences contain the form word', () => {
  const volDir = path.resolve(process.cwd(), 'vol')
  const lessons = Array.from({ length: 50 }, (_, i) => `lesson_${i + 1}.json`)

  it('holds for every form of every verb', () => {
    let forms = 0
    let sentences = 0
    for (const file of lessons) {
      const raw = JSON.parse(fs.readFileSync(path.join(volDir, file), 'utf8'))
      const payload = raw[`lesson_${file.match(/\d+/)[0]}`]
      for (const verb of payload.vols) {
        for (const [formId, data] of Object.entries(verb)) {
          forms += 1
          const hits = (data.sentence ?? []).filter((line) =>
            highlightSegments(line.japanese, data.vol).some((part) => part.highlight),
          )
          expect(hits.length, `${file} ${formId} ${data.vol}`).toBeGreaterThan(0)
          sentences += (data.sentence ?? []).length
        }
      }
    }
    expect(forms).toBe(5790)
    expect(sentences).toBeGreaterThan(forms)
  })
})
