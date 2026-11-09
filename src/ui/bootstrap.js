// Boots the dictionary, loads the library into the session, restores settings,
// then moves to home. Retry reuses this function.
export async function bootstrap(store) {
  const { library, settingsStorage } = store.deps ?? {}
  const result = await store.send('app.boot')
  if (!result.ok) return result

  if (settingsStorage) {
    store.session.settings = settingsStorage.load()
  }

  if (library) {
    try {
      store.session.lessons = await library.load()
    } catch (error) {
      store.session.boot.error = {
        lesson: error?.details?.lesson ?? null,
        message: error.message,
      }
      return {
        ok: false,
        error: { code: error.code ?? 'boot-failed', message: error.message },
      }
    }
  }

  store.send('nav.go', { screen: 'home' })
  return result
}
