import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RULE_CONTENT } from '../data/rule-content.js'
import { FORM_IDS } from '../dict/forms.js'
import {
  GODAN_ENDINGS, IRREGULAR_SUFFIX, ICHIDAN_SUFFIX,
  godanParts, godanEnding, isOnbin, mappingLines, mappingLabel,
  specialNotes, ichidanNotes, irregularNotes, exceptionNotes,
  orderedPairs,
} from './rule-conjugation.js'
import {
  buildRuleContent, collectExamples, checkExampleForms,
  EXAMPLE_GODAN, EXAMPLE_ICHIDAN, EXAMPLE_IRREGULAR, EXAMPLE_EXCEPTION,
  verbShape, formEnding,
} from './rule-content-builder.js'
import { findRule, missingPairs, RULE_TIPS } from './rule.js'
import { deriveChange } from './rule-demo.js'

// The real dictionary is the source of truth for every table cell. A generated
// row that is not a real vol/ form can never ship.
function loadVerbs() {
  const verbs = []
  for (let lesson = 1; lesson <= 50; lesson += 1) {
    const file = new URL(`../../vol/lesson_${lesson}.json`, import.meta.url)
    const data = JSON.parse(readFileSync(file, 'utf8'))
    for (const verb of data[`lesson_${lesson}`]?.vols ?? []) verbs.push(verb)
  }
  return verbs
}

const VERBS = loadVerbs()
const EXAMPLES = collectExamples(VERBS.map((verb) => ({ verb })))
const text = (segs) => (segs ?? []).map((seg) => seg.t).join('')

describe('conjugation tables', () => {
  it('covers all 15 forms and all nine 五段 endings', () => {
    expect(Array.isArray(GODAN_ENDINGS)).toBe(true)
    expect(GODAN_ENDINGS).toHaveLength(9)
    for (const id of FORM_IDS) {
      expect(godanParts(id, 'む').kana).not.toBe('')
      expect(typeof ICHIDAN_SUFFIX[id]).toBe('string')
      expect(typeof IRREGULAR_SUFFIX.する[id]).toBe('string')
      expect(typeof IRREGULAR_SUFFIX.来る[id]).toBe('string')
    }
  })

  it('uses わ, not あ, for う-ending あ段 forms', () => {
    for (const id of ['nai-form', 'nakatta-form', 'passive-form', 'causative-form']) {
      expect(godanEnding(id, 'う').startsWith('わ')).toBe(true)
    }
    expect(godanEnding('nai-form', 'う')).toBe('わない')
    expect(godanEnding('causative-form', 'う')).toBe('わせる')
  })

  it('voices た／て after ぐ・ぬ・ぶ・む', () => {
    expect(godanEnding('ta-form', 'ぐ')).toBe('いだ')
    expect(godanEnding('te-form', 'む')).toBe('んで')
    expect(godanEnding('ta-form', 'く')).toBe('いた')
    expect(godanEnding('te-form', 'す')).toBe('して')
  })

  it('has 210 ordered pairs', () => {
    expect(orderedPairs()).toHaveLength(210)
  })
})

describe('段 / 音便 mapping follows 變形設置', () => {
  it('字典形 → ます形 shows the う段 → い段 kana pairs', () => {
    const lines = mappingLines('dictionary-form', 'masu-form')
    expect(lines[0].line).toBe('う → い　く → き　ぐ → ぎ')
    expect(lines[2].line).toContain('る → り')
    expect(lines.every((line) => line.label === '假名對應如下：')).toBe(true)
  })

  it('ます形 → て形 shows い、ち、り → って', () => {
    const lines = mappingLines('masu-form', 'te-form')
    expect(lines[0].line).toBe('い、ち、り → って')
    expect(lines[0].note).toContain('促音便')
    expect(lines[1].line).toBe('み、び、に → んで')
    expect(lines[1].note).toContain('濁音')
    expect(lines.map((line) => line.line)).toEqual([
      'い、ち、り → って',
      'み、び、に → んで',
      'き → いて',
      'ぎ → いで',
      'し → して',
    ])
  })

  it('ない形 → て形 starts from あ段 and warns about う → わ', () => {
    const lines = mappingLines('nai-form', 'te-form')
    expect(lines[0].line).toBe('わ、た、ら → って')
    expect(lines[1].line).toBe('ま、ば、な → んで')
    expect(lines[2].line).toBe('か → いて')
  })

  it('字典形 → ない形 flags the う → わ exception on the first row', () => {
    const lines = mappingLines('dictionary-form', 'nai-form')
    expect(lines[0].line).toBe('う → わ　く → か　ぐ → が')
    expect(lines[0].note).toContain('不是「あ」')
  })

  it('reverse 音便 pairs flip the table (って → い、ち、り)', () => {
    expect(mappingLines('ta-form', 'masu-form')[0].line).toBe('った → い、ち、り')
    expect(mappingLines('te-form', 'dictionary-form')[0].line).toBe('って → う、つ、る')
  })

  it('た形 ↔ て形 only swaps た／て', () => {
    expect(mappingLines('te-form', 'ta-form')[0].line).toBe('って → った')
    expect(mappingLines('ta-form', 'te-form')[1].line).toBe('んだ → んで')
  })

  it('same-段 pairs (ます形 → ません形) need no kana mapping', () => {
    expect(mappingLines('masu-form', 'masu-form-negative')).toBeNull()
    expect(mappingLabel('dictionary-form', 'te-form')).toBe('變形的音變如下：')
    expect(mappingLabel('dictionary-form', 'masu-form')).toBe('假名對應如下：')
  })
})

describe('special cases are annotated', () => {
  const all = (notes) => notes.map((n) => n.t).join(' ')

  it('warns about う → わ on あ段 pairs', () => {
    expect(all(specialNotes('dictionary-form', 'nai-form'))).toContain('買う → 買わない')
    expect(all(specialNotes('dictionary-form', 'causative-form'))).toContain('不是「買あない」')
  })

  it('warns about 行く and 濁音 on た／て pairs', () => {
    const t = all(specialNotes('dictionary-form', 'te-form'))
    expect(t).toContain('行く → 行った／行って')
    expect(t).toContain('ぐ、む、ぶ、ぬ')
  })

  it('warns about ある, する → できる and を → が', () => {
    expect(all(specialNotes('dictionary-form', 'nai-form'))).toContain('ある 的否定')
    expect(all(specialNotes('dictionary-form', 'potential-form'))).toContain('勉強できる')
    expect(all(specialNotes('dictionary-form', 'potential-form'))).toContain('無理ができる')
  })

  it('warns about る-ending 第一類 verbs and ら抜き', () => {
    expect(all(specialNotes('dictionary-form', 'masu-form'))).toContain('帰る → 帰ります')
    expect(all(ichidanNotes('dictionary-form', 'potential-form'))).toContain('ら抜き')
  })

  it('explains the 不規則 / 例外 blocks', () => {
    expect(all(irregularNotes('dictionary-form', 'potential-form'))).toContain('無理ができる')
    expect(all(exceptionNotes('dictionary-form', 'te-form'))).toContain('行った／行って')
  })

  it('marks warnings and tips, and drops the duplicated group-0 framing', () => {
    expect(specialNotes('dictionary-form', 'te-form').some((n) => n.c === 'warn')).toBe(true)
    const framed = JSON.stringify(RULE_CONTENT).includes('本教材把')
    expect(framed).toBe(false)
    expect(JSON.stringify(RULE_CONTENT)).not.toContain('group 0')
    expect(exceptionNotes('dictionary-form', 'nai-form').map((n) => n.t).join(' ')).not.toContain('帰る／切る')
  })
})

describe('generated 變形說明 content', () => {
  it('has all 210 entries complete', () => {
    expect(RULE_CONTENT).toHaveLength(210)
    expect(missingPairs(RULE_CONTENT)).toEqual([])
  })

  it('is byte-reproducible from vol/ and the pure rules', () => {
    expect(buildRuleContent(EXAMPLES)).toEqual(RULE_CONTENT)
  })

  it('uses only real dictionary words in every table cell', () => {
    expect(VERBS.length).toBe(386)
    let cells = 0
    for (const entry of RULE_CONTENT) {
      for (const section of entry.sections) {
        for (const row of section.rows) {
          const from = text(row.from)
          const to = text(row.to)
          const verb = VERBS.find((v) => FORM_IDS.some((id) => v[id]?.vol === from))
          expect(verb, `${entry.from}→${entry.to}: ${from}`).toBeTruthy()
          expect(verb[entry.to].vol, `${entry.from}→${entry.to}: ${from} → ${to}`).toBe(to)
          cells += 1
        }
      }
    }
    expect(cells).toBe(210 * 26)
  })

  it('keeps every example word consistent with its reading', () => {
    for (const key of [...EXAMPLE_GODAN, ...EXAMPLE_ICHIDAN, ...EXAMPLE_IRREGULAR, ...EXAMPLE_EXCEPTION]) {
      const { verb } = EXAMPLES[key]
      expect(checkExampleForms(verb), key).toEqual([])
      expect(verbShape(verb).kanjiPrefix).toBeTypeOf('string')
      const ending = formEnding(verb, 'dictionary-form')
      expect(Array.from(verb['dictionary-form'].japanese).join('').endsWith(ending)).toBe(true)
    }
  })

  it('shows the 段 / 音便 table and the special notes on every pair', () => {
    for (const entry of RULE_CONTENT) {
      const section = entry.sections[0]
      expect(section.heading).toContain('第一類動詞')
      expect(section.rule.length).toBeGreaterThan(0)
      expect(section.notes.length).toBeGreaterThan(0)
      if (isOnbin(entry.from) || isOnbin(entry.to)) {
        expect(section.map.label).toBe('變形的音變如下：')
        expect(section.map.rows.length).toBe(5)
      } else if (section.map) {
        expect(section.map.label).toBe('假名對應如下：')
      }
      expect(section.columns).toHaveLength(3)
    }
  })

  it('includes the 第三類 and 例外 blocks', () => {
    for (const entry of RULE_CONTENT) {
      expect(entry.sections).toHaveLength(4)
      expect(entry.sections[2].heading).toContain('第三類動詞')
      expect(entry.sections[3].heading).toContain('例外')
      expect(entry.sections[2].rows.length).toBe(5)
      expect(entry.sections[3].rows.length).toBe(6)
    }
  })

  it('shows the direction-specific 音便 line the user asked for', () => {
    const rule = findRule(RULE_CONTENT, 'masu-form', 'te-form')
    expect(rule.sections[0].map.rows[0].line).toBe('い、ち、り → って')
    const nai = findRule(RULE_CONTENT, 'dictionary-form', 'nai-form')
    expect(nai.sections[0].map.rows[0].note).toContain('不是「あ」')
    expect(nai.sections[0].notes.map((n) => n.t).join(' ')).toContain('買わない')
  })
})

describe('例如 derivation and 小提示', () => {
  it('no longer returns null for a pure addition or an identical pair', () => {
    const added = deriveChange({
      from: { vol: '買いません', japanese: 'かいません', group: '1' },
      to: { vol: '買いませんでした', japanese: 'かいませんでした', group: '1' },
      fromId: 'masu-form-negative', toId: 'masu-form-past-negative', ending: 'う',
    })
    expect(added.kind).toBe('godan')
    expect(added.result).toBe('買いませんでした')
    const same = deriveChange({
      from: { vol: '食べられる', japanese: 'たべられる', group: '2' },
      to: { vol: '食べられる', japanese: 'たべられる', group: '2' },
      fromId: 'potential-form', toId: 'passive-form', ending: 'る',
    })
    expect(same.kind).toBe('same')
    expect(same.result).toBe('食べられる')
  })

  it('carries no extra notes (小提醒 belongs to the tables only)', () => {
    const r = deriveChange({
      from: { vol: '買います', japanese: 'かいます', group: '1' },
      to: { vol: '買わない', japanese: 'かわない', group: '1' },
      fromId: 'masu-form', toId: 'nai-form', ending: 'う',
    })
    expect(r.notes).toBeUndefined()
    expect(r.result).toBe('買わない')
  })

  it('derives every real 從 → 到 pair without a blank or a wrong result', () => {
    let regular = 0
    for (const verb of VERBS) {
      const group = verb['dictionary-form'].group
      for (const from of FORM_IDS) {
        for (const to of FORM_IDS) {
          if (from === to) continue
          const ending = Array.from(verb['dictionary-form'].japanese).slice(-1)[0]
          const result = deriveChange({
            from: { ...verb[from], group }, to: { ...verb[to], group },
            fromId: from, toId: to, ending,
          })
          expect(result, `${verb['dictionary-form'].vol} ${from}→${to}`).not.toBeNull()
          if (result.kind !== 'irregular') {
            expect(result.result).toBe(verb[to].vol)
            regular += 1
          }
        }
      }
    }
    expect(regular).toBeGreaterThan(50000)
  })

  it('小提示 explains the method, the 段 mnemonic and the traps', () => {
    const tips = RULE_TIPS.join(' ')
    expect(RULE_TIPS.length).toBe(7)
    expect(RULE_TIPS.every((tip) => typeof tip === 'string')).toBe(true)
    expect(tips).toContain('原理')
    expect(tips).toContain('一個語幹，五個段')
    expect(tips).toContain('買う → 買わない')
    expect(tips).toContain('行った／行って')
    expect(tips).toContain('帰る')
    expect(tips).toContain('勉強できる')
    expect(tips).toContain('反向')
  })
})
