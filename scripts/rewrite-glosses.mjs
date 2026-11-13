#!/usr/bin/env node
// Generates / applies the per-form Chinese gloss rewrite.
//
//   node scripts/rewrite-glosses.mjs --init
//   node scripts/rewrite-glosses.mjs --review --batch 1
//   node scripts/rewrite-glosses.mjs --apply --batch 1
//   node scripts/rewrite-glosses.mjs --apply --all
//
// docs/gloss-rewrite/plan.json makes every one of the 5,790 glosses visible
// before anything is written to vol/. Only form.chinese and form.note may
// change; see scripts/validate-gloss-rewrite.mjs and rewrite-rules.md.
//
// Design: a concise, phrase-level Chinese gloss that ENCODES the grammatical
// form (否定 / 過去 / て形 / 可能 / 意向 / 命令 / 條件 / 受身 / 使役), not a
// copy of an example sentence. The three Chinese examples are used to detect
// the cases where a Japanese form is NOT the textbook pattern (迷惑受身,
// 尊敬語, 讓步構文, 文語祈願, ありえる＝有可能) so those rows get a
// data-driven or hand-written gloss instead.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const volDir = path.join(rootDir, 'vol')
const baselineDir = path.join(rootDir, 'docs', 'gloss-rewrite', 'baseline')
const rulesDir = path.join(rootDir, 'docs', 'gloss-rewrite')
const overridesPath = path.join(rulesDir, 'overrides.json')
const planPath = path.join(rulesDir, 'plan.json')

const LESSON_COUNT = 50
const FORM_IDS = [
  'dictionary-form', 'masu-form', 'masu-form-negative', 'masu-form-past',
  'masu-form-past-negative', 'nai-form', 'ta-form', 'nakatta-form', 'te-form',
  'potential-form', 'volitional-form', 'imperative-form', 'conditional-form',
  'passive-form', 'causative-form',
]
const ERROR_MARKER = '（非自然日語；僅供轉詞練習，無自然中文譯義）'

const argv = process.argv.slice(2)
const has = (flag) => argv.includes(flag)
const argAfter = (flag) => {
  const at = argv.indexOf(flag)
  return at < 0 ? null : argv[at + 1]
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function canonical(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`
}
function lessonRange() {
  if (has('--all') || has('--init') || (has('--review') && !has('--batch'))) return [1, LESSON_COUNT]
  const batch = Number(argAfter('--batch'))
  if (!Number.isInteger(batch) || batch < 1 || batch > 5) {
    console.error('--batch must be 1..5')
    process.exit(2)
  }
  return [(batch - 1) * 10 + 1, batch * 10]
}

function derivePredicate(gloss) {
  let p = String(gloss).split(';')[0].trim()
  p = p.replace(/[（(][^）)]*[）)]/g, '')
  p = p.replace(/[〔［【][^〕］】]*[〕］】]/g, '')
  return p.trim().replace(/[、，,]/g, '')
}

// Concise natural Chinese for the 15-form paradigm. Chinese has no polite /
// plain verb inflection, so those pairs differ only by a register label —
// that is honest, and it still teaches the learner what each form means.
function templates(p, full) {
  const existential = /^(有|在|存在)$/.test(p)
  const stative = /^(不同|不對|不是)$/.test(p)
  const cognitive = /^(懂|明白|了解|知道|曉得)$/.test(p)

  const neg = existential ? '沒有；不存在'
    : stative ? '沒有不同；相同'
    : cognitive ? `不${p}；不明白`
    : p === '有用' ? '沒有用；不起作用'
    : `不${p}`
  const past = existential ? '（當時）有；曾經有'
    : stative ? '當時不同；不一樣'
    : `${p}了`
  // 「沒工作過」means "have never worked" (experiential), which is NOT
  // 「ませんでした／なかった」= "didn't work then". Keep only the temporal
  // negation; the polite/plain pair is distinguished by its register label.
  const pastNeg = existential ? '（當時）沒有；不曾有'
    : stative ? '當時沒有不同；和原先一樣'
    : cognitive ? `（當時）不${p}；沒能${p}`
    : `（當時）沒有${p}`
  const te = existential ? '有…，而…；因為有…，所以…'
    : stative ? `${p}，而…；因為${p}，所以…`
    : cognitive ? `雖然${p}，卻…；${p}之後…`
    : `${p}，然後…；${p}，而…`
  const pot = existential ? '能存在；可以有'
    : stative ? '能有所不同；可以不一樣'
    : `能${p}；可以${p}`
  const vol = existential ? '不管有沒有…；～であろう（文語用法）'
    : stative ? '就算不同也…；不管是否不同都…（讓步用法）'
    : `${p}吧；打算${p}`
  const imp = existential ? '願…；但願有…（文語祈願用法）'
    : stative ? '（狀態動詞沒有命令形）'
    : `快${p}！`
  const cond = existential ? '如果有的話，就…'
    : stative ? `如果${p}的話，就…`
    : `如果${p}，就…`
  const pass = existential ? '（存在動詞沒有自然的受身形）'
    : stative ? '（狀態動詞沒有自然的受身形）'
    : `被…${p}；由…${p}`
  const caus = existential ? '使…存在；讓…有'
    : stative ? '使…不同；讓…有所區別'
    : `讓…${p}；使…${p}`

  return {
    'dictionary-form': full,
    'masu-form': `${full}（禮貌體）`,
    'masu-form-negative': `${neg}（禮貌體）`,
    'masu-form-past': `${past}（禮貌體）`,
    'masu-form-past-negative': `${pastNeg}（禮貌體）`,
    'nai-form': `${neg}（普通體）`,
    'ta-form': `${past}（普通體）`,
    'nakatta-form': `${pastNeg}（普通體）`,
    'te-form': te,
    'potential-form': pot,
    'volitional-form': vol,
    'imperative-form': imp,
    'conditional-form': cond,
    'passive-form': pass,
    'causative-form': caus,
  }
}

function sentenceLines(form) {
  return (Array.isArray(form.sentence) ? form.sentence : [])
    .map((s) => (s && typeof s.chinese === 'string' ? s.chinese : ''))
    .filter(Boolean)
}

// A short, natural Chinese phrase taken from the form's own example. Used
// only where a template would assert an impossible Chinese verb phrase
// (e.g. 「被…下雨」, 「被…站」). The example is already a correct native
// translation, so it can never introduce a new error.
function examplePhrase(lines) {
  if (!lines.length) return null
  const first = lines[0].replace(/[。！？!?]+$/g, '').trim()
  if (first.length <= 18) return first
  const cut = first.split(/[，,；;]/)[0]
  return (cut.length >= 6 ? cut : first.slice(0, 18)).trim()
}

// Predicates that cannot head a natural Chinese 被…X phrase. These rows are
// weather / posture / existence / intransitive-motion / stative events.
const IMPLAUSIBLE_PASSIVE = /^(下雨|下雪|站|坐|居住|停止|到達|成功|失敗|感冒|回來|回家|去|來|聚集|排隊|吵架|死|發生|結束|開始|遲到|留學|搬家|散步|游泳|玩|畢業|結婚|流行|故障|治好|修好|吹|晴|不同|不對|不是|有|在|存在|起床|睡覺)/

// Data-driven overrides for forms whose grammar is not the textbook pattern.
// The form's own examples + note are the native-teacher ground truth.
function derivedGloss(formId, p, form, lines) {
  const text = lines.join(' ')
  const note = typeof form.note === 'string' ? form.note : ''
  const rare = /字典有但是不常用|日常不用|單用少見|幾乎不說|很少說/.test(note)
  const tail = rare ? '（此形日常少用）' : ''

  if (formId === 'passive-form') {
    // The data's 受身形 is four different phenomena. Classify from the
    // note + that row's own three Chinese examples, never from the verb's
    // dictionary gloss alone.
    const honorific = /尊敬語|尊敬用法|常作尊敬語|實際是尊敬語|作受身(幾乎|很少)不說/.test(note)
    const adversativeNote = /迷惑受身|不是「被|不是尊敬語|動作主用「に」|不是「被參加」/.test(note)
    const direct = /被|遭到|受到|由…|是.*寫的|被.*走|被.*掉/.test(text)
    const annoyance = /困擾|傷腦筋|麻煩|沒法|無法|不能|睡不|很難|吃緊|冷清|難受|擔心|氣|累|寂寞|看不到|泡湯|靜不下|得留下|得關燈|受影響|害我|變多|擠|擋|吵/.test(text)
    if (honorific && !adversativeNote && !/被|遭到|受到/.test(text)) {
      return `（尊敬語）${p}；表示對動作主的敬意，不是「被${p}」`
    }
    // 「被…下雨」「被…站」would be ungrammatical Chinese. Use the row's
    // own natural example clause instead of inflecting the predicate.
    if (IMPLAUSIBLE_PASSIVE.test(p)) {
      const phrase = examplePhrase(lines)
      if (phrase) return `${phrase}…（受身／迷惑受身，語意見例句）`
      return `（受身形；此形語意見例句，不是「被${p}」）`
    }
    if (direct) return `被…${p}；由…${p}；受到…影響或對待`
    if (adversativeNote || annoyance) {
      return `因（別人）${p}而受到影響或困擾（迷惑受身）；不是「被${p}」`
    }
    const phrase = examplePhrase(lines)
    return phrase ? `${phrase}…（此形語意見例句）` : `${p}（此形語意見例句）`
  }
  if (formId === 'volitional-form' && /就算|不管|無論|即便|不會想|～おうと|ようと|ようが/.test(text)) {
    return `就算${p}也…；不管是否${p}都…（讓步用法）${tail}`
  }
  // Many 無意志動詞 (晴れる, 壊れる, 死ぬ, 降る …) have a 意向形 that
  // describes something ABOUT TO HAPPEN, not an intention. 「壞吧／打算壞」
  // would be nonsense. Detect it from that row's own example sentences.
  if (formId === 'volitional-form') {
    const imminent = /快要|正要|就要|即將|眼看|差不多要|正想|將要|馬上就要|正快要|就要/.test(text)
    const invitation = /吧[。！]?$|吧，|一起/.test(text)
    if (imminent && !invitation) {
      return `正快要${p}；即將${p}（無意志動詞，不是「～吧」）${tail}`
    }
  }
  if (formId === 'imperative-form' && /願|祈禱|祈願|但願|光あれ|幸あれ/.test(text)) {
    return `願…${p}；但願${p}（文語祈願用法）${tail}`
  }
  if (formId === 'potential-form' && /有可能|可能發生|常有的|說不定/.test(text)) {
    return `有可能（發生）；說不定會…${tail}`
  }
  if (formId === 'causative-form' && /^(不同|不對|不是)$/.test(p)) {
    return `使…${p}；讓…有所區別${tail}`
  }
  return null
}

// Review heuristics: flag a TEMPLATE gloss that contradicts its examples.
// Hand-written rows were grounded in those examples already, so skip them.
function conflicts(formId, gloss, lines) {
  const text = lines.join(' ')
  const out = []
  if (!text) return out
  // A data-derived passive gloss is classified from these examples already;
  // only a template-produced 被… gloss can be contradicted by them.
  if (formId === 'passive-form' && /^被…/.test(gloss)
      && !/被|遭|由|受到/.test(text)) {
    out.push('gloss leads with 被… but no example is a direct passive')
  }
  if (formId === 'volitional-form' && /吧|打算/.test(gloss)
      && /就算|不管|無論|不會想|即便/.test(text)) {
    out.push('gloss says ～吧 but the examples are concessive (就算…也)')
  }
  if (formId === 'potential-form' && /^(能|可以)/.test(gloss)
      && /有可能|可能發生|常有的/.test(text)) {
    out.push('gloss says 能… but the examples say 有可能（發生）')
  }
  if (formId === 'imperative-form' && /快/.test(gloss)
      && /願|祈禱|祈願|但願/.test(text)) {
    out.push('gloss says 快…！but the examples are 願… (literary optative)')
  }
  if (/^(masu-form-negative|nai-form|masu-form-past-negative|nakatta-form)$/.test(formId)
      && !/不|沒|無|別|未|不曾|並非|沒有/.test(gloss)) {
    out.push('negative form gloss has no negation')
  }
  return out
}

function buildPlan() {
  const overrides = readJson(overridesPath)
  const plan = {
    version: 3,
    generator: 'scripts/rewrite-glosses.mjs',
    entries: {},
    noteFix: overrides.noteFix || {},
    doubt: overrides.doubt || [],
  }
  let count = 0
  for (let lesson = 1; lesson <= LESSON_COUNT; lesson += 1) {
    const base = readJson(path.join(baselineDir, `lesson_${lesson}.json`))
    base[`lesson_${lesson}`].vols.forEach((verb, vi) => {
      const key = `L${lesson}#${vi}`
      const p = overrides.predicate?.[key] || derivePredicate(verb['dictionary-form'].chinese)
      const full = verb['dictionary-form'].chinese
      const forms = {}
      for (const formId of FORM_IDS) {
        const form = verb[formId]
        const isDoubt = plan.doubt.some((d) => d.key === key && d.form === formId)
        const lines = sentenceLines(form)
        const hand = overrides.forms?.[key]?.[formId]
        let gloss
        if (form.error_usage === true) gloss = ERROR_MARKER
        else if (isDoubt) gloss = form.chinese           // held for user ruling
        else if (hand) gloss = hand
        else gloss = derivedGloss(formId, p, form, lines) || templates(p, full)[formId]
        // A form-specific 「字典有但是不常用／日常不用」note must not sit under
        // a gloss that reads like an everyday expression. Applies to generated
        // AND hand-written rows. Lexeme-level notes (the same note on all 15
        // forms, e.g. 造る vs 作る) do NOT get the suffix.
        if (form.error_usage !== true) {
          const note = typeof form.note === 'string' ? form.note : ''
          const rare = /字典有但是不常用|日常不用|單用少見|幾乎不說|很少說|很少用|日常少用/.test(note)
          const already = /少用|文語|讓步|此形|推量|祈願|不是|特殊|自發|大概|語意見例句|（尊敬語）/.test(gloss)
          const all15 = FORM_IDS.every((id) => verb[id].note === form.note)
          if (rare && !already && !all15) gloss = `${gloss}（此形日常少用）`
        }
        forms[formId] = {
          gloss, vol: form.vol, sentences: lines,
          error: form.error_usage === true,
          doubt: isDoubt && form.error_usage !== true,
          handWritten: Boolean(hand),
        }
        count += 1
      }
      plan.entries[key] = { lesson, index: vi, predicate: p, full, forms }
    })
  }
  plan.count = count
  return plan
}

function cmdInit() {
  const plan = buildPlan()
  fs.writeFileSync(planPath, canonical(plan))
  let hand = 0, derived = 0
  for (const e of Object.values(plan.entries)) {
    for (const f of Object.values(e.forms)) if (f.handWritten) hand += 1
  }
  console.log(`wrote ${path.relative(rootDir, planPath)} (${plan.count} glosses, ${hand} hand-written)`)
}

function cmdReview(from, to) {
  const plan = readJson(planPath)
  let flagged = 0, shown = 0, hand = 0
  for (const [key, entry] of Object.entries(plan.entries)) {
    if (entry.lesson < from || entry.lesson > to) continue
    for (const formId of FORM_IDS) {
      const f = entry.forms[formId]
      if (f.error) continue
      shown += 1
      if (f.handWritten) hand += 1
      const issues = f.handWritten ? [] : conflicts(formId, f.gloss, f.sentences)
      if (f.doubt) issues.push('DOUBT: held at original gloss, awaiting user ruling')
      if (!issues.length) continue
      flagged += 1
      console.log(`${key.padEnd(8)} ${formId.padEnd(24)} ${f.vol.padEnd(12)} [tmpl]`)
      console.log(`   gloss : ${f.gloss}`)
      console.log(`   例句 : ${f.sentences.join(' ／ ') || '(none)'}`)
      for (const issue of issues) console.log(`   ! ${issue}`)
    }
  }
  console.log(`\nreviewed ${shown} usable forms (lessons ${from}-${to}): ${hand} hand-written, ${flagged} flagged`)
  return flagged
}

function cmdApply(from, to) {
  const plan = readJson(planPath)
  const overrides = readJson(overridesPath)
  let files = 0, changedGlosses = 0, changedNotes = 0
  for (let lesson = from; lesson <= to; lesson += 1) {
    const livePath = path.join(volDir, `lesson_${lesson}.json`)
    const live = readJson(livePath)
    live[`lesson_${lesson}`].vols.forEach((verb, vi) => {
      const key = `L${lesson}#${vi}`
      const planned = plan.entries[key]
      if (!planned) throw new Error(`no plan for ${key}`)
      for (const formId of FORM_IDS) {
        const form = verb[formId]
        const want = planned.forms[formId].gloss
        if (typeof want !== 'string' || want.trim() === '') throw new Error(`empty gloss ${key} ${formId}`)
        if (form.chinese !== want) { form.chinese = want; changedGlosses += 1 }
      }
      const fix = overrides.noteFix?.[key]
      if (fix) {
        const form = verb[fix.form]
        // Idempotent: the fix may already have been applied by an earlier run.
        if (form.note === fix.from) { form.note = fix.to; changedNotes += 1 }
        else if (form.note !== fix.to) {
          throw new Error(`${key}: noteFix source mismatch: ${JSON.stringify(form.note)}`)
        }
      }
    })
    fs.writeFileSync(livePath, canonical(live))
    files += 1
  }
  console.log(`applied lessons ${from}-${to}: ${files} files, ${changedGlosses} chinese values set, ${changedNotes} note fixes`)
}

function main() {
  if (has('--init')) return cmdInit()
  if (!fs.existsSync(planPath)) {
    console.error('plan.json missing; run --init first')
    process.exit(1)
  }
  const [from, to] = lessonRange()
  if (has('--review')) {
    const flagged = cmdReview(from, to)
    if (flagged > 0) process.exitCode = 1
    return
  }
  if (has('--apply')) return cmdApply(from, to)
  console.error('usage: --init | --review [--batch N|--all] | --apply [--batch N|--all]')
  process.exit(2)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
}
