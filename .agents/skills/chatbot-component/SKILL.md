---
name: chatbot-component
description: ChatBotプロジェクトにUIコンポーネントやモーダルを追加する工程スキル。`js/components/{機能}/` または `js/modals/{機能}/{機能}Modal.js` のシングルトンクラス作成、`css/components/{カテゴリ}/` へのCSS追加とCSS変数の使用、index.html への `<link>` / `<script>` 追加位置、イベント登録パターンを扱う。「新しい画面を作って」「モーダルを追加して」「サイドバーにボタンを足して」「このCSSをどこに置けばいい」で使う。AI API の追加は chatbot-api、AI が呼ぶツールは chatbot-tool。
---

# UI コンポーネント追加

## 配置先

| 種別 | JS | CSS |
| --- | --- | --- |
| 画面部品 | `app/public/js/components/{機能}/{機能}.js` | `app/public/css/components/{カテゴリ}/{名前}.css` |
| モーダル | `app/public/js/modals/{機能}/{機能}Modal.js` | 同上（既存は `modals/modals.css` に共通、機能固有は `components/{機能}/` に別ファイル） |

## 手順

1. **クラス**: シングルトン定型（AGENTS.md の規約）で作り、`initialize()` でイベント登録する。雛形は `references/component-template.md`。末尾で `window.Xxx = Xxx;`
2. **HTML**: `app/public/index.html` の該当位置に要素を追加。モーダルは既存の `.modal` 構造（`modals/modals.css`）に合わせる
3. **CSS**: `references/css-structure.md` の配置ルールと CSS 変数を使う。色・余白・角丸・フォントサイズは `css/base/variables.css` の変数のみ
4. **index.html への読み込み**
   - `<link>`: `<!-- Components CSS -->` の並びに追加。`css/tools.css` が最後
   - `<script>`: 画面部品は `<!-- コンポーネント関連のファイル -->`、モーダルは `<!-- モーダル関連のファイル -->` ブロック内。依存するクラスより後ろに置く
5. **イベント**: `references/event-handling.md`。グローバルな開閉は `js/modals/modalHandlers.js`、DOM 参照は `js/core/domElements.js` / `window.Elements` を経由する
6. **設定値**: 幅・件数上限などは `window.CONFIG.UI` 配下に追加する

## 手本

| 用途 | ファイル |
| --- | --- |
| 動的生成するモーダル（最新） | `js/modals/toolSettings/toolSettingsModal.js`, `js/components/tools/customToolEditor.js` |
| 静的 HTML + `UIUtils.toggleModal` のモーダル | `js/modals/workspace/workspaceModal.js` |
| チャット表示 | `js/components/chat/chatRenderer.js`, `chatUI.js` |
| サイドバー | `js/components/sidebar/sidebar.js` |
| 単純なフォームモーダル | `js/modals/renameChat/renameChatModal.js` |
| リサイズ可能なパネル | `js/components/artifact/artifactPanel.js`, `js/core/dragManager.js` |

## 動作確認

1. `cd app && npm start` → ブラウザコンソールに `Uncaught ReferenceError` が無い（読み込み順の誤り）
2. 追加した要素が表示され、ダーク基調の既存画面と色が揃っている
3. モーダルは開閉・Esc・オーバーレイクリックで閉じる
4. ウィンドウ幅を狭めてレイアウトが崩れない

## 参照ファイル

| ファイル | 読むタイミング |
| --- | --- |
| `references/component-template.md` | 手順1でクラスを書くとき |
| `references/css-structure.md` | 手順3で CSS を書くとき |
| `references/event-handling.md` | 手順5でイベントを結ぶとき |
