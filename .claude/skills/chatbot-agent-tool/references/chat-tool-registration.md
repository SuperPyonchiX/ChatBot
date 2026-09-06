# チャットツール（Function Calling 系）の追加

通常チャットで LLM が呼ぶツール。`js/core/tools/` 配下で、エージェントツールとは別のレジストリ。既存は `generate_powerpoint` `process_excel` `render_canvas` の3つ。

## 構成

| ファイル | 役割 |
| --- | --- |
| `js/core/tools/toolRegistry.js` | `ToolRegistry.register({name, description, parameters, executor})` で保持 |
| `js/core/tools/toolSchemaConverter.js` | 登録済みスキーマを OpenAI / Claude / Gemini 各形式に変換 |
| `js/core/tools/toolExecutor.js` | LLM の tool_call を受けて `executor.execute(params)` を呼ぶ |
| `js/core/tools/toolManager.js` | `#registerBuiltInTools()` でスキーマ定義を直書きし、`CONFIG.TOOLS.ENABLED` と `COMPATIBLE_MODELS` で有効判定 |
| `js/core/tools/executors/ToolExecutorBase.js` | 基底クラス。`validateParams()` `createFileResult()` `createImageResult()` を提供 |
| `js/components/toolUI/` | 進捗表示・プレビュー・ダウンロード |

## 手順

1. **executor クラス**: `js/core/tools/executors/{Xxx}.js`。`ToolExecutorBase` を継承し、シングルトン定型で `execute(params)` を実装する。`CanvasRenderer.js` が最も短い手本。

   ```javascript
   class {Xxx} extends ToolExecutorBase {
       static #instance = null;
       constructor() {
           super();
           if ({Xxx}.#instance) { return {Xxx}.#instance; }
           {Xxx}.#instance = this;
       }
       static get getInstance() {
           if (!{Xxx}.#instance) { {Xxx}.#instance = new {Xxx}(); }
           return {Xxx}.#instance;
       }
       async execute(params) {
           this.validateParams(params, ['必須キー']);
           // 生成処理
           return this.createFileResult(blob, filename, mimeType);
       }
   }
   window.{Xxx} = {Xxx};
   ```

   戻り値はファイルなら `createFileResult()`、画像なら `createImageResult()`。それ以外はプレーンなオブジェクトでよいが、`toolPreview.js` が `type: 'file' | 'image'` を見てプレビューを出す。

2. **スキーマ登録**: `toolManager.js` の `#registerBuiltInTools()` に、既存と同じ形で追加

   ```javascript
   if (typeof {Xxx} !== 'undefined') {
       registry.register({
           name: '{snake_name}',
           description: '...',
           parameters: { type: 'object', properties: {...}, required: [...] },
           executor: {Xxx}.getInstance
       });
   }
   ```

3. **config.js**: `TOOLS.ENABLED` に `'{snake_name}'` を追加。ツール固有の上限値は `TOOLS.{XXX}` として追加（`TOOLS.POWERPOINT` などと同じ並び）。

4. **index.html**: `<!-- ツール機能関連のファイル -->` ブロック内、`ToolExecutorBase.js` の後・`toolManager.js` の前に `<script>` を足す。

5. 外部ライブラリ（pptxgenjs, SheetJS など）が必要なら `index.html` の `<head>` にある CDN `<script>` の並びに追加する。

## 動作確認

1. `CONFIG.TOOLS.COMPATIBLE_MODELS` に含まれるモデルを選ぶ
2. ツールを誘発する依頼をして、`toolProgress` の進捗 UI が出る
3. 成果物が `toolPreview` に表示され、ダウンロードできる
4. コンソールに `[ToolExecutor]` `[ToolManager]` のエラーが無い
