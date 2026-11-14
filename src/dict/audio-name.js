// Audio file naming for the res-miles release. Each .opus entry inside a
// lesson bin is named from the MD5 of the Japanese text it reads, using only
// the middle 16 hex characters (the first 8 and last 8 are dropped):
//
//   ありがとうございます -> md5 94f49c978df33dc365b1b6aad2da8b7b
//                          -> 8df33dc365b1b6aa.opus
import { md5Hex } from './md5.js'

export const OPUS_SUFFIX = '.opus'
const HEX_START = 8
const HEX_END = 24

export function audioFileName(text) {
  return `${md5Hex(text).slice(HEX_START, HEX_END)}${OPUS_SUFFIX}`
}

// The bin file name for a lesson number, e.g. lesson 10 -> "lesson10.bin".
export function audioBinFile(lesson) {
  return `lesson${lesson}.bin`
}
