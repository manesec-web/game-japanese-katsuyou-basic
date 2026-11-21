// Conjugation rules for 學習 / 變形說明.
//
// This is the single source of truth shared by the authored explanation
// generator (scripts/generate-rule-content.mjs), its tests, and the interactive
// 例如 demo at runtime. It encodes the standard 五段 / 一段 / 不規則 tables plus
// the exceptions this teaching app must point out. All data here is pure: no
// DOM, no Vue, no dictionary I/O.
//
// Model: a 五段 form is `語幹 + 段假名 + 語尾`. The 段假名 is one of the nine
// dictionary endings moved onto the あ/い/う/え/お row (or onto a 音便 stem for
// た形/て形). A 一段 form keeps its 語幹 and only swaps the 語尾. する / 来る are
// irregular: both the stem reading and the ending can change.

import { FORM_IDS } from '../dict/forms.js'

export const GODAN_ENDINGS = ['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る']

// The 段假名 for each dictionary ending. `ta` / `te` are the 音便 stems.
export const ROW_KANA = {
  う: { u: 'う', i: 'い', a: 'わ', e: 'え', o: 'お', ta: 'っ', te: 'っ' },
  く: { u: 'く', i: 'き', a: 'か', e: 'け', o: 'こ', ta: 'い', te: 'い' },
  ぐ: { u: 'ぐ', i: 'ぎ', a: 'が', e: 'げ', o: 'ご', ta: 'い', te: 'い' },
  す: { u: 'す', i: 'し', a: 'さ', e: 'せ', o: 'そ', ta: 'し', te: 'し' },
  つ: { u: 'つ', i: 'ち', a: 'た', e: 'て', o: 'と', ta: 'っ', te: 'っ' },
  ぬ: { u: 'ぬ', i: 'に', a: 'な', e: 'ね', o: 'の', ta: 'ん', te: 'ん' },
  ぶ: { u: 'ぶ', i: 'び', a: 'ば', e: 'べ', o: 'ぼ', ta: 'ん', te: 'ん' },
  む: { u: 'む', i: 'み', a: 'ま', e: 'め', o: 'も', ta: 'ん', te: 'ん' },
  る: { u: 'る', i: 'り', a: 'ら', e: 'れ', o: 'ろ', ta: 'っ', te: 'っ' },
}

// Which 段 / 音便 stem each form uses.
export const GODAN_ROW = {
  'dictionary-form': 'u',
  'masu-form': 'i',
  'masu-form-negative': 'i',
  'masu-form-past': 'i',
  'masu-form-past-negative': 'i',
  'nai-form': 'a',
  'nakatta-form': 'a',
  'ta-form': 'ta',
  'te-form': 'te',
  'potential-form': 'e',
  'volitional-form': 'o',
  'imperative-form': 'e',
  'conditional-form': 'e',
  'passive-form': 'a',
  'causative-form': 'a',
}

// The 語尾 that follows the 段假名.
export const GODAN_SUFFIX = {
  'dictionary-form': '',
  'masu-form': 'ます',
  'masu-form-negative': 'ません',
  'masu-form-past': 'ました',
  'masu-form-past-negative': 'ませんでした',
  'nai-form': 'ない',
  'nakatta-form': 'なかった',
  'ta-form': 'た',
  'te-form': 'て',
  'potential-form': 'る',
  'volitional-form': 'う',
  'imperative-form': '',
  'conditional-form': 'ば',
  'passive-form': 'れる',
  'causative-form': 'せる',
}

export const VOICED_ENDINGS = new Set(['ぐ', 'ぬ', 'ぶ', 'む'])
export const ONBIN_FORMS = new Set(['ta-form', 'te-form'])

export function isOnbin(formId) {
  return ONBIN_FORMS.has(formId)
}

// 撥音便 / ぐ 的 イ音便 後面接濁音：た→だ、て→で。
export function voicedSuffix(suffix) {
  return suffix === 'た' ? 'だ' : suffix === 'て' ? 'で' : suffix
}

export function suffixLabel(formId) {
  const base = GODAN_SUFFIX[formId]
  if (formId === 'ta-form') return 'た／だ'
  if (formId === 'te-form') return 'て／で'
  return base
}

// The 段假名 + 語尾 for one dictionary ending.
export function godanParts(formId, ending) {
  const kana = ROW_KANA[ending]?.[GODAN_ROW[formId]]
  if (kana === undefined) return { kana: '', suffix: '' }
  const suffix = VOICED_ENDINGS.has(ending) && isOnbin(formId)
    ? voicedSuffix(GODAN_SUFFIX[formId])
    : GODAN_SUFFIX[formId]
  return { kana, suffix }
}

// The full ending (without 語幹) of a 五段 form.
export function godanEnding(formId, ending) {
  const { kana, suffix } = godanParts(formId, ending)
  return kana + suffix
}

export const ROW_LABEL = {
  u: 'う段', i: 'い段', a: 'あ段', e: 'え段', o: 'お段',
  ta: '音便（た形）', te: '音便（て形）',
}

// 一段: the 語幹 never changes; only the 語尾 is swapped.
export const ICHIDAN_SUFFIX = {
  'dictionary-form': 'る',
  'masu-form': 'ます',
  'masu-form-negative': 'ません',
  'masu-form-past': 'ました',
  'masu-form-past-negative': 'ませんでした',
  'nai-form': 'ない',
  'nakatta-form': 'なかった',
  'ta-form': 'た',
  'te-form': 'て',
  'potential-form': 'られる',
  'volitional-form': 'よう',
  'imperative-form': 'ろ',
  'conditional-form': 'れば',
  'passive-form': 'られる',
  'causative-form': 'させる',
}

// 不規則: する / 来る. The whole written ending is stored because the stem
// reading changes too (来る→来ます is くる→きます; 来ない is こない).
export const IRREGULAR_SUFFIX = {
  する: {
    'dictionary-form': 'する',
    'masu-form': 'します',
    'masu-form-negative': 'しません',
    'masu-form-past': 'しました',
    'masu-form-past-negative': 'しませんでした',
    'nai-form': 'しない',
    'nakatta-form': 'しなかった',
    'ta-form': 'した',
    'te-form': 'して',
    'potential-form': 'できる',
    'volitional-form': 'しよう',
    'imperative-form': 'しろ',
    'conditional-form': 'すれば',
    'passive-form': 'される',
    'causative-form': 'させる',
  },
  来る: {
    'dictionary-form': '来る',
    'masu-form': '来ます',
    'masu-form-negative': '来ません',
    'masu-form-past': '来ました',
    'masu-form-past-negative': '来ませんでした',
    'nai-form': '来ない',
    'nakatta-form': '来なかった',
    'ta-form': '来た',
    'te-form': '来て',
    'potential-form': '来られる',
    'volitional-form': '来よう',
    'imperative-form': '来い',
    'conditional-form': '来れば',
    'passive-form': '来られる',
    'causative-form': '来させる',
  },
}

// 音便 groups, in the standard teaching order: 促音便 (う・つ・る), 撥音便
// (む・ぶ・ぬ), イ音便 (く・ぐ), then す (不變音).
export const ONBIN_ORDER = ['う', 'つ', 'る', 'む', 'ぶ', 'ぬ', 'く', 'ぐ', 'す']

export const ONBIN_NOTE = {
  っ: '促音便（小 っ）',
  ん: '撥音便，後面接濁音 だ／で',
  い: 'イ音便',
  し: 'す行不變音',
}

export function onbinNote(formId, ending) {
  const f = godanParts(formId, ending)
  if (isOnbin(formId)) return ONBIN_NOTE[f.kana] ?? ''
  return ''
}

// The 音便 / 段 mapping for a (from, to) pair. This is the part that MUST change
// with 變形設置: 辭書形→て形 shows う、つ、る → って, ます形→て形 shows
// い、ち、り → って, ない形→て形 shows わ、た、ら → って, and a reverse pair
// shows って → い、ち、り. Returns null when no kana mapping is needed (both
// forms sit on the same 段 and only the 語尾 changes).
export function mappingLines(from, to) {
  const fOnbin = isOnbin(from)
  const tOnbin = isOnbin(to)
  const fRow = GODAN_ROW[from]
  const tRow = GODAN_ROW[to]
  // Same 段, only the polite ending changes: no kana mapping to show.
  if (!fOnbin && !tOnbin && fRow === tRow) return null
  const label = mappingLabel(from, to)

  // A plain 段 change: show the nine kana pairs in three readable rows.
  if (!fOnbin && !tOnbin) {
    const lines = []
    let chunk = []
    let waNote = ''
    for (const ending of GODAN_ENDINGS) {
      const f = godanParts(from, ending)
      const t = godanParts(to, ending)
      chunk.push(`${f.kana} → ${t.kana}`)
      if (ending === 'う' && (fRow === 'a' || tRow === 'a')) {
        waNote = 'う 結尾走「わ」，不是「あ」'
      }
      if (chunk.length === 3) {
        lines.push({ line: chunk.join('　'), note: '', label })
        chunk = []
      }
    }
    if (chunk.length) lines.push({ line: chunk.join('　'), note: '', label })
    if (waNote && lines[0]) lines[0].note = waNote
    return lines
  }

  // 音便: group by the resulting (or, in reverse, the original) 音便 ending.
  const groups = new Map()
  for (const ending of ONBIN_ORDER) {
    const f = godanParts(from, ending)
    const t = godanParts(to, ending)
    let key, member, note
    if (tOnbin && !fOnbin) {
      key = t.kana + t.suffix
      member = f.kana
      note = ONBIN_NOTE[t.kana] ?? ''
    } else if (fOnbin && !tOnbin) {
      key = f.kana + f.suffix
      member = t.kana
      note = ONBIN_NOTE[f.kana] ?? ''
    } else {
      key = t.kana + t.suffix
      member = f.kana + f.suffix
      note = f.suffix === t.suffix ? '' : '只換 た／て（濁音 だ／で）'
    }
    if (!groups.has(key)) groups.set(key, { members: [], note })
    const group = groups.get(key)
    if (!group.members.includes(member)) group.members.push(member)
    if (note && !group.note) group.note = note
  }

  const reverse = fOnbin && !tOnbin
  return [...groups.entries()].map(([key, group]) => ({
    line: reverse
      ? `${key} → ${group.members.join('、')}`
      : `${group.members.join('、')} → ${key}`,
    note: group.note,
    label,
  }))
}

export function mappingLabel(from, to) {
  return (isOnbin(from) || isOnbin(to)) ? '變形的音變如下：' : '假名對應如下：'
}

// A generic rule line for a 五段 pair. The old generator used 読む as the only
// example, which gave wrong copy for other endings (e.g. 去「で」 for 買った).
// This describes the operation in terms of 段 / 音便 instead.
export function godanRule(from, to) {
  const fRow = GODAN_ROW[from]
  const tRow = GODAN_ROW[to]
  const fSuffix = GODAN_SUFFIX[from]
  const tSuffix = GODAN_SUFFIX[to]
  const fOnbin = isOnbin(from)
  const tOnbin = isOnbin(to)
  const steps = []

  if (fSuffix) {
    steps.push(`去掉語尾「${suffixLabel(from)}」`)
  }
  if (fOnbin || tOnbin) {
    steps.push('把最後一個假名按下面的音便表換過來（音便是特例，不照 段 走）')
  } else if (fRow !== tRow) {
    steps.push(`把最後一個假名由 ${ROW_LABEL[fRow]} 改成 ${ROW_LABEL[tRow]}`)
  } else {
    steps.push('最後一個假名不變')
  }
  if (tSuffix) {
    steps.push(`接上「${suffixLabel(to)}」`)
  } else {
    steps.push('後面不再加語尾')
  }
  return `${steps.join('，')}。`
}

export function ichidanRule(from, to) {
  const fs = ICHIDAN_SUFFIX[from]
  const ts = ICHIDAN_SUFFIX[to]
  if (fs === ts) {
    return `兩個形的語尾都是「${fs}」，寫法完全相同，不用變。`
  }
  return `語幹不動，去掉語尾「${fs}」，直接加「${ts}」。`
}

// --- Special annotations ---------------------------------------------------
// Every note carries the pair condition that makes it relevant, so a 變形說明
// page only prints the special cases that actually apply to its 從 / 到.

const A_ROW_FORMS = new Set(['nai-form', 'nakatta-form', 'passive-form', 'causative-form'])
const MASU_FORMS = new Set(['masu-form', 'masu-form-negative', 'masu-form-past', 'masu-form-past-negative'])
const LOOK_FORMS = new Set(['dictionary-form', 'masu-form', 'nai-form', 'ta-form', 'te-form', 'potential-form', 'imperative-form', 'conditional-form'])

const NOTES = [
  {
    c: 'warn',
    t: '⚠️ あ段 的唯一例外：う 結尾不能接「あ」，要改成「わ」。買う → 買わない／買わせる／買われる，不是「買あない」。',
    when: (f, t) => A_ROW_FORMS.has(f) || A_ROW_FORMS.has(t),
  },
  {
    c: 'warn',
    t: '⚠️ 行く（含 持って行く、連れて行く）是 か行 的唯一例外：走促音便，行く → 行った／行って，不是「行いた／行いて」。',
    when: (f, t) => isOnbin(f) || isOnbin(t),
  },
  {
    c: 'warn',
    t: '⚠️ 問う／請う 等「〜う」走 う音便：問う → 問うた／問うて（現代較常用 質問した／頼んだ）。本教材未收這些詞。',
    when: (f, t) => isOnbin(f) || isOnbin(t),
  },
  {
    c: 'warn',
    t: '⚠️ ある 的否定不是「あらない」，而是直接用 ない／なかった；但ます形仍是 あります。',
    when: (f, t) => f === 'nai-form' || t === 'nai-form' || f === 'nakatta-form' || t === 'nakatta-form',
  },
  {
    c: 'warn',
    t: '⚠️ 「名詞＋する」的可能形是 できる（勉強する → 勉強できる），不是「〜される」或「〜しられる」。',
    when: (f, t) => f === 'potential-form' || t === 'potential-form',
  },
  {
    c: 'warn',
    t: '⚠️ 「〜をする」變可能形時，助詞一起改：無理をする → 無理ができる、世話をする → 世話ができる。',
    when: (f, t) => f === 'potential-form' || t === 'potential-form',
  },
  {
    c: 'warn',
    t: '⚠️ 帰る／切る／知る／入る／要る／走る／減る／滑る 雖是「〜る」，卻是 第一類：帰る → 帰ります／帰らない／帰って，不是 帰ます／帰ない／帰て。',
    when: (f, t) => LOOK_FORMS.has(f) || LOOK_FORMS.has(t),
  },
  {
    c: 'tip',
    t: '💡 記憶口訣：辭書形在 う段、ます形在 い段、ない形在 あ段、可能形／命令形／ば形在 え段、意向形在 お段。',
    when: () => true,
  },
  {
    c: 'tip',
    t: '💡 た形 與 て形 共用同一個音便語尾，只差最後的 た／て（濁音 だ／で）：買った／買って、読んだ／読んで。',
    when: (f, t) => isOnbin(f) || isOnbin(t),
  },
  {
    c: 'tip',
    t: '💡 音便後面是否濁音，看原本的語尾：ぐ、む、ぶ、ぬ → いだ／んだ／いで／んで；其餘 → いた／った／いて／って。',
    when: (f, t) => isOnbin(f) || isOnbin(t),
  },
  {
    c: 'tip',
    t: '💡 ます形 家族只是把禮貌語尾疊起來：ます → ません（否定）／ました（過去）／ませんでした（過去否定），語尾假名都在 い段。',
    when: (f, t) => MASU_FORMS.has(f) || MASU_FORMS.has(t),
  },
  {
    c: 'tip',
    t: '💡 いらっしゃる／おっしゃる／なさる／くださる／ござる 的ます形是「〜います」而非「〜ります」；本教材未收，考試常考。',
    when: (f, t) => MASU_FORMS.has(f) || MASU_FORMS.has(t),
  },
  {
    c: 'tip',
    t: '💡 第二類的 可能形 與 受身形 同形（食べられる）；口語常「ら抜き」成 食べれる，初學先記課本的 られる。',
    when: (f, t) => f === 'potential-form' || t === 'potential-form' || f === 'passive-form' || t === 'passive-form',
  },
  {
    c: 'tip',
    t: '💡する 的三個易混形：使役 させる、受身 される、可能 できる，別把 さ／せ 混在一起。',
    when: (f, t) => f === 'causative-form' || t === 'causative-form' || f === 'passive-form' || t === 'passive-form',
  },
]

export function specialNotes(from, to) {
  return NOTES.filter((note) => note.when(from, to)).map((note) => ({ t: note.t, c: note.c }))
}

// Notes for the 一段 block: the same pair, but phrased for the 語尾-only rule.
export function ichidanNotes(from, to) {
  const notes = [
    { c: 'tip', t: '💡 第二類（一段）的語幹永遠不動，只換語尾：食べる → 食べます／食べない／食べて／食べられる。' },
  ]
  if (ICHIDAN_SUFFIX[from] === ICHIDAN_SUFFIX[to]) {
    notes.push({ c: 'warn', t: '⚠️ 這一對的兩個形剛好同形：可能形與受身形都是「〜られる」，不是漏寫。' })
  }
  if (from === 'imperative-form' || to === 'imperative-form') {
    notes.push({ c: 'tip', t: '💡 命令形口語也用「〜よ」（食べよ／見よ）；課本先記「〜ろ」。' })
  }
  if (from === 'potential-form' || to === 'potential-form') {
    notes.push({ c: 'tip', t: '💡 口語的「ら抜き」（食べれる／見れる）很常見，但考試請寫 られる。' })
  }
  if (from === 'volitional-form' || to === 'volitional-form') {
    notes.push({ c: 'tip', t: '💡 意向形 よう 表「～吧」；ます形 的 ましょう 是它的禮貌說法。' })
  }
  return notes
}

// Notes for the 不規則 / 例外 blocks.
export function irregularNotes(from, to) {
  const notes = [
    { c: 'warn', t: '⚠️ する／来る 不套用 段 的規律，語幹的讀音也會變，請整組死記。' },
  ]
  if (from === 'potential-form' || to === 'potential-form') {
    notes.push({ c: 'warn', t: '⚠️ する → できる；「〜をする」→「〜ができる」（無理をする → 無理ができる）。' })
    notes.push({ c: 'tip', t: '💡 来る 的可能形是 来られる（こられる），受身形也是 来られる，兩者同形。' })
  }
  if (from === 'imperative-form' || to === 'imperative-form') {
    notes.push({ c: 'tip', t: '💡 する 的命令形有 しろ／せよ，来る 是 来い（こい）。' })
  }
  return notes
}

export function exceptionNotes(from, to) {
  const notes = []
  if (isOnbin(from) || isOnbin(to)) {
    notes.push({ c: 'warn', t: '⚠️ 行く 是 か行 例外：行った／行って（促音便），不是 行いた／行いて。' })
  }
  if (from === 'nai-form' || to === 'nai-form' || from === 'nakatta-form' || to === 'nakatta-form') {
    notes.push({ c: 'warn', t: '⚠️ ある 的否定是 ない／なかった，沒有「あらない」。' })
  }
  if (from === 'potential-form' || to === 'potential-form') {
    notes.push({ c: 'warn', t: '⚠️ 無理をする → 無理ができる、世話をする → 世話ができる（を → が）。' })
  }
  return notes
}

// Every ordered pair with 從 ≠ 到 — the 210 keys the generator must author.
export function orderedPairs() {
  const pairs = []
  for (const from of FORM_IDS) {
    for (const to of FORM_IDS) {
      if (from !== to) pairs.push({ from, to })
    }
  }
  return pairs
}
