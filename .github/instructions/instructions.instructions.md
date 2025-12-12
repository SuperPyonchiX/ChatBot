---
description: 'Guidelines for creating high-quality custom instruction files for GitHub Copilot'
applyTo: '**/*.instructions.md'
---

# カスタムインストラクションファイルガイドライン

GitHub Copilotがドメイン固有のコードを生成し、プロジェクトの規約に従うための、効果的で保守可能なカスタムインストラクションファイルを作成するための手順。

## プロジェクトコンテキスト

- 対象読者: ドメイン固有のコードを扱う開発者とGitHub Copilot
- ファイル形式: YAMLフロントマター付きMarkdown
- ファイル命名規則: ハイフン区切りの小文字（例: `react-best-practices.instructions.md`）
- 配置場所: `.github/instructions/` ディレクトリ
- 目的: コード生成、レビュー、ドキュメント作成のためのコンテキストに応じたガイダンスを提供

## 必須フロントマター

すべてのインストラクションファイルには、以下のフィールドを含むYAMLフロントマターが必要です：

```yaml
---
description: 'Brief description of the instruction purpose and scope'
applyTo: 'glob pattern for target files (e.g., **/*.ts, **/*.py)'
---
```

### フロントマターガイドライン

- **description**: シングルクォートで囲まれた文字列、1〜500文字、目的を明確に記述
- **applyTo**: これらのインストラクションが適用されるファイルを指定するglobパターン
  - 単一パターン: `'**/*.ts'`
  - 複数パターン: `'**/*.ts, **/*.tsx, **/*.js'`
  - 特定ファイル: `'src/**/*.py'`
  - すべてのファイル: `'**'`

## ファイル構造

適切に構造化されたインストラクションファイルには、以下のセクションを含める必要があります：

### 1. タイトルと概要

- `#` 見出しを使用した明確で説明的なタイトル
- 目的と範囲を説明する簡単な導入
- オプション: 主要な技術とバージョンを含むプロジェクトコンテキストセクション

### 2. コアセクション

ドメインに基づいて論理的なセクションにコンテンツを整理：

- **General Instructions（一般的な指示）**: 高レベルのガイドラインと原則
- **Best Practices（ベストプラクティス）**: 推奨されるパターンとアプローチ
- **Code Standards（コード標準）**: 命名規則、フォーマット、スタイルルール
- **Architecture/Structure（アーキテクチャ/構造）**: プロジェクトの構成とデザインパターン
- **Common Patterns（一般的なパターン）**: 頻繁に使用される実装
- **Security（セキュリティ）**: セキュリティに関する考慮事項（該当する場合）
- **Performance（パフォーマンス）**: 最適化ガイドライン（該当する場合）
- **Testing（テスト）**: テスト基準とアプローチ（該当する場合）

### 3. 例とコードスニペット

明確なラベル付きの具体的な例を提供：

```markdown
### Good Example
\`\`\`language
// Recommended approach
code example here
\`\`\`

### Bad Example
\`\`\`language
// Avoid this pattern
code example here
\`\`\`
```

### 4. 検証と確認（オプションだが推奨）

- コードを検証するためのビルドコマンド
- リントとフォーマットツール
- テスト要件
- 検証手順

## コンテンツガイドライン

### 記述スタイル

- 明確で簡潔な言語を使用
- 命令形で記述（「使用する」「実装する」「避ける」）
- 具体的で実行可能な内容にする
- 「すべき」「かもしれない」「おそらく」などの曖昧な用語を避ける
- 読みやすさのために箇条書きとリストを使用
- セクションを集中的でスキャン可能に保つ

### ベストプラクティス

- **具体的に記述する**: 抽象的な概念ではなく具体的な例を提供
- **理由を示す**: 価値を追加する場合は、推奨事項の背後にある理由を説明
- **テーブルを使用する**: オプションの比較、ルールのリスト、パターンの表示に使用
- **例を含める**: 説明よりも実際のコードスニペットの方が効果的
- **最新の情報を保つ**: 現在のバージョンとベストプラクティスを参照
- **リソースをリンクする**: 公式ドキュメントと権威あるソースを含める

### 含めるべき一般的なパターン

1. **命名規則**: 変数、関数、クラス、ファイルの命名方法
2. **コード構成**: ファイル構造、モジュール構成、インポート順序
3. **エラー処理**: 推奨されるエラー処理パターン
4. **依存関係**: 依存関係の管理と文書化の方法
5. **コメントとドキュメント**: コードを文書化する時期と方法
6. **バージョン情報**: 対象となる言語/フレームワークのバージョン

## 従うべきパターン

### 箇条書きとリスト

```markdown
## セキュリティのベストプラクティス

- 処理前に必ずユーザー入力を検証する
- SQLインジェクションを防ぐためにパラメータ化されたクエリを使用
- シークレットは環境変数に保存し、コードには決して含めない
- 適切な認証と認可を実装
- 本番環境のすべてのエンドポイントでHTTPSを有効化
```

### 構造化された情報のテーブル

```markdown
## よくある問題

| 問題               | 解決策                   | 例                                |
| ------------------ | ------------------------ | --------------------------------- |
| マジックナンバー   | 名前付き定数を使用       | `const MAX_RETRIES = 3`           |
| 深いネスト         | 関数を抽出               | ネストされたif文をリファクタリング |
| ハードコードされた値 | 設定を使用               | API URLを設定に保存               |
```

### コード比較

```markdown
### 良い例 - TypeScriptインターフェースの使用
\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): User {
  // Implementation
}
\`\`\`

### 悪い例 - any型の使用
\`\`\`typescript
function getUser(id: any): any {
  // 型安全性が失われる
}
\`\`\`
```

### 条件付きガイダンス

```markdown
## フレームワークの選択

- **小規模プロジェクトの場合**: Minimal APIアプローチを使用
- **大規模プロジェクトの場合**: 明確な分離を持つコントローラーベースのアーキテクチャを使用
- **マイクロサービスの場合**: ドメイン駆動設計パターンを検討
```

## 避けるべきパターン

- **過度に冗長な説明**: 簡潔でスキャン可能に保つ
- **古い情報**: 常に現在のバージョンとプラクティスを参照
- **曖昧なガイドライン**: 何をするか、または避けるべきかを具体的に記述
- **例の欠如**: 具体的なコード例のない抽象的なルール
- **矛盾したアドバイス**: ファイル全体で一貫性を確保
- **ドキュメントからのコピー＆ペースト**: 要約とコンテキスト化による価値を追加

## インストラクションのテスト

インストラクションファイルを確定する前に：

1. **Copilotでテスト**: VS Codeで実際のプロンプトを使用してインストラクションを試す
2. **例の検証**: コード例が正しく、エラーなく実行されることを確認
3. **Globパターンの確認**: `applyTo`パターンが意図したファイルと一致することを確認

## 例の構造

新しいインストラクションファイルの最小限の構造例：

```markdown
---
description: 'Brief description of purpose'
applyTo: '**/*.ext'
---

# Technology Name Development

Brief introduction and context.

## General Instructions

- High-level guideline 1
- High-level guideline 2

## Best Practices

- Specific practice 1
- Specific practice 2

## Code Standards

### Naming Conventions
- Rule 1
- Rule 2

### File Organization
- Structure 1
- Structure 2

## Common Patterns

### Pattern 1
Description and example

\`\`\`language
code example
\`\`\`

### Pattern 2
Description and example

## Validation

- Build command: `command to verify`
- Linting: `command to lint`
- Testing: `command to test`
```

## メンテナンス

- 依存関係やフレームワークが更新されたら、インストラクションをレビュー
- 現在のベストプラクティスを反映するように例を更新
- 古いパターンや非推奨の機能を削除
- コミュニティで新しいパターンが出現したら追加
- プロジェクト構造の変更に応じてglobパターンを正確に保つ

## 追加リソース

- [Custom Instructions Documentation](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Awesome Copilot Instructions](https://github.com/github/awesome-copilot/tree/main/instructions)
