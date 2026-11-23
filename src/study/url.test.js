import { describe, expect, it } from 'vitest'
import { DEEP_LINK_SCREENS, deepLinkQuery, deepLinkUrl, deepLinkWord, parseDeepLink, resolveWord } from './url.js'

const f = (vol, japanese = vol) => ({ vol, japanese })

// A small fake library over a few lessons, mirroring `getVerbs`'s shape:
// lesson-ascending `{ lesson, verb }` entries in JSON order.
function libraryWith(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
  }
}

describe('DEEP_LINK_SCREENS', () => {
  it('lists the four target screens', () => {
    expect(DEEP_LINK_SCREENS).toEqual(['reader', 'toc', 'rule', 'learn'])
  })
})

describe('parseDeepLink', () => {
  it('returns null for a blank or non-string input', () => {
    expect(parseDeepLink('')).toBeNull()
    expect(parseDeepLink('   ')).toBeNull()
    expect(parseDeepLink(undefined)).toBeNull()
    expect(parseDeepLink(null)).toBeNull()
  })

  it('returns null when there is no screen or an unknown screen', () => {
    expect(parseDeepLink('?lesson=12&word=taberu')).toBeNull()
    expect(parseDeepLink('?screen=settings')).toBeNull()
    expect(parseDeepLink('?screen=card&lesson=12')).toBeNull()
  })

  it('parses a learn link with no other parameters', () => {
    expect(parseDeepLink('?screen=learn')).toEqual({
      screen: 'learn',
      lesson: null,
      word: null,
      index: null,
      from: null,
      to: null,
    })
  })

  it('parses a reader link with lesson and word', () => {
    expect(parseDeepLink('?screen=reader&lesson=12&word=taberu')).toEqual({
      screen: 'reader',
      lesson: 12,
      word: 'taberu',
      index: null,
      from: null,
      to: null,
    })
  })

  it('parses a toc link with lesson and index', () => {
    expect(parseDeepLink('?screen=toc&lesson=12&index=3')).toEqual({
      screen: 'toc',
      lesson: 12,
      word: null,
      index: 3,
      from: null,
      to: null,
    })
  })

  it('keeps both word and index when both are present', () => {
    const intent = parseDeepLink('?screen=reader&lesson=12&word=taberu&index=3')
    expect(intent).toMatchObject({ screen: 'reader', lesson: 12, word: 'taberu', index: 3 })
  })

  it('parses a rule link with from, to and an example word', () => {
    expect(parseDeepLink('?screen=rule&from=masu-form&to=te-form&lesson=12&word=taberu')).toEqual({
      screen: 'rule',
      lesson: 12,
      word: 'taberu',
      index: null,
      from: 'masu-form',
      to: 'te-form',
    })
  })

  it('allows a rule link with no example word', () => {
    expect(parseDeepLink('?screen=rule&from=dictionary-form&to=te-form')).toMatchObject({
      screen: 'rule',
      from: 'dictionary-form',
      to: 'te-form',
      lesson: null,
      word: null,
    })
  })

  it('rejects a reader/toc link missing lesson or word', () => {
    expect(parseDeepLink('?screen=reader&lesson=12')).toBeNull()
    expect(parseDeepLink('?screen=reader&word=taberu')).toBeNull()
    expect(parseDeepLink('?screen=toc&lesson=12')).toBeNull()
    expect(parseDeepLink('?screen=toc&word=taberu')).toBeNull()
  })

  it('rejects a rule link with equal or missing forms', () => {
    expect(parseDeepLink('?screen=rule&from=masu-form&to=masu-form')).toBeNull()
    expect(parseDeepLink('?screen=rule&from=masu-form')).toBeNull()
    expect(parseDeepLink('?screen=rule&to=te-form')).toBeNull()
  })

  it('rejects an out-of-range or non-integer lesson', () => {
    expect(parseDeepLink('?screen=reader&lesson=0&word=taberu')).toBeNull()
    expect(parseDeepLink('?screen=reader&lesson=51&word=taberu')).toBeNull()
    expect(parseDeepLink('?screen=reader&lesson=1.5&word=taberu')).toBeNull()
    expect(parseDeepLink('?screen=reader&lesson=abc&word=taberu')).toBeNull()
  })

  it('rejects a negative or non-integer index', () => {
    expect(parseDeepLink('?screen=reader&lesson=12&index=-1')).toBeNull()
    expect(parseDeepLink('?screen=reader&lesson=12&index=1.5')).toBeNull()
  })

  it('treats a whitespace-only word as absent', () => {
    expect(parseDeepLink('?screen=reader&lesson=12&word=%20%20')).toBeNull()
  })

  it('rejects an unknown from/to form id', () => {
    expect(parseDeepLink('?screen=rule&from=bad&to=te-form')).toBeNull()
    expect(parseDeepLink('?screen=rule&from=masu-form&to=bad')).toBeNull()
  })

  it('ignores unrelated parameters', () => {
    expect(parseDeepLink('?screen=learn&mode=card&foo=1')).toMatchObject({ screen: 'learn' })
  })
})

describe('deepLinkWord', () => {
  it('prefers the kanji written form', () => {
    expect(deepLinkWord({ 'dictionary-form': f('行く', 'いく') })).toBe('行く')
    expect(deepLinkWord({ 'dictionary-form': f('食べる', 'たべる') })).toBe('食べる')
  })

  it('falls back to the hiragana reading without kanji', () => {
    expect(deepLinkWord({ 'dictionary-form': f('する', 'する') })).toBe('する')
  })

  it('converts a katakana reading to hiragana', () => {
    expect(deepLinkWord({ 'dictionary-form': f('コピーする', 'コピーする') })).toBe('こぴーする')
  })

  it('returns an empty string for a verb without a dictionary form', () => {
    expect(deepLinkWord({})).toBe('')
    expect(deepLinkWord(null)).toBe('')
  })
})

describe('deepLinkQuery', () => {
  const library = libraryWith({
    5: [{ 'dictionary-form': f('行く', 'いく') }, { 'dictionary-form': f('食べる', 'たべる') }],
  })

  it('names 變形目錄', () => {
    expect(deepLinkQuery({ screen: 'learn' })).toBe('?screen=learn')
  })

  it('names the reader word by its kanji form', () => {
    const session = {
      screen: 'reader',
      index: 1,
      items: [
        { lesson: 5, verb: { 'dictionary-form': f('行く', 'いく') } },
        { lesson: 5, verb: { 'dictionary-form': f('食べる', 'たべる') } },
      ],
    }
    expect(deepLinkQuery(session)).toBe('?screen=reader&lesson=5&word=食べる')
  })

  it('names the 單詞目錄 word the same way', () => {
    const session = {
      screen: 'toc',
      index: 0,
      items: [{ lesson: 5, verb: { 'dictionary-form': f('行く', 'いく') } }],
    }
    expect(deepLinkQuery(session)).toBe('?screen=toc&lesson=5&word=行く')
  })

  it('returns null for a reader without a current word', () => {
    expect(deepLinkQuery({ screen: 'reader', index: 0, items: [] })).toBeNull()
    expect(
      deepLinkQuery({ screen: 'reader', index: 0, items: [{ lesson: 5, verb: {} }] }),
    ).toBeNull()
  })

  it('names 變形說明 with 從/到 only', () => {
    const session = { screen: 'rule', rule: { from: 'masu-form', to: 'te-form', example: null } }
    expect(deepLinkQuery(session)).toBe('?screen=rule&from=masu-form&to=te-form')
  })

  it('names 變形說明 with the example verb when chosen', () => {
    const session = {
      screen: 'rule',
      rule: { from: 'masu-form', to: 'te-form', example: { lesson: 5, index: 1 } },
    }
    expect(deepLinkQuery(session, library)).toBe(
      '?screen=rule&from=masu-form&to=te-form&lesson=5&word=食べる',
    )
  })

  it('drops an example that does not resolve', () => {
    const session = {
      screen: 'rule',
      rule: { from: 'masu-form', to: 'te-form', example: { lesson: 9, index: 0 } },
    }
    expect(deepLinkQuery(session, library)).toBe('?screen=rule&from=masu-form&to=te-form')
  })

  it('returns null for a screen that is not deep-linkable', () => {
    for (const screen of ['home', 'loading', 'picker', 'card', 'quiz', 'settings', 'example']) {
      expect(deepLinkQuery({ screen })).toBeNull()
    }
  })
})

describe('deepLinkUrl', () => {
  it('prepends the base and replaces any existing query', () => {
    expect(deepLinkUrl('http://x.test/path/?old=1', { screen: 'learn' })).toBe(
      'http://x.test/path/?screen=learn',
    )
  })

  it('returns null when the screen is not deep-linkable', () => {
    expect(deepLinkUrl('http://x.test/', { screen: 'home' })).toBeNull()
  })
})

describe('resolveWord', () => {
  const library = libraryWith({
    2: [
      {
        'dictionary-form': f('行く', 'いく'),
        'masu-form': f('行きます', 'いきます'),
        'te-form': f('行って', 'いって'),
      },
      {
        'dictionary-form': f('食べる', 'たべる'),
        'masu-form': f('食べます', 'たべます'),
      },
    ],
    5: [{ 'dictionary-form': f('来る', 'くる') }],
  })

  it('resolves a romaji word against the reading', () => {
    expect(resolveWord(library, 2, 'taberu', null)).toEqual({ lesson: 2, index: 1 })
    expect(resolveWord(library, 2, 'ikimasu', null)).toEqual({ lesson: 2, index: 0 })
  })

  it('resolves a kanji word against the displayed form', () => {
    expect(resolveWord(library, 2, '食べる', null)).toEqual({ lesson: 2, index: 1 })
    expect(resolveWord(library, 2, '行く', null)).toEqual({ lesson: 2, index: 0 })
  })

  it('matches any of the 15 forms, not only the dictionary form', () => {
    expect(resolveWord(library, 2, '行って', null)).toEqual({ lesson: 2, index: 0 })
    expect(resolveWord(library, 2, 'itte', null)).toEqual({ lesson: 2, index: 0 })
  })

  it('returns the first matching verb in JSON order', () => {
    const lib = libraryWith({
      2: [
        { 'dictionary-form': f('帰る', 'かえる'), 'masu-form': f('帰ります', 'かえります') },
        { 'dictionary-form': f('変える', 'かえる'), 'masu-form': f('変えます', 'かえます') },
      ],
    })
    expect(resolveWord(lib, 2, 'kaeru', null)).toEqual({ lesson: 2, index: 0 })
  })

  it('uses index directly when present, ignoring the word', () => {
    expect(resolveWord(library, 2, 'nomatch', 1)).toEqual({ lesson: 2, index: 1 })
  })

  it('returns null for an out-of-range index', () => {
    expect(resolveWord(library, 2, 'nomatch', 99)).toBeNull()
    expect(resolveWord(library, 2, 'nomatch', -1)).toBeNull()
  })

  it('returns null when no word matches', () => {
    expect(resolveWord(library, 2, 'zzz', null)).toBeNull()
  })

  it('returns null for an empty lesson or bad lesson number', () => {
    expect(resolveWord(library, 1, 'taberu', null)).toBeNull()
    expect(resolveWord(library, 0, 'taberu', null)).toBeNull()
    expect(resolveWord(library, 51, 'taberu', null)).toBeNull()
  })

  it('returns null for a blank word with no index', () => {
    expect(resolveWord(library, 2, '', null)).toBeNull()
    expect(resolveWord(library, 2, '   ', null)).toBeNull()
  })
})
