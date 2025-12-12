---
description: 'ユーザー目的から2つのタスク自動化ファイル(プロンプト+エージェントのペア)を生成'
agent: 'generate-customization-md'
argument-hint: '実現したい目的を詳しく説明してください'
tools: ['vscode', 'edit', 'read', 'search', 'web', 'todo']
---

# タスク自動化ペア生成

ユーザーの目的を受け取り、以下の2つのファイルをペアで生成します:

1. **プロンプトファイル** (.prompt.md): タスク実行レシピ
2. **エージェントファイル** (.agent.md): 対話的な専門家

## 📥 必須入力

- `${input:userGoal:実現したい目的を詳しく説明してください}`: 実現したい目的の詳細
  - 対象言語/フレームワーク
  - 具体的なユースケース
  - 技術的制約や要件

### 利用可能な変数

- `${input:variableName:placeholder}`: ユーザー入力を要求
- `${selection}`: 現在のエディタ選択範囲
- `${file}`: 現在のファイルパス
- `${workspaceFolder}`: ワークスペースのルートパス

## 📋 実行ステップ

### ステップ 1: 目的分析とリサーチ

#### 1.1 サブエージェントによる公式ガイド調査(推奨)
```markdown
#tool:runSubagent を使用して以下を調査:
- 最新の公式ドキュメント仕様
- 類似のプロンプト/エージェントの実装例
- 対象技術スタックのベストプラクティス
```

**メリット**: コンテキストウィンドウを汚染せず、集中的なリサーチが可能

#### 1.2 目的の分析
1. ユーザー目的 `${input:userGoal}` を分析
2. 対象技術スタック(言語/フレームワーク)を特定
3. 各ファイルの役割を決定:
   - **プロンプト**: 具体的なタスク実行手順
   - **エージェント**: 対話的な専門知識の提供

### ステップ 2: ファイル生成

#### 2.1 プロンプトファイル生成
**ファイル**: `.github/prompts/[ベース名].prompt.md`

**フロントマター要件**:
```yaml
---
description: '具体的なタスクの説明(シングルクォート必須)'
agent: '[ベース名]'  # エージェントファイル名と一致
model: 'claude-sonnet-4.5'  # 推奨
argument-hint: 'ユーザーへの入力ヒント'  # オプション
tools: ['vscode', 'edit', 'read']  # 最小権限の原則
---
```

**命名規則**: `generate-*`, `analyze-*`, `refactor-*`, `optimize-*`

**ツール優先順位** (重要):
1. **プロンプトの`tools`**: タスク実行時に使用
2. **エージェントの`tools`**: 対話時に使用
3. **デフォルトツール**: 上記が未指定の場合

#### 2.2 エージェントファイル生成
**ファイル**: `.github/agents/[ベース名].agent.md`

**フロントマター要件**:
```yaml
---
description: 'エージェントの役割と専門性(シングルクォート必須)'
tools: ['vscode', 'edit', 'execute', 'read', 'search', 'web']
model: 'claude-sonnet-4.5'  # 推奨
target: 'vscode'  # オプション: 'vscode' | 'github-copilot'
handoffs:  # 推奨: エージェント連鎖
  - label: '次のステップへ'
    agent: 'next-agent'
    prompt: '続きを実行してください'
    send: false  # ユーザー確認を推奨
---
```

**重要事項**:
- **プロンプトと同じベース名を使用**
- ファイル名はプロンプトの `agent` と一致
- ペルソナと専門性を明確に定義
- `handoffs`: 他エージェントへの遷移を定義(推奨)

### ステップ 3: 統合と検証
1. プロンプトとエージェント間の連携を確認
2. 一貫した用語を使用
3. 必要に応じてInstructionsへの参照を含める

## �️ ツール戦略

### フェーズ別推奨ツールセット

#### リサーチフェーズ
```yaml
tools: ['read', 'search', 'web', 'fetch/*', 'agents']
```
- 情報収集に特化
- 編集権限を持たない(最小権限の原則)

#### 設計フェーズ
```yaml
tools: ['vscode', 'read', 'search', 'todo']
```
- ファイル構造の把握
- タスク計画の立案

#### 実装フェーズ
```yaml
tools: ['vscode', 'edit', 'read', 'search']
```
- ファイル作成・編集
- コンテキスト収集

#### 検証フェーズ
```yaml
tools: ['read', 'search', 'execute', 'agents']
```
- 品質チェック
- テスト実行

### ツール優先順位(再掲)
1. **プロンプトの`tools`** → タスク実行時
2. **エージェントの`tools`** → 対話時
3. **デフォルトツール** → 未指定時

## �📂 ファイル配置

```
.github/
├── agents/
│   └── [descriptive-name].agent.md
└── prompts/
    └── [descriptive-name].prompt.md
```

**注意**: Instructionsファイルは汎用的なコーディング標準なので、タスク固有のペアとは別に慎重に設計してください。

## ✅ 成功基準

### 必須項目
- [ ] 2ファイルすべて生成済み(プロンプト+エージェント)
- [ ] フロントマター完全
  - プロンプト: `description`, `agent`, `model`(推奨), `tools`
  - エージェント: `description`, `tools`, `model`(推奨)
- [ ] ケバブケース命名
- [ ] プロンプトの`agent`とエージェントファイル名が一致
- [ ] 役割が明確で重複なし
- [ ] Instructionsファイルは生成していない

### 推奨項目
- [ ] エージェントに`handoffs`定義あり(2-3ステップ)
- [ ] サブエージェント活用の提案あり
- [ ] ツール戦略が明確(フェーズ別)
- [ ] 変数システムの活用例あり
- [ ] 公式ドキュメントへのリンクあり

## 📚 参考

### 公式ドキュメント
- [Prompt Files](https://code.visualstudio.com/docs/copilot/customization/prompt-files)
- [Custom Instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [Subagents (実験的)](https://code.visualstudio.com/docs/copilot/chat/chat-sessions#_subagents)

### 内部ガイドライン
- [プロンプトファイルガイドライン](../instructions/prompt.instructions.md)
- [Instructionsファイルガイドライン](../instructions/instructions.instructions.md)
- [Markdownガイドライン](../instructions/markdown.instructions.md)

## 💡 使用例

### 例1: REST API開発の効率化

**入力**: "REST APIの開発を効率化したい"

**生成ファイル**:
1. `generate-api-endpoints.prompt.md` - APIエンドポイント生成タスク
2. `generate-api-endpoints.agent.md` - API設計の専門家

**フロントマター例**:
```yaml
# プロンプトファイル
---
description: 'RESTful APIエンドポイントを自動生成'
agent: 'generate-api-endpoints'
model: 'claude-sonnet-4.5'
tools: ['vscode', 'edit', 'read', 'search']
---

# エージェントファイル
---
description: 'RESTful API設計の専門家'
tools: ['vscode', 'edit', 'read', 'search', 'web']
model: 'claude-sonnet-4.5'
handoffs:
  - label: 'APIテストを生成'
    agent: 'generate-api-tests'
    prompt: '上記のAPIエンドポイントのテストを生成してください'
    send: false
  - label: 'API仕様書を作成'
    agent: 'generate-api-docs'
    prompt: 'OpenAPI仕様書を生成してください'
    send: false
---
```

**使い方**:
- タスク実行: `#generate-api-endpoints`
- 相談: `@generate-api-endpoints`
- 次のステップ: handoffsボタンで自動遷移

### 例2: サブエージェント活用パターン

**プロンプトファイル内でのサブエージェント呼び出し**:
```markdown
### ステップ 1: リサーチ

#tool:runSubagent を使用して以下を調査:
- 最新のREST API設計パターン
- Express/FastAPIのベストプラクティス
- セキュリティとパフォーマンスの推奨事項

サブエージェントは独立したコンテキストで動作し、
調査結果のみを返却します。
```

**メリット**:
- コンテキストウィンドウの最適化
- 集中的なリサーチが可能
- 結果のみを受け取り、実装に集中

