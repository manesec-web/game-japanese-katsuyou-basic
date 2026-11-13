import { describe, expect, it } from 'vitest'
import { bootPercent } from './boot-progress.js'

const idle = { base: 0, loaded: 0, total: 0, done: false }

describe('bootPercent', () => {
  it('is 0 before anything is checked', () => {
    expect(bootPercent({ checked: 0, total: 50, download: idle })).toBe(0)
    expect(bootPercent(null)).toBe(0)
    expect(bootPercent({ checked: 0, total: 0, download: idle })).toBe(0)
  })

  it('follows verified lessons when no download happens', () => {
    expect(bootPercent({ checked: 25, total: 50, download: idle })).toBe(50)
    expect(bootPercent({ checked: 50, total: 50, download: idle })).toBe(100)
  })

  it('never rounds past the lessons that are really verified', () => {
    expect(bootPercent({ checked: 1, total: 50, download: idle })).toBe(2)
    expect(bootPercent({ checked: 49, total: 50, download: idle })).toBe(98)
  })

  it('rises with the bytes received during a download', () => {
    const half = { base: 0, loaded: 300, total: 600, done: false }
    expect(bootPercent({ checked: 0, total: 50, download: half })).toBe(50)
    const quarter = { base: 0, loaded: 150, total: 600, done: false }
    expect(bootPercent({ checked: 0, total: 50, download: quarter })).toBe(25)
  })

  it('starts the download share at the lessons the cache check already verified', () => {
    // A repair with 20 of 50 lessons already good: the bar is at 40% and the
    // download fills 40 -> 100 instead of restarting at 0.
    expect(bootPercent({ checked: 20, total: 50, download: { base: 40, loaded: 0, total: 600, done: false } })).toBe(40)
    expect(bootPercent({ checked: 20, total: 50, download: { base: 40, loaded: 300, total: 600, done: false } })).toBe(70)
    expect(bootPercent({ checked: 20, total: 50, download: { base: 40, loaded: 600, total: 600, done: false } })).toBe(100)
  })

  it('holds at the cache-check share when the length is unknown', () => {
    expect(bootPercent({ checked: 20, total: 50, download: { base: 40, loaded: 300, total: 0, done: false } })).toBe(40)
  })

  it('holds at 100 once the bytes arrived, while entries are verified', () => {
    expect(bootPercent({ checked: 3, total: 50, download: { base: 0, loaded: 600, total: 600, done: true } })).toBe(100)
  })

  it('treats a retry reset as the same phase, not a new meaning', () => {
    const before = { checked: 10, total: 50, download: { base: 20, loaded: 400, total: 600, done: false } }
    const afterRetry = { checked: 10, total: 50, download: { base: 20, loaded: 0, total: 0, done: false } }
    expect(bootPercent(before)).toBe(73)
    expect(bootPercent(afterRetry)).toBe(20)
  })

  it('clamps odd values instead of overflowing the bar', () => {
    expect(
      bootPercent({ checked: 60, total: 50, download: { base: 120, loaded: 900, total: 600, done: false } }),
    ).toBe(100)
    expect(
      bootPercent({ checked: 0, total: 50, download: { base: -5, loaded: -10, total: 600, done: false } }),
    ).toBe(0)
  })
})
