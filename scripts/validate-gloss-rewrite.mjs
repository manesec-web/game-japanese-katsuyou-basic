#!/usr/bin/env node
// Read-only validator for the per-form Chinese gloss rewrite.
//
// Compares each vol/lesson_N.json with the frozen pre-rewrite copy in
// docs/gloss-rewrite/baseline/ and enforces:
//   - canonical JSON, exact key sets and key order, lesson/vols structure
//   - every value except form.chinese and form.note is identical to baseline
//   - glosses are non-empty strings and no longer all copied from 字典形
//   - error_usage forms carry the agreed non-natural-Japanese marker
//   - every usable form still contains its own vol in one of its sentences
//
// Usage:
//   node scripts/validate-gloss-rewrite.mjs --check-invariants
//   node scripts/validate-gloss-rewrite.mjs --batch 1
//   node scripts/validate-gloss-rewrite.mjs --all
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const volDir = path.join(rootDir, 'vol')
const baselineDir = path.join(rootDir, 'docs', 'gloss-rewrite', 'baseline')
const baselineIndexPath = path.join(rootDir, 'docs', 'gloss-rewrite', 'baseline-index.json')
const overridesPath = path.join(rootDir, 'docs', 'gloss-rewrite', 'overrides.json')

const LESSON_COUNT = 50
const FORM_IDS = [
  'dictionary-form', 'masu-form', 'masu-form-negative', 'masu-form-past',
  'masu-form-past-negative', 'nai-form', 'ta-form', 'nakatta-form', 'te-form',
  'potential-form', 'volitional-form', 'imperative-form', 'conditional-form',
  'passive-form', 'causative-form',
]
const FORM_KEYS = 'vol,group,chinese,japanese,note,error_usage,sentence'
const MUTABLE_KEYS = new Set(['chinese', 'note'])
const ERROR_MARKER = '（非自然日語；僅供轉詞練習，無自然中文譯義）'
const ERROR_NOTE_PREFIX = '錯誤詞語，僅供轉詞練習：'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function canonical(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`
}

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex')
}

function lessonRange(argv) {
  const all = argv.includes('--all') || argv.includes('--check-invariants')
  if (all) return [1, LESSON_COUNT]
  const at = argv.indexOf('--batch')
  if (at < 0) {
    console.error('usage: --check-invariants | --batch N | --all')
    process.exit(2)
  }
  const batch = Number(argv[at + 1])
  if (!Number.isInteger(batch) || batch < 1 || batch > 5) {
    console.error(`--batch must be an integer 1..5, got ${argv[at + 1]}`)
    process.exit(2)
  }
  return [(batch - 1) * 10 + 1, batch * 10]
}

function sameImmutable(a, b, where, errors) {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) {
    errors.push(`${where}: type changed ${typeof a} -> ${typeof b}`)
    return false
  }
  if (a === null || b === null || typeof a !== 'object') {
    errors.push(`${where}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`)
    return false
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    errors.push(`${where}: array/object shape changed`)
    return false
  }
  const ak = Object.keys(a), bk = Object.keys(b)
  if (ak.join(',') !== bk.join(',')) {
    errors.push(`${where}: keys/order changed (${ak.join(',')}) -> (${bk.join(',')})`)
    return false
  }
  let same = true
  for (const k of ak) {
    // Inside a form, chinese and note are the only writable fields.
    if (!sameImmutable(a[k], b[k], `${where}.${k}`, errors)) same = false
  }
  return same
}

function validateLesson(before, after, lesson, errors, stats, mode) {
  const tag = `L${lesson}`
  const beforeTopKeys = Object.keys(before)
  const afterTopKeys = Object.keys(after)
  if (beforeTopKeys.length !== 1 || beforeTopKeys[0] !== `lesson_${lesson}`) {
    errors.push(`${tag}: baseline top key is not lesson_${lesson}`)
    return
  }
  if (afterTopKeys.join(',') !== beforeTopKeys.join(',')) {
    errors.push(`${tag}: top-level key/order changed`)
    return
  }
  const bInner = before[`lesson_${lesson}`]
  const aInner = after[`lesson_${lesson}`]
  if (Object.keys(bInner).join(',') !== Object.keys(aInner).join(',')) {
    errors.push(`${tag}: lesson keys/order changed`)
  }
  if (!Array.isArray(bInner.vols) || !Array.isArray(aInner.vols)) {
    errors.push(`${tag}: vols is not an array`)
    return
  }
  if (bInner.vols.length !== aInner.vols.length) {
    errors.push(`${tag}: vols length ${bInner.vols.length} -> ${aInner.vols.length}`)
    return
  }

  for (let vi = 0; vi < bInner.vols.length; vi += 1) {
    const bv = bInner.vols[vi], av = aInner.vols[vi]
    const where = `${tag}#${vi}`
    if (Object.keys(bv).join(',') !== FORM_IDS.join(',')) {
      errors.push(`${where}: baseline form keys/order is not canonical`)
      continue
    }
    if (Object.keys(av).join(',') !== FORM_IDS.join(',')) {
      errors.push(`${where}: form keys/order changed`)
      continue
    }
    stats.verbs += 1
    const baseGloss = bv['dictionary-form'].chinese
    for (const formId of FORM_IDS) {
      const bf = bv[formId], af = av[formId]
      const fw = `${where} ${formId}`
      stats.forms += 1
      if (Object.keys(bf).join(',') !== FORM_KEYS || Object.keys(af).join(',') !== FORM_KEYS) {
        errors.push(`${fw}: form field keys/order changed (${Object.keys(af).join(',')})`)
        continue
      }
      // Immutable fields: compare a projection that omits chinese/note.
      const bProj = {}, aProj = {}
      for (const k of Object.keys(bf)) if (!MUTABLE_KEYS.has(k)) bProj[k] = bf[k]
      for (const k of Object.keys(af)) if (!MUTABLE_KEYS.has(k)) aProj[k] = af[k]
      sameImmutable(bProj, aProj, `${fw} [immutable]`, errors)

      if (typeof af.chinese !== 'string' || af.chinese.trim() === '') {
        errors.push(`${fw}: chinese is empty or not a string`)
      }
      if (af.note !== null && typeof af.note !== 'string') {
        errors.push(`${fw}: note is neither string nor null`)
      }
      if (bf.error_usage === true) {
        stats.errorForms += 1
        if (mode === 'rewritten' && af.chinese !== ERROR_MARKER) {
          errors.push(`${fw}: error_usage chinese must be the agreed marker`)
        }
        if (mode === 'rewritten' && typeof af.note === 'string' && !af.note.startsWith(ERROR_NOTE_PREFIX)) {
          errors.push(`${fw}: error_usage note no longer starts with ${ERROR_NOTE_PREFIX}`)
        }
      } else {
        stats.usableForms += 1
        // 字典形 itself keeps the base gloss; every other usable form must
        // have acquired its own, form-specific Chinese meaning.
        if (mode === 'rewritten' && formId !== 'dictionary-form' && af.chinese === baseGloss) {
          stats.unchangedGlosses += 1
          errors.push(`${fw}: still shows the copied 字典形 gloss ${JSON.stringify(baseGloss)}`)
        }
        const sentences = af.sentence
        if (!Array.isArray(sentences)) {
          errors.push(`${fw}: sentence is not an array`)
        } else {
          stats.sentences += sentences.length
          if (!sentences.some((s) => typeof s.japanese === 'string' && s.japanese.includes(af.vol))) {
            errors.push(`${fw}: no sentence contains its own vol ${af.vol} (highlight would break)`)
          }
        }
      }
    }
  }
}

function main() {
  const argv = process.argv.slice(2)
  const mode = argv.includes('--check-invariants') ? 'baseline' : 'rewritten'
  const [from, to] = lessonRange(argv)
  const errors = []
  const stats = {
    lessons: 0, verbs: 0, forms: 0, usableForms: 0, errorForms: 0,
    sentences: 0, unchangedGlosses: 0, chineseChanged: 0, noteChanged: 0,
    errorMarker: 0, baselineHashMismatch: 0,
  }

  if (!fs.existsSync(baselineIndexPath)) {
    console.error(`missing baseline index: ${path.relative(rootDir, baselineIndexPath)}`)
    process.exit(1)
  }
  const index = readJson(baselineIndexPath)
  const overrides = fs.existsSync(overridesPath) ? readJson(overridesPath) : { noteFix: {}, doubt: [] }

  for (let lesson = from; lesson <= to; lesson += 1) {
    const livePath = path.join(volDir, `lesson_${lesson}.json`)
    const basePath = path.join(baselineDir, `lesson_${lesson}.json`)
    if (!fs.existsSync(livePath) || !fs.existsSync(basePath)) {
      errors.push(`L${lesson}: live or baseline file missing`)
      continue
    }
    const liveRaw = fs.readFileSync(livePath, 'utf8')
    const baseRaw = fs.readFileSync(basePath, 'utf8')
    if (liveRaw.charCodeAt(0) === 0xfeff || liveRaw.includes('\r\n') || !liveRaw.endsWith('\n')) {
      errors.push(`L${lesson}: BOM / CRLF / missing trailing newline`)
    }
    const entry = index.lessons.find((e) => e.lesson === lesson)
    if (!entry || sha256Hex(baseRaw) !== entry.sha256) {
      stats.baselineHashMismatch += 1
      errors.push(`L${lesson}: baseline sha256 does not match baseline-index.json`)
    }
    let live, base
    try {
      live = JSON.parse(liveRaw)
      base = JSON.parse(baseRaw)
    } catch (error) {
      errors.push(`L${lesson}: JSON parse failed: ${error.message}`)
      continue
    }
    if (canonical(live) !== liveRaw) errors.push(`L${lesson}: live file is not canonical JSON`)
    if (canonical(base) !== baseRaw) errors.push(`L${lesson}: baseline file is not canonical JSON`)
    stats.lessons += 1
    validateLesson(base, live, lesson, errors, stats, mode)

    // Count what actually changed and check allowed note edits.
    const bv = base[`lesson_${lesson}`].vols
    const av = live[`lesson_${lesson}`].vols
    for (let vi = 0; vi < Math.min(bv.length, av.length); vi += 1) {
      for (const formId of FORM_IDS) {
        const bf = bv[vi][formId], af = av[vi][formId]
        const key = `L${lesson}#${vi}`
        if (bf.chinese !== af.chinese) {
          stats.chineseChanged += 1
          if (af.error_usage && af.chinese === ERROR_MARKER) stats.errorMarker += 1
        }
        if (bf.note !== af.note) {
          stats.noteChanged += 1
          const allowed = overrides.noteFix?.[key]
          if (!allowed || allowed.form !== formId || allowed.from !== bf.note || allowed.to !== af.note) {
            errors.push(`${key} ${formId}: note changed but is not declared in overrides.noteFix`)
          }
        }
      }
    }
  }

  const label = mode === 'baseline' ? 'baseline invariants' : `lessons ${from}-${to}`
  console.log(`validate-gloss-rewrite (${label})`)
  console.log(JSON.stringify(stats, null, 2))
  if (mode === 'rewritten') {
    console.log(`unchanged non-字典形 glosses: ${stats.unchangedGlosses}`)
    console.log(`allowed note fixes declared: ${Object.keys(overrides.noteFix || {}).length}`)
    console.log(`doubt entries declared: ${(overrides.doubt || []).length}`)
  }
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`)
    for (const e of errors.slice(0, 80)) console.error(`  - ${e}`)
    if (errors.length > 80) console.error(`  ... ${errors.length - 80} more`)
    process.exitCode = 1
  } else {
    console.log('\nOK')
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
}
