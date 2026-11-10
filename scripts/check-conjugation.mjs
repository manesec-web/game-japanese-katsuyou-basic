// Conjugation checker for vol/lesson_*.json
// Derives every form from the dictionary form + group and compares with the data.
// group 0 = 例外 (app label), resolved here by the dictionary kana.
// Usage: node scripts/check-conjugation.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const volDir = path.join(root, "vol");

const ROW = {
  う: { i: "い", a: "わ", e: "え", o: "お" },
  く: { i: "き", a: "か", e: "け", o: "こ" },
  ぐ: { i: "ぎ", a: "が", e: "げ", o: "ご" },
  す: { i: "し", a: "さ", e: "せ", o: "そ" },
  つ: { i: "ち", a: "た", e: "て", o: "と" },
  ぬ: { i: "に", a: "な", e: "ね", o: "の" },
  ぶ: { i: "び", a: "ば", e: "べ", o: "ぼ" },
  む: { i: "み", a: "ま", e: "め", o: "も" },
  る: { i: "り", a: "ら", e: "れ", o: "ろ" },
};
function teSuffix(last, whole) {
  if (whole.endsWith("いく")) return { te: "って", ta: "った" }; // 行く: いって
  if (whole === "とう" || whole === "こう") return { te: "うて", ta: "うた" }; // 問う/請う
  switch (last) {
    case "う": case "つ": case "る": return { te: "って", ta: "った" };
    case "む": case "ぶ": case "ぬ": return { te: "んで", ta: "んだ" };
    case "く": return { te: "いて", ta: "いた" };
    case "ぐ": return { te: "いで", ta: "いだ" };
    case "す": return { te: "して", ta: "した" };
  }
  return null;
}
const SPECIAL_MASU = new Set(["いらっしゃる", "おっしゃる", "なさる", "くださる", "ある"]);

function derive(dictKana, group) {
  const suruType = dictKana.endsWith("する");
  const kuruType = dictKana.endsWith("くる") && (group === "3" || group === "0");
  if (suruType) {
    let s = dictKana.slice(0, -2);
    const pot = s.replace(/を$/, "が") + "できる";
    return {
      "masu-form": s + "します", "masu-form-negative": s + "しません",
      "masu-form-past": s + "しました", "masu-form-past-negative": s + "しませんでした",
      "nai-form": s + "しない", "ta-form": s + "した", "nakatta-form": s + "しなかった",
      "te-form": s + "して", "potential-form": pot,
      "volitional-form": s + "しよう", "imperative-form": s + "しろ",
      "conditional-form": s + "すれば", "passive-form": s + "される",
      "causative-form": s + "させる",
    };
  }
  if (kuruType) {
    const s = dictKana.slice(0, -2);
    return {
      "masu-form": s + "きます", "masu-form-negative": s + "きません",
      "masu-form-past": s + "きました", "masu-form-past-negative": s + "きませんでした",
      "nai-form": s + "こない", "ta-form": s + "きた", "nakatta-form": s + "こなかった",
      "te-form": s + "きて", "potential-form": s + "こられる",
      "volitional-form": s + "こよう", "imperative-form": s + "こい",
      "conditional-form": s + "くれば", "passive-form": s + "こられる",
      "causative-form": s + "こさせる",
    };
  }
  if (group === "2") {
    const s = dictKana.slice(0, -1);
    return {
      "masu-form": s + "ます", "masu-form-negative": s + "ません",
      "masu-form-past": s + "ました", "masu-form-past-negative": s + "ませんでした",
      "nai-form": s + "ない", "ta-form": s + "た", "nakatta-form": s + "なかった",
      "te-form": s + "て", "potential-form": s + "られる",
      "volitional-form": s + "よう", "imperative-form": s + "ろ",
      "conditional-form": s + "れば", "passive-form": s + "られる",
      "causative-form": s + "させる",
    };
  }
  // godan (group 1, and group-0 exceptions that are godan)
  const last = dictKana.slice(-1);
  const row = ROW[last];
  if (!row) return null;
  const s = dictKana.slice(0, -1);
  const t = teSuffix(last, dictKana);
  if (!t) return null;
  const special = SPECIAL_MASU.has(dictKana);
  if (dictKana === "ある") {
    return {
      "masu-form": "あります", "masu-form-negative": "ありません",
      "masu-form-past": "ありました", "masu-form-past-negative": "ありませんでした",
      "nai-form": "ない", "ta-form": "あった", "nakatta-form": "なかった",
      "te-form": "あって", "potential-form": "ありえる",
      "volitional-form": "あろう", "imperative-form": "あれ",
      "conditional-form": "あれば", "passive-form": "あられる",
      "causative-form": "あらせる",
    };
  }
  return {
    "masu-form": special ? s + "います" : s + row.i + "ます",
    "masu-form-negative": special ? s + "いません" : s + row.i + "ません",
    "masu-form-past": special ? s + "いました" : s + row.i + "ました",
    "masu-form-past-negative": special ? s + "いませんでした" : s + row.i + "ませんでした",
    "nai-form": s + row.a + "ない",
    "ta-form": s + t.ta,
    "nakatta-form": s + row.a + "なかった",
    "te-form": s + t.te,
    "potential-form": s + row.e + "る",
    "volitional-form": s + row.o + "う",
    "imperative-form": s + row.e,
    "conditional-form": s + row.e + "ば",
    "passive-form": s + row.a + "れる",
    "causative-form": s + row.a + "せる",
  };
}

const issues = [];
const strip = (str) => (str || "").replace(/\s+/g, "").replace(/　/g, "");
const seen = new Map();

for (let i = 1; i <= 50; i++) {
  const file = path.join(volDir, `lesson_${i}.json`);
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const lesson = Object.keys(j)[0];
  const vols = j[lesson].vols || [];
  for (let vi = 0; vi < vols.length; vi++) {
    const v = vols[vi];
    const dict = v["dictionary-form"];
    if (!dict) { issues.push({ lesson: i, verb: `#${vi + 1}`, form: "dictionary-form", kind: "missing", msg: "no dictionary-form" }); continue; }
    const g = dict.group;
    if (!["0", "1", "2", "3"].includes(g)) issues.push({ lesson: i, verb: dict.vol, form: "group", kind: "group", msg: `group = ${JSON.stringify(g)}` });
    const derived = derive(dict.japanese, g);
    if (!derived) { issues.push({ lesson: i, verb: dict.vol, form: "derive", kind: "derive", msg: `cannot derive for ${dict.japanese} group ${g}` }); continue; }
    if (seen.has(dict.japanese)) issues.push({ lesson: i, verb: dict.vol, form: "duplicate", kind: "duplicate", msg: `same dict reading also in L${seen.get(dict.japanese)}` });
    seen.set(dict.japanese, i);
    // kanji prefix / reading
    const dvol = dict.vol, dkana = dict.japanese;
    let okuri = "";
    while (okuri.length < dvol.length) {
      const cand = dvol.slice(dvol.length - okuri.length - 1);
      if (/^[ぁ-ゖー]+$/.test(cand)) okuri = cand; else break;
    }
    const kanjiPrefix = dvol.slice(0, dvol.length - okuri.length);
    const isKuru = dkana.endsWith("くる") && (g === "3" || g === "0");
    let reading = null;
    if (!isKuru) {
      if (!dkana.endsWith(okuri)) issues.push({ lesson: i, verb: dvol, form: "dictionary-form", kind: "okurigana", msg: `okurigana ${okuri} not a suffix of reading ${dkana}` });
      else reading = dkana.slice(0, dkana.length - okuri.length);
    }
    const chineseSet = new Set([dict.chinese]);
    for (const [form, expKana] of Object.entries(derived)) {
      const got = v[form];
      if (!got) { issues.push({ lesson: i, verb: dvol, form, kind: "missing", msg: "form missing" }); continue; }
      if (got.group !== g) issues.push({ lesson: i, verb: dvol, form, kind: "group-mismatch", msg: `group ${got.group} != dict group ${g}` });
      chineseSet.add(got.chinese);
      if (got.japanese !== expKana) issues.push({ lesson: i, verb: dvol, form, kind: "kana", msg: `data ${got.japanese} / expected ${expKana}` });
      if (!isKuru && got.vol) {
        const expVol = kanjiPrefix + got.japanese.slice(reading.length);
        if (got.vol !== expVol) issues.push({ lesson: i, verb: dvol, form, kind: "kanji", msg: `vol ${got.vol} / expected ${expVol}` });
      }
      const ss = got.sentence || [];
      if (ss.length !== 3) issues.push({ lesson: i, verb: dvol, form, kind: "sentence-count", msg: `${ss.length} sentences` });
      ss.forEach((s, si) => {
        const jp = strip(s.japanese);
        const cands = [got.vol, got.japanese, got.japanese + "ます", got.vol ? got.vol + "ます" : ""].map(strip);
        if (!cands.some((c) => c && jp.includes(c))) {
          issues.push({ lesson: i, verb: dvol, form, kind: "sentence-form", msg: `sentence ${si + 1} lacks the form: ${(s.japanese || "").slice(0, 60)}` });
        }
      });
    }
    if (chineseSet.size > 1) issues.push({ lesson: i, verb: dvol, form: "chinese", kind: "chinese-varies", msg: [...chineseSet].join(" | ") });
  }
}

const byKind = {};
for (const it of issues) byKind[it.kind] = (byKind[it.kind] || 0) + 1;
console.log(`issues: ${issues.length}`);
console.log("by kind:", JSON.stringify(byKind));
const out = path.join(root, "conj-check-issues.json");
fs.writeFileSync(out, JSON.stringify(issues, null, 1), "utf8");
console.log("details ->", out);
