// Copy-link command. Generates the deep-link URL for the current screen (see
// src/study/url.js) and writes it to the clipboard. The clipboard and the page
// URL are injectable so the command stays testable without a browser.
import { CommandError } from '../engine/errors.js'
import { deepLinkUrl } from '../study/url.js'

function defaultHref() {
  return typeof window !== 'undefined' ? window.location.href : ''
}

async function defaultWriteClipboard(text) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('clipboard is not available')
  }
  await navigator.clipboard.writeText(text)
}

export function specs(deps = {}) {
  const library = deps.library
  const href = deps.href ?? defaultHref
  const writeClipboard = deps.writeClipboard ?? defaultWriteClipboard

  return [
    {
      id: 'link.copy',
      params: [],
      enabled: (session) => deepLinkUrl(href(), session, library) !== null,
      run: async (session) => {
        const url = deepLinkUrl(href(), session, library)
        if (!url) {
          throw new CommandError('no-link', '此畫面沒有可複製的鏈接')
        }
        try {
          await writeClipboard(url)
        } catch {
          throw new CommandError('copy-failed', '複製失敗，請手動複製網址')
        }
        return { url }
      },
    },
  ]
}
