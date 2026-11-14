import { describe, expect, it } from 'vitest'
import { audioFileName, audioBinFile } from './audio-name.js'

describe('audioFileName', () => {
  it('uses the middle 16 hex characters of the MD5', () => {
    // md5('ありがとうございます') = 94f49c978df33dc365b1b6aad2da8b7b
    // keep 8..24 -> 8df33dc365b1b6aa
    expect(audioFileName('ありがとうございます')).toBe('8df33dc365b1b6aa.opus')
  })

  it('names words and sentences by their exact Japanese text', () => {
    expect(audioFileName('遊ぶ')).toBe('bf8379ee185f6628.opus')
    expect(audioFileName('遊びます')).not.toBe(audioFileName('遊ぶ'))
    // The kana reading and the kanji surface are different files.
    expect(audioFileName('あそぶ')).not.toBe(audioFileName('遊ぶ'))
  })

  it('is deterministic and always 16 hex + .opus', () => {
    const name = audioFileName('庭に 犬が いる。')
    expect(name).toMatch(/^[0-9a-f]{16}\.opus$/)
    expect(audioFileName('庭に 犬が いる。')).toBe(name)
  })
})

describe('audioBinFile', () => {
  it('names the per-lesson bin without a zero prefix', () => {
    expect(audioBinFile(2)).toBe('lesson2.bin')
    expect(audioBinFile(10)).toBe('lesson10.bin')
    expect(audioBinFile(50)).toBe('lesson50.bin')
  })
})
