# 大家の日本語 · 轉型練習

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)
![Vite 7](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/tests-234%20passing-2ea44f)
![Static site](https://img.shields.io/badge/deploy-static%20site-4a3f9f)

> 朗讀功能、下載流程優化與 UI 優化列在 [`docs/roadmap.md`](docs/roadmap.md) 的
> backlog（尚未實作，實作前先寫進 `docs/spec.md`）。

手機優先的日語動詞轉型（活用）練習網站。涵蓋《大家的日本語》初級 1–50 課、
386 個單詞、15 種變化形，提供三種學習方式：**字典**、**翻卡學習**、**測驗**。

純靜態單頁應用（Vue 3 + Vite）。沒有後端、沒有模型呼叫；字典在瀏覽器端以
SHA-256 校驗後快取於 IndexedDB，重新開啟時只重新驗證、不重新下載。

---

## 功能

| 模式 | 內容 |
|---|---|
| **字典** | 一個單詞一頁，依序列出全部 15 種變化形：形式名稱、單詞、注音（ruby 對齊）、中文解釋、3 組例句。例句中屬於該形的單詞以紫色標示，方便對照。手機版（≤550px）可左右滑動翻頁，桌機版則用底部按鈕翻頁以便選取文字；另有「預設顯示形式」與「顯示平假名注音」設定。 |
| **翻卡學習** | 正面顯示來源形與「變成＿＿形」，點擊以 3D 翻頁顯示答案（目標形、讀音、中文解釋、形式與動詞類別標籤）。滑動切換卡片，新卡自動回到正面。 |
| **測驗** | 題目顯示來源形，作答區提供依「正確讀音」自動產生的 25 鍵假名鍵盤（5×5），其餘按鍵隨機補齊。答對立即進下一題；答錯累計 3 次顯示答案，按「下一題」才前進（不會自動跳題）。 |

其他行為：

- **每個模式各自記住選擇**：課程勾選、`從`／`到` 變化形、注音開關、翻卡類別開關、
  自動提交答案、答錯幾次顯示答案，全部存在 `localStorage` 的
  `katsuyou-settings`，重新載入後保留。
- **資料完整性**：50 個課程檔以 SHA-256 manifest 校驗；首次載入逐課下載、驗證、
  寫入 IndexedDB；再次開啟只重新計算雜湊，不重複下載。
- **手機優先的版面**：≤550px 時介面滿版、背景收斂為單色；>550px 時內容置中於
  480px 卡片欄並顯示漸層背景。翻頁是水平平移，卡片翻轉為 `rotateY`。
- **自繪滾動軸**：頁面隱藏瀏覽器原生 Y 軸，改在卡片欄右緣畫一條 4px 圓角細條，
  只在捲動時淡入、停止約 1 秒淡出；內部下拉選單仍用原生軸。
- **翻卡完成**：在最後一張往左滑就等於按「完成」，直接顯示完成面板。
- **翻卡邊界**：第一張往右拖有阻尼，卡片跟手指走約 1/3（上限 40px），放手後
  約 140ms 回位，不會切到「不存在的前一張」；最後一張往左滑才是完成。字典閱讀
  的第一個單詞維持不動。
- **載入頁**：顯示站名三行標題（`大家の日本語`／`轉型練習`／`涵蓋初級 1 – 50 課的單詞`）
  與 `Loading ...` 進度條；底部只有 `Build with ❤ by Mane`（可開啟 About 面板），
  沒有 BUG 回報那一行。載入失敗（`載入失敗（lesson N）`）時標題與底部都還在。
- **手機上手感穩定**：頁面固定在原始比例，雙擊與兩指都不會放大；翻頁與翻卡
  的進出場速度相接（離開加速、進場減速），交接時兩邊都已完全離屏，不會在邊緣
  停住再彈進來；未達 72px 的拖曳約 140ms 回位，不再長時間回彈。
- **無障礙與動效偏好**：尊重 `prefers-reduced-motion: reduce`（背景靜止、翻頁與
  翻卡即時完成、畫面切換改為短淡入）。
- **空課程處理**：第 1、3、8、12 課沒有單詞，選單中顯示為灰色且不可選取。

## 快速開始

需求：Node.js **20.19+** 或 **22.12+**（Vite 7 的最低版本）。

```bash
git clone git@github.com:manesec-web/game-japanese-katsuyou-basic.git
cd game-japanese-katsuyou-basic
npm install
npm run dev        # http://localhost:5173/game-japanese-katsuyou-basic/
```

開發伺服器會把 `vol/lesson_N.json` 以 `/game-japanese-katsuyou-basic/dict/lesson_N.json`
提供給瀏覽器（`base` 已固定為 GitHub Pages 的子路徑）；
`npm run dev` 前會先執行 manifest 校驗。

建置與本機預覽：

```bash
npm run build      # 輸出到 output/
npm run preview    # 預覽建置結果（http://localhost:4173/game-japanese-katsuyou-basic/）
```

## 常用指令

| 指令 | 作用 |
|---|---|
| `npm run dev` | 啟動 Vite 開發伺服器（附字典中介層） |
| `npm run build` | 建置靜態網站到 `output/`，並複製 50 個課程檔到 `output/dict/` |
| `npm run preview` | 以 Vite 預覽 `output/` |
| `npm test` | 執行 Vitest 單元測試（24 個檔案、234 個測試） |
| `npm run test:watch` | 監看模式 |
| `node scripts/write-sha256.mjs` | 重新產生 `src/data/dict-manifest.json` |
| `node scripts/write-sha256.mjs --check` | 校驗 manifest 與 `vol/` 位元組是否一致（不一致則非 0 結束） |
| `node scripts/browser-check.mjs` | 以 headless Chromium 對建置結果做端到端檢查（需先 `npm run build`） |

`pretest` / `prebuild` / `predev` 都會先跑 manifest 校驗，所以雜湊不符時建置與測試
會直接失敗，而不是帶著壞資料上線。

`browser-check.mjs` 的環境變數：`PORT`（預覽埠，預設 5199）、`CHROMIUM_PATH`
（Chromium 執行檔路徑）、`SHOT_DIR`（截圖目錄）、`--screenshots` 開啟截圖。
它會自行啟動 `vite preview`，結束後關閉。

## 專案結構

```text
vol/                        字典來源：lesson_1.json … lesson_50.json（唯讀）
docs/                       產品規格、架構、進度、變更紀錄、本機伺服說明
docs/screenshot-draft/      初期的線框稿（wireframe）
scripts/write-sha256.mjs    產生／校驗 SHA-256 manifest
scripts/browser-check.mjs   端到端瀏覽器檢查
src/main.js                 入口：建 store、boot、掛載 Vue
src/engine/                 dispatch 與 session（不依賴框架，可在 Node 測試）
src/commands/               每個功能一個模組，各自匯出 specs()
src/dict/                   形式定義、雜湊、ruby 對齊、鍵盤與批改、設定規則
src/study/                  題目清單、亂序、例句標示、結算
src/storage/                IndexedDB 字典快取、localStorage 設定
src/ui/                     store 轉接、boot、手勢、動效偏好、輸入法編輯
src/views/                 各畫面（樣板與樣式，不放規則）
src/components/             共用元件（站名標題、Build with 頁腳、About 面板、ruby 單詞、完成面板、滾動軸）
src/styles/app.css          設計變數與版面
src/data/dict-manifest.json 產生的 manifest（已提交）
output/                     建置輸出（不提交）
```

## 資料模型

每個課程檔的形狀：

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
          "sentence": [{ "japanese": "……", "chinese": "……" }]
        }
      }
    ]
  }
}
```

每個動詞物件固定包含以下 15 個鍵，順序即畫面與卡片順序：

| # | 鍵 | 畫面名稱 |
|---|---|---|
| 1 | `dictionary-form` | 字典形 |
| 2 | `masu-form` | ます形 |
| 3 | `masu-form-negative` | ません形 |
| 4 | `masu-form-past` | ました形 |
| 5 | `masu-form-past-negative` | ませんでした形 |
| 6 | `nai-form` | ない形 |
| 7 | `ta-form` | た形 |
| 8 | `nakatta-form` | なかった形 |
| 9 | `te-form` | て形 |
| 10 | `potential-form` | 可能形 |
| 11 | `volitional-form` | 意向形 |
| 12 | `imperative-form` | 命令形 |
| 13 | `conditional-form` | ば形 |
| 14 | `passive-form` | 受身形 |
| 15 | `causative-form` | 使役形 |

每個形式都帶 `vol`（詞形）、`group`（動詞類別）、`chinese`（中文解釋）、
`japanese`（讀音）與 `sentence`（三組日中文對照例句）。同一個動詞的 15 個形式
共用同一個 `group`。

| `group` | 標籤 |
|---|---|
| `0` | 例外 |
| `1` | 1類動詞 |
| `2` | 2類動詞 |
| `3` | 3類動詞 |

目前資料：50 課、46 課有單詞（1、3、8、12 課為空）、386 個單詞、5,790 筆形式。

## 架構重點

- **三層**：`engine`（命令註冊與 session，純 JS）→ `commands`（行為）→
  `views`（只渲染與呼叫 `dispatch`）。`.vue` 只放樣板與樣式，行為一律在 `.js`。
- **每個使用者動作都是命令**：`{ id, params, enabled, run }`，畫面與測試走同一個
  `dispatch(session, id, params)`，回傳 `{ ok: true, result }` 或
  `{ ok: false, error }`。未知命令、缺參數、`enabled === false`、`run` 拋錯都不會
  冒出未捕捉例外。
- **字典交付**：建置時把 `vol/*.json` 複製到 `output/dict/`，manifest 隨站台一起
  發布；瀏覽器向同源取得檔案，以 Web Crypto 計算 SHA-256 比對，再寫入 IndexedDB
  （資料庫 `katsuyou-dict`、物件倉庫 `lessons`，一課一筆）。
- **設定持久化**：`katsuyou-settings`；缺欄位套用預設，JSON 壞掉則整份回到預設。
- **測試策略**：規則抽成純函式（鍵盤產生、批改、ruby 對齊、滑動門檻、亂序、結算、
  標籤），在 Node 下以 Vitest 驗證；瀏覽器 API 以注入的假物件測試，IndexedDB 介面
  另以 `fake-indexeddb` 測。畫面層由 `scripts/browser-check.mjs` 以 headless
  Chromium 走查。

更完整的命令清單、錯誤碼、檔案對應與設計決策見
[`docs/architecture.md`](docs/architecture.md)。

## 測試與驗證

```bash
npm test                                # 24 檔 / 234 個單元測試
npm run build                           # output/index.html + output/dict/（50 檔）
node scripts/write-sha256.mjs --check   # manifest 一致
node scripts/browser-check.mjs          # 411 項端到端檢查（390×844 為主；測驗題目
                                        # 由亂數種子決定，假名按鍵檢查數會上下浮動 1 項）
```

端到端檢查涵蓋：載入（正常／失敗／重試、標題與 Build with 底部）、首頁、三種模式的選課、字典閱讀、
設定、翻卡（含第一張的阻尼回彈）、測驗、完成畫面、減少動效、550px 斷點、桌面不啟用手勢翻頁、
IndexedDB 快取與重新載入重用。

未涵蓋：真實 iOS／Android 裝置、真實輸入法（合成事件以純函式測試）、
GitHub Pages 子路徑部署、視覺外觀的人工檢視。

## 本機伺服注意事項

`crypto.subtle` 只在安全來源可用（`https://`、`http://localhost`、
`http://127.0.0.1`）。若用 `http://192.168.x.x` 或 `file://` 開啟，字典雜湊會失敗，
載入畫面會停在 `載入失敗（lesson 1）`。請用 `npm run dev`、`npm run preview`，
或把 `output/` 掛在 localhost 的 `game-japanese-katsuyou-basic/` 子路徑下。詳細排查見
[`docs/serving.md`](docs/serving.md)。

## 部署

`npm run build` 產生 `output/`（`base: '/game-japanese-katsuyou-basic/'`，對應 repo 名稱）。
把該目錄的內容發布到 GitHub Pages（repo 的 Pages 分支或資料夾根目錄），Pages 會再加上
子路徑，因此網址是 `https://<user>.github.io/game-japanese-katsuyou-basic/`；`output/` 不進版控。建議以 GitHub Actions 或
`gh-pages` 分支發佈建置產物，並確認 Pages 的來源設定與之作法一致。GitHub Pages
走 HTTPS，因此 SHA-256 與 IndexedDB 都能正常運作。

## 瀏覽器支援

以 Chromium（headless）驗證。功能依賴 IndexedDB、Web Crypto、`<ruby>`、CSS sticky
與 `prefers-reduced-motion`，現代 Chrome／Edge／Safari／Firefox 皆具備；Safari 與
Firefox 尚未實機驗證。

## 文件

| 文件 | 內容 |
|---|---|
| [`docs/spec.md`](docs/spec.md) | 產品行為的權威規格（畫面、文案、手勢、設定、完成畫面） |
| [`docs/architecture.md`](docs/architecture.md) | 命令契約、session、檔案對應、字典交付、測試 |
| [`docs/progress.md`](docs/progress.md) | 目前狀態、已執行的驗證、已知限制 |
| [`docs/roadmap.md`](docs/roadmap.md) | 任務板與各次修訂的驗收紀錄 |
| [`docs/changelog.md`](docs/changelog.md) | 依日期記錄的變更與原因 |
| [`docs/serving.md`](docs/serving.md) | 本機伺服與載入失敗排查 |

## 回報問題

- 送出 issue：<https://github.com/manesec-web/game-japanese-katsuyou-basic/issues>
- 或來信：<mane@manesec.com>

字典資料出自《大家的日本語》，僅供學習使用。

Build with love by Mane.