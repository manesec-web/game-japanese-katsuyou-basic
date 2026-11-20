import { describe, expect, it } from 'vitest'
import { createGtm, GTAG_SCRIPT_URL, GTM_SCRIPT_URL } from './gtm.js'

function fakeDom(href = 'https://example.com/game-japanese-katsuyou-basic/') {
  const scripts = []
  const gtagCalls = []
  const doc = {
    head: {
      appendChild(node) {
        scripts.push(node)
      },
    },
    createElement(tag) {
      return {
        tag,
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value
        },
      }
    },
  }
  const win = {
    location: { href },
    gtag(...args) {
      gtagCalls.push(args)
    },
  }
  return { win, doc, scripts, gtagCalls }
}

describe('GTM container', () => {
  it('creates the dataLayer, pushes gtm.start and appends the async script', () => {
    const { win, doc, scripts } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    expect(gtm.load('GTM-W7387LLQ')).toBe(true)

    expect(win.dataLayer).toHaveLength(1)
    expect(win.dataLayer[0]).toMatchObject({ event: 'gtm.js' })
    expect(typeof win.dataLayer[0]['gtm.start']).toBe('number')

    expect(scripts).toHaveLength(1)
    expect(scripts[0].async).toBe(true)
    expect(scripts[0].src).toBe(`${GTM_SCRIPT_URL}GTM-W7387LLQ`)
    expect(scripts[0].attributes['data-gtm-id']).toBe('GTM-W7387LLQ')
  })

  it('never loads the same container twice', () => {
    const { win, doc, scripts } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    gtm.load('GTM-W7387LLQ')
    expect(gtm.load('GTM-W7387LLQ')).toBe(false)
    expect(scripts).toHaveLength(1)
  })

  it('keeps entries already queued on window.dataLayer', () => {
    const { win, doc } = fakeDom()
    win.dataLayer = [{ event: 'early' }]
    const gtm = createGtm({ window: win, document: doc })
    gtm.load('GTM-W7387LLQ')
    expect(win.dataLayer.map((entry) => entry.event)).toEqual(['early', 'gtm.js'])
  })

  it('loads nothing for an invalid ID', () => {
    const { win, doc, scripts } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    expect(gtm.load('nope')).toBe(false)
    expect(scripts).toHaveLength(0)
    expect(win.dataLayer).toBeUndefined()
  })
})

describe('gtag.js measurement', () => {
  it('queues js and config with send_page_view off, then loads the script once', () => {
    const { win, doc, scripts, gtagCalls } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    expect(gtm.loadTag('G-NFDK8SXY0M')).toBe(true)
    expect(gtagCalls[0][0]).toBe('js')
    expect(gtagCalls[1]).toEqual([
      'config',
      'G-NFDK8SXY0M',
      { send_page_view: false },
    ])
    expect(scripts).toHaveLength(1)
    expect(scripts[0].async).toBe(true)
    expect(scripts[0].src).toBe(`${GTAG_SCRIPT_URL}G-NFDK8SXY0M`)
    expect(scripts[0].attributes['data-gtag-id']).toBe('G-NFDK8SXY0M')
    expect(gtm.loadTag('G-NFDK8SXY0M')).toBe(false)
    expect(scripts).toHaveLength(1)
  })

  it('loads nothing for an invalid measurement ID', () => {
    const { win, doc, scripts, gtagCalls } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    expect(gtm.loadTag('GTM-W7387LLQ')).toBe(false)
    expect(scripts).toHaveLength(0)
    expect(gtagCalls).toHaveLength(0)
  })
})

describe('per-screen tracking', () => {
  it('pushes the dataLayer entry and the GA4 event for a screen change', () => {
    const { win, doc, gtagCalls } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    gtm.loadTag('G-NFDK8SXY0M')
    // The first home is the landing screen the container already reported.
    gtm.screen('home')
    gtm.screen('picker')
    expect(win.dataLayer.map((entry) => entry.screen_name)).toEqual(['home', 'picker'])
    expect(gtagCalls.at(-1)).toEqual([
      'event',
      'page_view',
      {
        screen_name: 'picker',
        page_title: '詞彙 · 大家の動詞轉型練習',
        page_location: 'https://example.com/game-japanese-katsuyou-basic/#/picker',
      },
    ])
  })

  it('leaves the loading screen and the first home to the container', () => {
    const { win, doc, gtagCalls } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    gtm.loadTag('G-NFDK8SXY0M')
    const before = gtagCalls.length
    gtm.screen('loading')
    gtm.screen('home')
    expect(gtagCalls).toHaveLength(before)
    expect(win.dataLayer.map((entry) => entry.screen_name)).toEqual(['loading', 'home'])
  })

  it('reports a later return to home', () => {
    const { win, doc, gtagCalls } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    gtm.loadTag('G-NFDK8SXY0M')
    gtm.screen('home')
    gtm.screen('picker')
    gtm.screen('home')
    const last = gtagCalls.at(-1)
    expect(last[0]).toBe('event')
    expect(last[2]).toMatchObject({ screen_name: 'home', page_location: 'https://example.com/game-japanese-katsuyou-basic/#/home' })
  })

  it('still pushes the dataLayer entry when no measurement ID loaded', () => {
    const { win, doc, gtagCalls } = fakeDom()
    const gtm = createGtm({ window: win, document: doc })
    expect(gtm.screen('picker')).toBe(false)
    expect(gtagCalls).toHaveLength(0)
    expect(win.dataLayer.at(-1).screen_name).toBe('picker')
  })

  it('survives a missing window', () => {
    const gtm = createGtm({ window: null, document: null })
    expect(gtm.load('GTM-W7387LLQ')).toBe(false)
    expect(gtm.loadTag('G-NFDK8SXY0M')).toBe(false)
    expect(gtm.screen('home')).toBe(false)
  })
})
