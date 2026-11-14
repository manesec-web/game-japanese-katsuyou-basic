import { specs as navSpecs } from './nav.js'
import { specs as bootSpecs } from './boot.js'
import { specs as lessonSpecs } from './lessons.js'
import { specs as settingsSpecs } from './settings.js'
import { specs as studySpecs } from './study.js'
import { specs as dictSpecs } from './dict.js'
import { specs as cardSpecs } from './card.js'
import { specs as quizSpecs } from './quiz.js'
import { specs as audioSpecs } from './audio.js'

export function allSpecs(deps = {}) {
  return [
    ...bootSpecs(deps),
    ...navSpecs(),
    ...lessonSpecs(deps),
    ...settingsSpecs(deps),
    ...studySpecs(deps),
    ...dictSpecs(deps),
    ...cardSpecs(deps),
    ...quizSpecs(deps),
    ...audioSpecs(deps),
  ]
}
