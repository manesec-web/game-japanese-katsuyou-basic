// Extracts the single Opus entry a word or sentence names, from the zipped
// audio bin. The bin stays zipped in IndexedDB; only the one file is
// decompressed at play time.
import { AudioError } from './audio-bin.js'
import { audioFileName } from './audio-name.js'

export async function extractAudioEntry({ bytes, text, openArchive }) {
  const name = audioFileName(text)

  let archive
  try {
    archive = await openArchive(bytes)
  } catch (error) {
    throw new AudioError({ name, message: `cannot read audio archive: ${errorMessage(error)}` })
  }

  if (!archive.has(name)) {
    throw new AudioError({ name, message: `missing audio entry: ${name}` })
  }

  let entryBytes
  try {
    entryBytes = await archive.read(name)
  } catch (error) {
    throw new AudioError({ name, message: `cannot read audio entry ${name}: ${errorMessage(error)}` })
  }
  return { name, bytes: entryBytes }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
