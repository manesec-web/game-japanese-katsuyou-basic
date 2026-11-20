import { describe, expect, it } from 'vitest'
import {
  SCREEN_TITLES,
  SITE_TITLE,
  isValidContainerId,
  isValidMeasurementId,
  normalizeContainerId,
  normalizeMeasurementId,
  pageTitle,
  pageViewPayload,
  screenPageLocation,
} from './page-view.js'
import { GTM_ID, GA4_ID } from '../config/analytics.js'

describe('repo analytics config', () => {
  it('exports a usable ID or an empty string that disables it', () => {
    expect(GTM_ID).toBeTypeOf('string')
    expect(GA4_ID).toBeTypeOf('string')
    expect(GTM_ID === '' || isValidContainerId(GTM_ID)).toBe(true)
    expect(GA4_ID === '' || isValidMeasurementId(GA4_ID)).toBe(true)
  })
})

describe('container ID', () => {

  it('trims and uppercases a typed ID', () => {
    expect(normalizeContainerId('  gtm-w7387llq ')).toBe('GTM-W7387LLQ')
    expect(normalizeContainerId('Gtm-ABC123')).toBe('GTM-ABC123')
  })

  it('rejects anything that is not a GTM container', () => {
    expect(normalizeContainerId('')).toBeNull()
    expect(normalizeContainerId('GTM-')).toBeNull()
    expect(normalizeContainerId('GTM-W73')).toBeNull()
    expect(normalizeContainerId('GTM-W7387LLQ-EXTRA')).toBeNull()
    expect(normalizeContainerId('G-ABC123')).toBeNull()
    expect(normalizeContainerId('UA-1234')).toBeNull()
    expect(normalizeContainerId(42)).toBeNull()
    expect(normalizeContainerId(null)).toBeNull()
  })
})

describe('measurement ID', () => {
  it('trims and uppercases a typed ID', () => {
    expect(normalizeMeasurementId('  g-nfdk8sxy0m ')).toBe('G-NFDK8SXY0M')
  })

  it('rejects anything that is not a GA4 measurement', () => {
    expect(normalizeMeasurementId('')).toBeNull()
    expect(normalizeMeasurementId('G-')).toBeNull()
    expect(normalizeMeasurementId('GTM-W7387LLQ')).toBeNull()
    expect(normalizeMeasurementId('UA-1234')).toBeNull()
    expect(normalizeMeasurementId(42)).toBeNull()
  })
})

describe('page titles', () => {
  it('names the site alone on home and the screen first elsewhere', () => {
    expect(SITE_TITLE).toBe('大家の動詞轉型練習')
    expect(pageTitle('home')).toBe(SITE_TITLE)
    expect(pageTitle('reader')).toBe('字典 · 大家の動詞轉型練習')
    expect(pageTitle('loading')).toBe('載入中 · 大家の動詞轉型練習')
    expect(pageTitle('rule')).toBe('變形說明 · 大家の動詞轉型練習')
  })

  it('covers every screen id', () => {
    expect(Object.keys(SCREEN_TITLES)).toEqual([
      'loading',
      'home',
      'picker',
      'reader',
      'toc',
      'card',
      'quiz',
      'settings',
      'learn',
      'rule',
      'example',
    ])
  })
})

describe('screen page location', () => {
  it('names the screen in the URL fragment and replaces an old one', () => {
    expect(screenPageLocation('https://example.com/app/?a=1#/reader', 'card')).toBe(
      'https://example.com/app/?a=1#/card',
    )
    expect(screenPageLocation('https://example.com/app/', 'loading')).toBe(
      'https://example.com/app/#/loading',
    )
    expect(screenPageLocation('https://example.com/app/', 'home')).toBe(
      'https://example.com/app/#/home',
    )
  })

  it('survives a missing URL', () => {
    expect(screenPageLocation('', 'reader')).toBe('')
    expect(screenPageLocation(null, 'reader')).toBe('')
  })
})

describe('page view payload', () => {
  it('carries the event, screen, title and URL', () => {
    expect(pageViewPayload('settings', 'https://example.com/x/')).toEqual({
      event: 'page_view',
      screen_name: 'settings',
      page_title: '設定 · 大家の動詞轉型練習',
      page_location: 'https://example.com/x/#/settings',
    })
  })

  it('names home in its own fragment', () => {
    expect(pageViewPayload('home', 'https://example.com/x/').page_location).toBe(
      'https://example.com/x/#/home',
    )
  })
})
