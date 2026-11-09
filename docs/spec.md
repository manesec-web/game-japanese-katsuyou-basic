# Product spec

A single-page site for learning Japanese verb conjugation. Phones come first. On a computer the content column stays in the center. The data is `vol/lesson_1.json` through `vol/lesson_50.json`.

Wireframes are in `docs/screenshot-draft/`. The green frame is the phone. Text outside that frame (the 沒有動詞 / 選中 / 可選 legend, and the input-method note beside the quiz) is a note for the reader. It is not a sidebar and it is not on-screen copy.

On-screen labels below are the product copy. Keep them as written.

## Data

Each file has this shape:

```json
{
  "lesson_15": {
    "vols": [
      {
        "dictionary-form": {
          "vol": "立つ",
          "group": "1",
          "chinese": "站; 站立",
          "japanese": "たつ",
          "sentence": [
            { "japanese": "……", "chinese": "……" }
          ]
        }
      }
    ]
  }
}
```

A verb object has exactly these 15 keys, in this order:

| id | On-screen name |
|---|---|
| `dictionary-form` | 字典形 |
| `masu-form` | ます形 |
| `masu-form-negative` | ません形 |
| `masu-form-past` | ました形 |
| `masu-form-past-negative` | ませんでした形 |
| `nai-form` | ない形 |
| `ta-form` | た形 |
| `nakatta-form` | なかった形 |
| `te-form` | て形 |
| `potential-form` | 可能形 |
| `volitional-form` | 意向形 |
| `imperative-form` | 命令形 |
| `conditional-form` | ば形 |
| `passive-form` | 受身形 |
| `causative-form` | 使役形 |

Every form has `vol` (the written word), `group`, `chinese`, `japanese` (the reading), and `sentence` (three pairs of Japanese and Chinese). All 15 forms of one verb share the same `group`.

`group` labels:

| value | label |
|---|---|
| `0` | 例外 |
| `1` | 1類動詞 |
| `2` | 2類動詞 |
| `3` | 3類動詞 |

Lessons 1, 3, 8, and 12 have an empty `vols` array. Those four lessons are the gray “no verb” chips in the wireframe and cannot be selected. The other lessons hold 386 verbs in total.

`japanese` is the reading of that form. It has no spaces. Most values are hiragana. Some include katakana (for example `コピーする`) and the long-vowel mark `ー`.

## How the dictionary reaches the browser

`scripts/write-sha256.mjs` hashes the raw bytes of each `vol/lesson_N.json` and writes lowercase hex sha256 into `src/data/dict-manifest.json`. That manifest ships with the site.

The site loads `dict/lesson_N.json` from the same origin. In dev, Vite serves those files from `vol/`. The build copies them to `output/dict/`.

The cache lives in an IndexedDB database named `katsuyou-dict`, in an object
store named `lessons`. One record per lesson: the key is the lesson file name
(`lesson_N.json`) and the value is the raw file bytes.

On boot, handle the 50 lessons in order:

1. The file is missing from IndexedDB: download it, hash it, and write it only when the hash matches the manifest.
2. The file is already in IndexedDB: hash it, and use it when the hash matches the manifest.
3. The hash does not match: download once more and overwrite. If the second copy still does not match, stop, name the lesson, and offer retry.

Progress is finished lessons divided by 50. The loading text is `Loading ...`.

## Screens

State machine:

`loading` → `home` → `picker` → (`reader` | `card` | `quiz`). Those last three can open `settings` and return.

A reload starts at `loading` again. When the dictionary is already in IndexedDB, boot only checks hashes, and the progress bar still runs.

The column is `min(100%, 480px)`, centered horizontally. At viewport widths of 550px or less the column is full-bleed: it fills the browser, with no side margins, radius, or shadow, and the gradient background and grain are dropped so the column colour is the whole page. Above 550px the column keeps its frame and the background is visible; that frame is also the signal that the page is in desktop mode.

### Home

The head is three lines above the entries: the large title `大家の日本語`, the medium subtitle `轉型練習` under it, and the line `涵蓋初級 1 – 50 課的單詞` under that.

Three large buttons, stacked: 字典, 翻卡學習, 測驗.

The footer has two lines. The first is `🥺 如果有 BUG 記得告訴我！`; the second is `Build with ❤ by Mane`. Both open the same small sheet.

The sheet is the About panel. It reads:

- `本項目已經開源，` + link + `可以獲得源代碼。` The link is `https://github.com/manesec-web/game-japanese-katsuyou-basic` and opens in a new tab.
- `意見 & Bug 反饋：` followed by an ordered list: `提交ISSUE`, which opens `https://github.com/manesec-web/game-japanese-katsuyou-basic/issues/new` in a new tab, and `或者發送郵件到` + link + the address `mane@manesec.com`, a `mailto:` link.
- `🥺 どうもありがとうございます。`
- 關閉 closes the sheet.

### Lesson picker

Back at the top returns to home.

The title is 詞彙. On the right, 全選 selects every lesson that has verbs when any of those lessons is still unselected, and clears them when they are already all selected. The control's label follows that state: it reads 全選 until every lesson with verbs is selected, then 取消全選.

Lessons are wrapping rounded buttons labeled `第1課` through `第50課`. Three looks:

- Has verbs, not selected: outline.
- Has verbs, selected: filled.
- Has no verbs: gray, the button does nothing, and hovering or focusing it shows the hint 該課沒有動詞.

Dictionary mode ends there, with 開始 below.

Card mode and quiz mode add a 變形 block.

- 從 is a single choice. The default is `masu-form`. The control is one button that opens a list of the 15 names.
- 到 is a multiple choice. The default is `dictionary-form` only. The buttons wrap. A header row sits above the chips: 到 on the left and 全選 on the right. 全選 selects every form except 從. If those forms are already all selected, the next press leaves only `dictionary-form`, or `masu-form` when 從 is already the dictionary form.
- Changing 從 to a form that is selected in 到 removes that target immediately.
- While no lesson is selected, the footer shows `請至少選擇一門課程才可以開始` above 開始, in every mode. This line comes first: a run with no vocabulary cannot start, so it replaces the 轉型 line below.
- Deselecting every 到 chip is allowed. While a lesson is selected but 到 is empty, the footer shows `請至少選擇一個轉型才可以開始` above 開始, and 開始 is disabled. The hint is absent as soon as one target form is selected. Dictionary mode has no 轉型 block and never shows that hint.
- 開始 is disabled when there is no target or no lesson.

Each mode remembers its own lessons and form choices under the `localStorage` key `katsuyou-settings`.

開始 builds the item list and opens study. The dictionary list is the verbs in the selected lessons, lessons ascending, and inside a lesson the JSON order. The card and quiz lists are those verbs crossed with the selected target forms: lesson, then in-lesson order, then the form order in the table above. Study starts at the first item.

### Dictionary reader

Top: back (to the picker), the title `學習（n/total）`, and a settings gear.

The body lists every one of the 15 forms, in the canonical order of the table above. Each form block shows:

- A small heading with the form name, for example `字典形` or `ます形`. Every block has one.
- The word `vol`. When readings are on, apply the ruby rules below so `japanese` sits on the kanji.
- The gloss `chinese`, with its semicolons kept.
- Two tags, the group label and `第N課`. Only the first block carries them, so the pills appear once per word instead of fifteen times.
- 例句： that form’s three sentences. Japanese first, then Chinese. Inside the Japanese line, every occurrence of that form’s own `vol` is painted in purple so the word is visible in context. The match is exact: the sentence text is never rewritten, and the Chinese line is left plain. Every form in `vol/` contains its own `vol` inside at least one of its sentences.

All 15 blocks share one format: the same padding, a hairline separator between blocks, and no tinted panel, accent border, radius or inset margins. The block for the current 預設顯示形式 is simply the first block; the others follow in the canonical order. A word opens at the top of the page. There is no separate 字典形 section at the bottom.

At 550px or less, swipe right-to-left for the next word and swipe left-to-right for the previous word: the page follows the hand, so the next word is pushed in from the right edge. The word follows the finger or the pointer. A horizontal move past 72px changes the word. A shorter move springs back. The first item does not move backward. The last item does not move forward. Vertical movement stays page scroll.

Paging is a flat horizontal slide, the way a phone moves between its own screens: the word follows the finger in a straight horizontal line with no rotation, no tilt, no fade and no depth. The outgoing page slides fully out in the direction of travel and the new word is pushed in from the opposite edge, both staying flat on the plane. The same motion runs when the footer controls are pressed. Under `prefers-reduced-motion: reduce` the word changes at once, with no slide. Card mode pages the same way: right-to-left is the next card.

Above 550px the reader does not page by gesture, so text can be selected and copied: a drag selects text and only the two footer controls change the word. The dictionary has no completion screen; it stops at the last word.

The footer has two controls labeled `上一個` and `下一個`; they perform the same moves and are disabled at the first and last item. The footer is pinned to the bottom of the column, like the picker's 開始. It keeps the column colour fading to transparent above the controls, with no hairline underline, and the fade band lives inside the footer's top padding so the two buttons always sit on solid colour and are never washed out. Its buttons are 50px tall, with 10px of column colour under them, and the height keeps them clear of the window edge. The same treatment applies to the picker's 開始 footer and the card controls, where the primary action is 50px tall.

### Dictionary settings

Back returns to the reader and keeps the current word.

- 預設顯示形式: one of the 15 forms. Default ます形.
- 顯示平假名注音: a switch. Default on.

### Cards

The title is `練習（n/total）`.

Face:

- The source form, with reading.
- The group tag while 一開始顯示幾類動詞 is on. Default on.
- A line `變成` plus the target form’s name, for example `變成字典形`.

A tap flips the card with a 3D page-turn (`rotateY`, about 300ms). The back shows the target `vol`, its reading, and `chinese`, plus two tags: the target form’s name, for example `字典形`, then the verb-class tag, for example `2類動詞`, in that order. Both answer tags are always there: they ignore 一開始顯示幾類動詞 and 顯示平假名注音, so the class is named on the answer even when the switch is off. Another tap flips back to the face.

The card list is shuffled once when 開始 is pressed; 上一張 and 下一張 then walk that frozen order rather than the lesson and form order. Swipe right-to-left for the next card, the same way the dictionary pages: the card follows the hand and the next one is pushed in from the right edge. Swipe left-to-right for the previous card. The threshold matches the dictionary. A new card opens on its face. Pressing 上一張 or 下一張 runs the same motion as a swipe — the old card slides out to the left for the next card and the new one slides in from the right, mirroring for 上一張 — rather than swapping instantly; under reduced motion the swap is immediate.

The right-hand footer control reads 下一張 › until the last card; on the last card it reads 完成. Pressing 完成 ends the run and shows the completion screen below.

### Card settings

- 一開始顯示幾類動詞
- 顯示平假名注音

### Quiz

The title is `練習（n/total）`.

The prompt shows the source form and its reading. The question is:

- `原型是什麼？` when the target is `dictionary-form`.
- `{name}是什麼？` for every other form, for example `て形是什麼？`.

The field accepts kanji, hiragana, and katakana from the system input method. Backspace sits inside the field on the right. A check button outside the field submits.

Under the field is a keyboard. Build a new one for every item: 5 columns, 5 keys per row, 25 keys.

1. Convert this item’s `japanese` to hiragana. Map katakana to hiragana. Keep `ー` and small kana.
2. Every distinct character of that string appears on a key.
3. Fill the remaining keys at random from hiragana: seion, dakuten, handakuten, small `ゃゅょぁぃぅぇぉっ`, `ん`, and `ー`. Do not repeat a character already placed.
4. Shuffle the full set, then render it.

If the correct reading has more than 25 distinct characters, grow the grid until they fit, still 5 keys per row. In the current data the longest reading is 13 characters, so the grid is 25 keys.

A key appends that character to the field.

Grading applies NFKC, removes whitespace, and converts katakana to hiragana. Either of these is correct:

- The normalized input equals the normalized `japanese`.
- The normalized input equals the normalized `vol`.

A correct answer shows 回答正確, opens the next item immediately, clears the field, and builds a new keyboard.

A wrong answer shows 回答錯誤 and stays on the item, with the input kept. A wrong answer also shows the countdown 再答錯 X 題就顯示答案, where X counts down on that item.

The Nth wrong answer on the same item reveals the correct answer, where N is 錯 X 題就顯示答案: default 3, and 1 to 5. The revealed answer shows both `vol` and `japanese` in a panel that sits on top of the keyboard and covers it. The keyboard and the field then stop accepting input, and 下一題 appears inside that panel. The user presses it to continue; the revealed answer never advances by itself. The earlier misses do not reveal and do not advance.

自動提交答案 defaults to on. While it is on, each append or backspace that already equals an accepted answer grades immediately. While it is off, only the check button grades. After the answer is revealed, nothing grades automatically.

### Quiz settings

- 自動提交答案
- 錯 X 題就顯示答案: 1 to 5, default 3
- 顯示平假名注音

## Completion

The quiz list is shuffled once when 開始 is pressed; 下一題 walks that frozen order. The run ends when the last item resolves: a correct answer on the last item ends it immediately, and a revealed answer ends it when 下一題 is pressed.

The completion screen replaces the study body and shows:

- 恭喜，你已經做完了練習。
- 正確 N 題 and 錯誤 M 題. An item counts as wrong when its answer had to be revealed.
- A simple bar showing the correct percentage, with the percentage beside it. The percentage is correct over resolved items, and 0% when nothing was resolved.
- 錯誤的單詞: one row per missed item with the prompt word, the form that was asked, and the answer that was revealed. This list is left out when nothing was missed.
- 返回主頁. It is 60px tall, the same height in card and quiz mode.

One emoji sits above 恭喜，你已經做完了練習。 It is a single emoji drawn at random, never a row. In quiz mode it comes from the row that matches the score, where the score is floored to its decade: 87% reads the 80% row, an exact 90% reads the 90% row, and 100% reads the 100% row. One emoji is picked at random from that row.

| Score | Emoji |
|---|---|
| 0% | 💀 ☠️ 😭 🥲 🫠 |
| 10% | 😭 😢 😿 🥺 🫥 |
| 20% | 😔 😞 😩 😫 😮‍💨 |
| 30% | 😕 😟 🙁 😬 😓 |
| 40% | 😐 😶 😑 🫤 🤔 |
| 50% | 🙂 😊 😌 🌱 ✨ |
| 60% | 😁 😄 😃 🌟 ⭐ |
| 70% | 🤩 😎 🔥 💪 🚀 |
| 80% | 😍 🥰 💖 💯 🎯 |
| 90% | 🥳 🎊 🎉 🏅 🏆 |
| 100% | 🎉 🥳 🎊 🎆 🎇 🏆 🥇 👑 💐 🎁 ✨ 🌈 🪅 🎈 🤩 🙌 👏 💖 ❤️‍🔥 💯 |

A perfect 100% run also gets a falling-emoji confetti layer behind the panel contents: pieces spread across the width, each with its own delay, duration, size and drift. Under `prefers-reduced-motion: reduce` the confetti is not shown.

Card mode shows the same title, the same single emoji above it and the same 返回主頁, without the score block, and draws that emoji from the bowing figures: 🙇‍♂️, 🙇 or 🙇‍♀️. The dictionary has no completion screen.

The emoji is drawn once, when the completion screen mounts, so a re-render does not re-roll it.

## Readings

`japanese` has no per-character alignment. Split it across `vol` into `<ruby>` with these rules:

1. Treat katakana inside `vol` as hiragana only while aligning. Render katakana as katakana.
2. Walk left to right. A kana character on `vol` (including the long-vowel mark) that equals the next character of the reading is okurigana. Render it alone, with no ruby.
3. A run of kanji takes the reading up to the next okurigana, and that whole slice is the `rt` for the run.
4. When the strings do not align, show the full `japanese` above the whole word. Do not invent a misaligned ruby, and do not fail the screen.

Tests must cover `置く/おく`, `置きます/おきます`, `勉強する/べんきょうする`, `コピーする/コピーする`, `持って行く/もっていく`, and `来ます/きます`.

When the reading switch is off, render `vol` with no ruby.

## Look and motion

The wireframes say which pieces exist. Do not copy their colors or boxes.

- The page background is a slow gradient from indigo to warm amber, with a faint grain. The column is warm off-white, large radius, light shadow. At viewport widths of 550px or less the column drops its radius, shadow and side margins, fills the browser, and the background becomes the plain column colour.
- Use the system stack: `Hiragino Sans`, `Noto Sans TC`, `Noto Sans JP`, `sans-serif`. Do not download a CJK webfont.
- The word is large. The reading is small and sits above the kanji. Controls are 36px tall with a 10px radius, so they read as buttons rather than pills: that covers `.button`, the lesson and form chips, the 到 chips, the 選擇 buttons. Settings rows are 52px so each row can hold its switch comfortably. The quiz keyboard keys are 48px for typing. The home screen's three entries are 60px, the picker's 開始 and the reader and card footer controls are 50px, and 返回主頁 on the completion screens is 60px.
- Every screen's top bar — the back arrow and the title — is pinned to the top of the viewport, on the column colour, above the scrolling content. This is the same treatment the dictionary reader has.
- On every screen except home, the extra bottom height is gone: content ends 10px above the bottom of the column, and screens with a pinned footer carry their own bottom space instead, so the gap is the same whether the footer is pinned mid-page or resting at the end. The reader's 上一個 / 下一個, the card controls, settings and quiz all keep 10px. The picker's 開始 is the one exception at 20px, because that is where the primary action on that screen sits: its fade band stays above the button and 20px of solid column colour sits under it.
- A pressed button scales down slightly. Pinned footers keep a transparent fade, but the fade band sits above the controls so the buttons stay solid and fully visible. The reader pages with a flat horizontal slide that follows the finger: no rotation, no tilt, no fade and no depth, so the incoming page is pushed in from the edge instead of cross-dissolving. Screen changes take about 220ms. A card follows the gesture, then springs back or leaves. A right-to-left swipe slides the outgoing card out to the left and brings the next card in from the right edge; a left-to-right swipe mirrors it. A tapped card turns over in 3D (`rotateY`, about 300ms). 回答正確 and 回答錯誤 slide in from the top and leave after about 1.6 seconds. A revealed answer stays on the question itself. The toast is not the only place that answer exists.
- The page never scrolls sideways: no horizontal scrollbar appears in any screen. Paging motion is clipped by its own container, so a card that travels past the column edge is cut off rather than widening the page.
- Under `prefers-reduced-motion: reduce`, the gradient is still, a swipe changes the item directly, card flips are instant, and screen changes are a short fade.

## Saved settings

`localStorage` key `katsuyou-settings` stores:

- Each mode’s lesson list.
- 從 and 到 for cards and for the quiz.
- The dictionary’s default form.
- Three reading switches, one each for dictionary, cards, and quiz.
- The card verb-class switch.
- Quiz auto-submit.
- Quiz 錯 X 題就顯示答案.

A missing field uses the default above. Invalid JSON resets the whole object to the defaults.

## Build

`npm run build` writes to `output/`. `base` is `/game-japanese-katsuyou-basic/`
(the repository name), so the build runs as a GitHub Pages project site under
that subpath. `npm run dev` and `npm run preview` serve the same subpath
(`/` redirects to it). Renaming the repository means changing that one constant
in `vite.config.js` plus `SITE_BASE` in `scripts/browser-check.mjs`. Asset and
dictionary URLs are prefixed with the base; `dict/lesson_N.json` is resolved
against `document.baseURI`, so it follows the base automatically.

Do not commit `output/`. Publish the contents of that directory at the root of
the Pages branch or folder; Pages adds the repository subpath itself.
