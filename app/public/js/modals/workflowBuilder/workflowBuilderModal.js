/**
 * workflowBuilderModal.js
 * ワークフロービルダーモーダル
 * ノードパレット、キャンバス、プロパティパネルを統合
 */

class WorkflowBuilderModal {
    static #instance = null;

    /** @type {HTMLElement} */
    #modal = null;

    /** @type {WorkflowCanvas} */
    #canvas = null;

    /** @type {NodePalette} */
    #palette = null;

    /** @type {PropertiesPanel} */
    #propertiesPanel = null;

    /** @type {WorkflowEngine} */
    #engine = null;

    /** @type {WorkflowStorage} */
    #storage = null;

    /** @type {Object|null} */
    #currentWorkflow = null;

    /** @type {boolean} */
    #isExecuting = false;

    /** @type {string|null} */
    #currentExecutionId = null;

    /** @type {Object} */
    #eventListeners = {};

    /** @type {Array} サンプルワークフロー */
    #sampleWorkflows = [
        {
            id: 'sample_simple_qa',
            name: 'シンプルQ&A',
            icon: '📝',
            description: '基本的な質問応答ワークフロー。LLMに質問を投げて回答を得ます。',
            nodes: [
                { id: 'start_1', type: 'start', position: { x: 100, y: 150 }, properties: { variables: { question: 'AIとは何ですか？' } } },
                { id: 'llm_1', type: 'llm', position: { x: 350, y: 150 }, properties: { model: '', systemPrompt: 'あなたは親切なアシスタントです。', prompt: '{{input}}', temperature: 0.7, maxTokens: 1000 } },
                { id: 'end_1', type: 'end', position: { x: 600, y: 150 }, properties: { outputFormat: 'text' } }
            ],
            connections: [
                { id: 'conn_1', sourceNodeId: 'start_1', sourcePort: 'output', targetNodeId: 'llm_1', targetPort: 'input' },
                { id: 'conn_2', sourceNodeId: 'llm_1', sourcePort: 'output', targetNodeId: 'end_1', targetPort: 'input' }
            ]
        },
        {
            id: 'sample_rag_search',
            name: 'RAG検索 + 回答生成',
            icon: '📚',
            description: 'ナレッジベースから関連情報を検索し、その情報を元にLLMが回答を生成します。',
            nodes: [
                { id: 'start_1', type: 'start', position: { x: 100, y: 150 }, properties: { variables: { query: '検索したい内容' } } },
                { id: 'knowledge_1', type: 'knowledge', position: { x: 300, y: 150 }, properties: { topK: 3, minScore: 0.5 } },
                { id: 'llm_1', type: 'llm', position: { x: 500, y: 150 }, properties: { model: '', systemPrompt: '以下のコンテキストを参考に質問に答えてください。', prompt: 'コンテキスト:\n{{context}}\n\n質問: {{input}}', temperature: 0.7, maxTokens: 2000 } },
                { id: 'end_1', type: 'end', position: { x: 700, y: 150 }, properties: { outputFormat: 'text' } }
            ],
            connections: [
                { id: 'conn_1', sourceNodeId: 'start_1', sourcePort: 'output', targetNodeId: 'knowledge_1', targetPort: 'input' },
                { id: 'conn_2', sourceNodeId: 'knowledge_1', sourcePort: 'output', targetNodeId: 'llm_1', targetPort: 'input' },
                { id: 'conn_3', sourceNodeId: 'llm_1', sourcePort: 'output', targetNodeId: 'end_1', targetPort: 'input' }
            ]
        },
        {
            id: 'sample_condition',
            name: '条件分岐ワークフロー',
            icon: '🔀',
            description: '入力内容に応じて処理を分岐します。入力が長い場合は要約、短い場合はそのまま回答します。',
            nodes: [
                { id: 'start_1', type: 'start', position: { x: 100, y: 200 }, properties: { variables: { text: '分析するテキスト' } } },
                { id: 'condition_1', type: 'condition', position: { x: 300, y: 200 }, properties: { conditionType: 'custom', customCondition: 'return input.length > 100;' } },
                { id: 'llm_long', type: 'llm', position: { x: 500, y: 100 }, properties: { model: '', systemPrompt: '', prompt: '以下のテキストを要約してください:\n\n{{input}}', temperature: 0.5, maxTokens: 500 } },
                { id: 'template_short', type: 'template', position: { x: 500, y: 300 }, properties: { template: '入力テキスト: {{input}}\n\nこのテキストは短いため、そのまま表示します。' } },
                { id: 'end_1', type: 'end', position: { x: 700, y: 200 }, properties: { outputFormat: 'text' } }
            ],
            connections: [
                { id: 'conn_1', sourceNodeId: 'start_1', sourcePort: 'output', targetNodeId: 'condition_1', targetPort: 'input' },
                { id: 'conn_2', sourceNodeId: 'condition_1', sourcePort: 'true', targetNodeId: 'llm_long', targetPort: 'input' },
                { id: 'conn_3', sourceNodeId: 'condition_1', sourcePort: 'false', targetNodeId: 'template_short', targetPort: 'input' },
                { id: 'conn_4', sourceNodeId: 'llm_long', sourcePort: 'output', targetNodeId: 'end_1', targetPort: 'input' },
                { id: 'conn_5', sourceNodeId: 'template_short', sourcePort: 'output', targetNodeId: 'end_1', targetPort: 'input' }
            ]
        },
        {
            id: 'sample_document_pipeline',
            name: '文書要約パイプライン',
            icon: '📄',
            description: '長い文書を段階的に処理します。まずフォーマットを整え、要約し、最終的に整形します。',
            nodes: [
                { id: 'start_1', type: 'start', position: { x: 50, y: 150 }, properties: { variables: { document: '長い文書のテキスト...' } } },
                { id: 'template_1', type: 'template', position: { x: 200, y: 150 }, properties: { template: '以下の文書を分析してください:\n\n---\n{{input}}\n---' } },
                { id: 'llm_summarize', type: 'llm', position: { x: 400, y: 150 }, properties: { model: '', systemPrompt: '', prompt: '{{input}}\n\nこの文書の要点を5つ以内で箇条書きにしてください。', temperature: 0.3, maxTokens: 1000 } },
                { id: 'llm_format', type: 'llm', position: { x: 600, y: 150 }, properties: { model: '', systemPrompt: '', prompt: '以下の要点を読みやすくフォーマットしてください:\n\n{{input}}', temperature: 0.3, maxTokens: 1000 } },
                { id: 'end_1', type: 'end', position: { x: 800, y: 150 }, properties: { outputFormat: 'text' } }
            ],
            connections: [
                { id: 'conn_1', sourceNodeId: 'start_1', sourcePort: 'output', targetNodeId: 'template_1', targetPort: 'input' },
                { id: 'conn_2', sourceNodeId: 'template_1', sourcePort: 'output', targetNodeId: 'llm_summarize', targetPort: 'input' },
                { id: 'conn_3', sourceNodeId: 'llm_summarize', sourcePort: 'output', targetNodeId: 'llm_format', targetPort: 'input' },
                { id: 'conn_4', sourceNodeId: 'llm_format', sourcePort: 'output', targetNodeId: 'end_1', targetPort: 'input' }
            ]
        },
        {
            id: 'sample_api_integration',
            name: 'API連携ワークフロー',
            icon: '🌐',
            description: '外部APIからデータを取得し、コードで加工、テンプレートで整形して出力します。',
            nodes: [
                { id: 'start_1', type: 'start', position: { x: 50, y: 150 }, properties: { variables: { apiUrl: 'https://api.example.com/data' } } },
                { id: 'http_1', type: 'http', position: { x: 200, y: 150 }, properties: { method: 'GET', url: '{{input.apiUrl}}', headers: {} } },
                { id: 'code_1', type: 'code', position: { x: 400, y: 150 }, properties: { language: 'javascript', code: '// APIレスポンスを加工\nconst data = JSON.parse(input);\nreturn {\n  count: data.length,\n  items: data.slice(0, 5)\n};' } },
                { id: 'template_1', type: 'template', position: { x: 600, y: 150 }, properties: { template: '取得結果:\n- 総件数: {{input.count}}件\n- 表示件数: {{input.items.length}}件\n\nデータ:\n{{#each input.items}}\n  - {{this.name}}\n{{/each}}' } },
                { id: 'end_1', type: 'end', position: { x: 800, y: 150 }, properties: { outputFormat: 'text' } }
            ],
            connections: [
                { id: 'conn_1', sourceNodeId: 'start_1', sourcePort: 'output', targetNodeId: 'http_1', targetPort: 'input' },
                { id: 'conn_2', sourceNodeId: 'http_1', sourcePort: 'output', targetNodeId: 'code_1', targetPort: 'input' },
                { id: 'conn_3', sourceNodeId: 'code_1', sourcePort: 'output', targetNodeId: 'template_1', targetPort: 'input' },
                { id: 'conn_4', sourceNodeId: 'template_1', sourcePort: 'output', targetNodeId: 'end_1', targetPort: 'input' }
            ]
        }
    ];

    /**
     * @constructor
     */
    constructor() {
        if (WorkflowBuilderModal.#instance) {
            return WorkflowBuilderModal.#instance;
        }
        WorkflowBuilderModal.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {WorkflowBuilderModal}
     */
    static get getInstance() {
        if (!WorkflowBuilderModal.#instance) {
            WorkflowBuilderModal.#instance = new WorkflowBuilderModal();
        }
        return WorkflowBuilderModal.#instance;
    }

    /**
     * モーダルを初期化
     */
    async initialize() {
        // 依存コンポーネントを初期化
        this.#engine = window.WorkflowEngine?.getInstance || new WorkflowEngine();
        this.#engine.initialize();

        this.#storage = window.WorkflowStorage?.getInstance || new WorkflowStorage();
        await this.#storage.initialize();

        this.#createModal();
        this.#setupEventListeners();

        console.log('[WorkflowBuilderModal] 初期化完了');
    }

    /**
     * モーダルを作成
     */
    #createModal() {
        this.#modal = document.createElement('div');
        this.#modal.id = 'workflowBuilderModal';
        this.#modal.classList.add('workflow-builder-modal', 'hidden');

        this.#modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <div class="header-left">
                        <input type="text" class="workflow-name-input" placeholder="ワークフロー名" value="新規ワークフロー">
                    </div>
                    <div class="header-center">
                        <div class="execution-status hidden">
                            <span class="status-dot"></span>
                            <span class="status-text">実行中...</span>
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="zoom-controls">
                            <button class="zoom-btn" data-action="zoom-out" title="縮小">−</button>
                            <span class="zoom-level">100%</span>
                            <button class="zoom-btn" data-action="zoom-in" title="拡大">+</button>
                            <button class="zoom-btn" data-action="fit" title="コンテンツに合わせる">⊡</button>
                        </div>
                        <div class="action-buttons">
                            <button class="action-btn" data-action="save" title="保存">💾 保存</button>
                            <button class="action-btn primary" data-action="run" title="実行">▶ 実行</button>
                            <button class="action-btn" data-action="step" title="ステップ実行">⏭ ステップ</button>
                            <button class="action-btn danger hidden" data-action="stop" title="停止">⏹ 停止</button>
                        </div>
                        <button class="close-btn" title="閉じる">×</button>
                    </div>
                </div>

                <div class="modal-body">
                    <div class="panel node-palette-panel">
                        <div class="panel-header">
                            <span class="panel-title">ノード</span>
                        </div>
                        <div class="panel-content" id="nodePaletteContainer"></div>
                    </div>

                    <div class="panel canvas-panel">
                        <div class="canvas-container" id="workflowCanvasContainer"></div>
                    </div>

                    <div class="panel properties-panel">
                        <div class="panel-header">
                            <span class="panel-title">プロパティ</span>
                        </div>
                        <div class="panel-content" id="propertiesPanelContainer"></div>
                    </div>
                </div>

                <div class="modal-footer">
                    <div class="footer-left">
                        <button class="footer-btn" data-action="new" title="新規作成">📄 新規</button>
                        <button class="footer-btn" data-action="templates" title="テンプレート">📋 テンプレート</button>
                        <button class="footer-btn" data-action="open" title="開く">📂 開く</button>
                        <button class="footer-btn" data-action="export" title="エクスポート">📥 エクスポート</button>
                        <button class="footer-btn" data-action="import" title="インポート">📤 インポート</button>
                    </div>
                    <div class="footer-center">
                        <span class="workflow-info"></span>
                    </div>
                    <div class="footer-right">
                        <span class="footer-status"></span>
                    </div>
                </div>
            </div>

            <!-- ワークフロー一覧ドロワー -->
            <div class="workflow-list-drawer hidden">
                <div class="drawer-header">
                    <span class="drawer-title">保存済みワークフロー</span>
                    <button class="drawer-close">×</button>
                </div>
                <div class="drawer-content">
                    <div class="workflow-list"></div>
                </div>
            </div>

            <!-- テンプレートドロワー -->
            <div class="templates-drawer hidden">
                <div class="drawer-header">
                    <span class="drawer-title">📋 サンプルテンプレート</span>
                    <button class="drawer-close">×</button>
                </div>
                <div class="drawer-content">
                    <div class="templates-list"></div>
                </div>
            </div>

            <!-- 実行結果モーダル -->
            <div class="execution-result-drawer hidden">
                <div class="drawer-header">
                    <span class="drawer-title">📊 実行結果</span>
                    <button class="drawer-close">×</button>
                </div>
                <div class="drawer-content">
                    <div class="result-summary"></div>
                    <div class="result-output"></div>
                </div>
            </div>

            <!-- ファイルインポート用の隠しinput -->
            <input type="file" id="workflowFileInput" accept=".json" style="display: none;">
        `;

        document.body.appendChild(this.#modal);

        // コンポーネントを初期化
        this.#canvas = window.WorkflowCanvas?.getInstance || new WorkflowCanvas();
        this.#canvas.initialize(this.#modal.querySelector('#workflowCanvasContainer'));

        this.#palette = window.NodePalette?.getInstance || new NodePalette();
        this.#palette.initialize(this.#modal.querySelector('#nodePaletteContainer'));

        this.#propertiesPanel = window.PropertiesPanel?.getInstance || new PropertiesPanel();
        this.#propertiesPanel.initialize(
            this.#modal.querySelector('#propertiesPanelContainer'),
            (nodeId, properties) => this.#canvas.updateNodeProperties(nodeId, properties)
        );
    }

    /**
     * イベントリスナーをセットアップ
     */
    #setupEventListeners() {
        // オーバーレイクリックで閉じる
        this.#modal.querySelector('.modal-overlay').addEventListener('click', () => this.hide());

        // 閉じるボタン
        this.#modal.querySelector('.close-btn').addEventListener('click', () => this.hide());

        // ズームコントロール
        this.#modal.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => this.#handleZoomAction(btn.dataset.action));
        });

        // アクションボタン
        this.#modal.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => this.#handleAction(btn.dataset.action));
        });

        // フッターボタン
        this.#modal.querySelectorAll('.footer-btn').forEach(btn => {
            btn.addEventListener('click', () => this.#handleAction(btn.dataset.action));
        });

        // ワークフロー名の変更
        this.#modal.querySelector('.workflow-name-input').addEventListener('change', (e) => {
            if (this.#currentWorkflow) {
                this.#currentWorkflow.name = e.target.value;
            }
        });

        // キャンバスイベント
        this.#canvas.on('nodeSelected', ({ node }) => {
            this.#propertiesPanel.showNode(node);
        });

        this.#canvas.on('selectionCleared', () => {
            this.#propertiesPanel.clear();
        });

        this.#canvas.on('nodeDoubleClick', ({ node }) => {
            this.#propertiesPanel.showNode(node);
        });

        this.#canvas.on('zoomChange', ({ zoom }) => {
            this.#updateZoomDisplay(zoom);
        });

        this.#canvas.on('nodeAdded', () => this.#updateWorkflowInfo());
        this.#canvas.on('nodeDeleted', () => this.#updateWorkflowInfo());
        this.#canvas.on('connectionAdded', () => this.#updateWorkflowInfo());
        this.#canvas.on('connectionDeleted', () => this.#updateWorkflowInfo());

        // ワークフローエンジンイベント
        this.#engine.on('nodeStart', (data) => this.#onNodeStart(data));
        this.#engine.on('nodeComplete', (data) => this.#onNodeComplete(data));
        this.#engine.on('nodeError', (data) => this.#onNodeError(data));
        this.#engine.on('complete', (data) => this.#onExecutionComplete(data));
        this.#engine.on('error', (data) => this.#onExecutionError(data));

        // ドロワー（ワークフロー一覧）
        this.#modal.querySelector('.workflow-list-drawer .drawer-close').addEventListener('click', () => {
            this.#modal.querySelector('.workflow-list-drawer').classList.add('hidden');
        });

        // ドロワー（テンプレート）
        this.#modal.querySelector('.templates-drawer .drawer-close').addEventListener('click', () => {
            this.#modal.querySelector('.templates-drawer').classList.add('hidden');
        });

        // ファイルインポート
        this.#modal.querySelector('#workflowFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.#importFromFile(file);
            }
            e.target.value = '';
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (!this.#modal.classList.contains('hidden')) {
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.#saveWorkflow();
                }
                if (e.key === 'Escape') {
                    this.hide();
                }
            }
        });

        // 実行結果モーダルの閉じるボタン
        this.#modal.querySelector('.execution-result-drawer .drawer-close').addEventListener('click', () => {
            this.#modal.querySelector('.execution-result-drawer').classList.add('hidden');
        });
    }

    /**
     * ズームアクションを処理
     * @param {string} action
     */
    #handleZoomAction(action) {
        const currentZoom = this.#canvas.getWorkflowData() ? 1 : 1; // TODO: get current zoom

        switch (action) {
            case 'zoom-in':
                this.#canvas.setZoom(Math.min(2, currentZoom * 1.2));
                break;
            case 'zoom-out':
                this.#canvas.setZoom(Math.max(0.25, currentZoom / 1.2));
                break;
            case 'fit':
                this.#canvas.fitToContent();
                break;
        }
    }

    /**
     * アクションを処理
     * @param {string} action
     */
    async #handleAction(action) {
        switch (action) {
            case 'save':
                await this.#saveWorkflow();
                break;
            case 'run':
                await this.#runWorkflow();
                break;
            case 'step':
                await this.#stepExecute();
                break;
            case 'stop':
                this.#stopExecution();
                break;
            case 'new':
                this.#newWorkflow();
                break;
            case 'open':
                await this.#showWorkflowList();
                break;
            case 'export':
                await this.#exportWorkflow();
                break;
            case 'import':
                this.#modal.querySelector('#workflowFileInput').click();
                break;
            case 'templates':
                this.#showTemplatesDrawer();
                break;
        }
    }

    /**
     * ワークフローを保存
     */
    async #saveWorkflow() {
        const data = this.#canvas.getWorkflowData();
        const name = this.#modal.querySelector('.workflow-name-input').value || '新規ワークフロー';

        const workflow = {
            id: this.#currentWorkflow?.id || null,
            name: name,
            nodes: data.nodes,
            connections: data.connections
        };

        try {
            const saved = await this.#storage.save(workflow);
            this.#currentWorkflow = saved;
            this.#showStatus('保存しました');
        } catch (error) {
            console.error('[WorkflowBuilder] 保存エラー:', error);
            this.#showStatus('保存に失敗しました', 'error');
        }
    }

    /**
     * ワークフローを実行
     */
    async #runWorkflow() {
        if (this.#isExecuting) return;

        const data = this.#canvas.getWorkflowData();
        const workflow = {
            id: this.#currentWorkflow?.id || 'temp',
            name: this.#modal.querySelector('.workflow-name-input').value,
            nodes: data.nodes,
            connections: data.connections
        };

        // 検証
        const validation = this.#engine.validate(workflow);
        if (!validation.valid) {
            this.#showStatus(validation.errors.join(', '), 'error');
            return;
        }

        this.#setExecuting(true);

        try {
            const result = await this.#engine.execute(workflow);

            if (result.success) {
                this.#showStatus(`実行完了 (${result.duration}ms)`);
                console.log('[WorkflowBuilder] 実行結果:', result);
            } else {
                this.#showStatus(`実行エラー: ${result.error}`, 'error');
            }
            // 結果パネルを表示
            this.#showExecutionResult(result);
        } catch (error) {
            console.error('[WorkflowBuilder] 実行エラー:', error);
            this.#showStatus(`実行エラー: ${error.message}`, 'error');
            // エラー時も結果パネルを表示
            this.#showExecutionResult({
                success: false,
                error: error.message,
                duration: 0
            });
        } finally {
            this.#setExecuting(false);
        }
    }

    /**
     * ステップ実行
     */
    async #stepExecute() {
        // TODO: ステップ実行UIの実装
        this.#showStatus('ステップ実行は開発中です');
    }

    /**
     * 実行を停止
     */
    #stopExecution() {
        if (this.#currentExecutionId) {
            this.#engine.abort(this.#currentExecutionId);
            this.#setExecuting(false);
            this.#showStatus('実行を停止しました');
        }
    }

    /**
     * 新規ワークフロー
     */
    #newWorkflow() {
        this.#canvas.clear();
        this.#currentWorkflow = null;
        this.#modal.querySelector('.workflow-name-input').value = '新規ワークフロー';
        this.#propertiesPanel.clear();
        this.#updateWorkflowInfo();
    }

    /**
     * ワークフロー一覧を表示
     */
    async #showWorkflowList() {
        const drawer = this.#modal.querySelector('.workflow-list-drawer');
        const listContainer = drawer.querySelector('.workflow-list');

        const workflows = await this.#storage.getAll();

        if (workflows.length === 0) {
            listContainer.innerHTML = '<div class="list-empty">保存済みのワークフローがありません</div>';
        } else {
            listContainer.innerHTML = workflows.map(wf => `
                <div class="workflow-list-item" data-workflow-id="${wf.id}">
                    <div class="item-info">
                        <div class="item-name">${wf.name}</div>
                        <div class="item-meta">
                            ノード: ${wf.nodes?.length || 0} |
                            更新: ${new Date(wf.updatedAt).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="item-btn" data-action="load" title="開く">📂</button>
                        <button class="item-btn" data-action="duplicate" title="複製">📋</button>
                        <button class="item-btn danger" data-action="delete" title="削除">🗑️</button>
                    </div>
                </div>
            `).join('');

            // イベントリスナー
            listContainer.querySelectorAll('.workflow-list-item').forEach(item => {
                const id = item.dataset.workflowId;

                item.querySelector('[data-action="load"]').addEventListener('click', async () => {
                    await this.#loadWorkflow(id);
                    drawer.classList.add('hidden');
                });

                item.querySelector('[data-action="duplicate"]').addEventListener('click', async () => {
                    await this.#storage.duplicate(id);
                    await this.#showWorkflowList();
                });

                item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
                    if (confirm('このワークフローを削除しますか？')) {
                        await this.#storage.delete(id);
                        await this.#showWorkflowList();
                    }
                });
            });
        }

        drawer.classList.remove('hidden');
    }

    /**
     * テンプレートドロワーを表示
     */
    #showTemplatesDrawer() {
        const drawer = this.#modal.querySelector('.templates-drawer');
        const listContainer = drawer.querySelector('.templates-list');

        listContainer.innerHTML = this.#sampleWorkflows.map(sample => `
            <div class="template-item" data-template-id="${sample.id}">
                <div class="template-icon">${sample.icon}</div>
                <div class="template-info">
                    <div class="template-name">${sample.name}</div>
                    <div class="template-description">${sample.description}</div>
                    <div class="template-meta">
                        ノード: ${sample.nodes.length} | 接続: ${sample.connections.length}
                    </div>
                </div>
                <button class="template-use-btn" data-template-id="${sample.id}">
                    使用する
                </button>
            </div>
        `).join('');

        // テンプレート選択イベント
        listContainer.querySelectorAll('.template-use-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.#loadTemplate(btn.dataset.templateId);
                drawer.classList.add('hidden');
            });
        });

        drawer.classList.remove('hidden');
    }

    /**
     * テンプレートを読み込み
     * @param {string} templateId
     */
    #loadTemplate(templateId) {
        const template = this.#sampleWorkflows.find(t => t.id === templateId);
        if (!template) {
            this.#showStatus('テンプレートが見つかりません', 'error');
            return;
        }

        // 新しいワークフローとして読み込み（IDは新規生成させる）
        this.#currentWorkflow = null;
        this.#modal.querySelector('.workflow-name-input').value = template.name;

        // 現在選択中のモデルを取得
        const currentModel = /** @type {HTMLSelectElement|null} */ (document.getElementById('modelSelect'))?.value || '';

        // ノードIDを新規生成してコピー
        const idMap = new Map();
        const newNodes = template.nodes.map(node => {
            const newId = `${node.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            idMap.set(node.id, newId);
            const newNode = {
                ...node,
                id: newId,
                properties: { ...node.properties }
            };

            // LLMノードの場合、モデルが未設定なら現在のモデルを設定
            if (node.type === 'llm' && !newNode.properties.model && currentModel) {
                newNode.properties.model = currentModel;
            }

            return newNode;
        });

        // 接続のノードIDを更新
        const newConnections = template.connections.map(conn => ({
            ...conn,
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceNodeId: idMap.get(conn.sourceNodeId),
            targetNodeId: idMap.get(conn.targetNodeId)
        }));

        this.#canvas.loadWorkflowData({
            nodes: newNodes,
            connections: newConnections
        });

        this.#propertiesPanel.clear();
        this.#updateWorkflowInfo();
        this.#showStatus(`テンプレート「${template.name}」を読み込みました`);
        console.log(`[WorkflowBuilder] テンプレート読み込み: ${template.name}`);
    }

    /**
     * ワークフローを読み込み
     * @param {string} id
     */
    async #loadWorkflow(id) {
        try {
            const workflow = await this.#storage.get(id);
            if (!workflow) {
                this.#showStatus('ワークフローが見つかりません', 'error');
                return;
            }

            this.#currentWorkflow = workflow;
            this.#modal.querySelector('.workflow-name-input').value = workflow.name;
            this.#canvas.loadWorkflowData({
                nodes: workflow.nodes,
                connections: workflow.connections
            });
            this.#propertiesPanel.clear();
            this.#updateWorkflowInfo();
            this.#showStatus('読み込みました');
        } catch (error) {
            console.error('[WorkflowBuilder] 読み込みエラー:', error);
            this.#showStatus('読み込みに失敗しました', 'error');
        }
    }

    /**
     * ワークフローをエクスポート
     */
    async #exportWorkflow() {
        if (!this.#currentWorkflow?.id) {
            // 未保存の場合は先に保存
            await this.#saveWorkflow();
        }

        if (this.#currentWorkflow?.id) {
            await this.#storage.downloadAsFile(this.#currentWorkflow.id);
            this.#showStatus('エクスポートしました');
        }
    }

    /**
     * ファイルからインポート
     * @param {File} file
     */
    async #importFromFile(file) {
        try {
            const workflow = await this.#storage.importFromFile(file);
            await this.#loadWorkflow(workflow.id);
            this.#showStatus('インポートしました');
        } catch (error) {
            console.error('[WorkflowBuilder] インポートエラー:', error);
            this.#showStatus('インポートに失敗しました', 'error');
        }
    }

    // ========================================
    // 実行状態管理
    // ========================================

    /**
     * 実行状態を設定
     * @param {boolean} executing
     */
    #setExecuting(executing) {
        this.#isExecuting = executing;

        const runBtn = this.#modal.querySelector('[data-action="run"]');
        const stepBtn = this.#modal.querySelector('[data-action="step"]');
        const stopBtn = this.#modal.querySelector('[data-action="stop"]');
        const statusEl = this.#modal.querySelector('.execution-status');

        if (executing) {
            runBtn.classList.add('hidden');
            stepBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            statusEl.classList.remove('hidden');
        } else {
            runBtn.classList.remove('hidden');
            stepBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
            statusEl.classList.add('hidden');
        }
    }

    /**
     * ノード開始時
     * @param {Object} data
     */
    #onNodeStart(data) {
        const statusText = this.#modal.querySelector('.status-text');
        statusText.textContent = `実行中: ${data.nodeType}`;
        // TODO: ノードのハイライト
    }

    /**
     * ノード完了時
     * @param {Object} data
     */
    #onNodeComplete(data) {
        // TODO: ノードの完了表示
    }

    /**
     * ノードエラー時
     * @param {Object} data
     */
    #onNodeError(data) {
        console.error('[WorkflowBuilder] ノードエラー:', data);
        // TODO: ノードのエラー表示
    }

    /**
     * 実行完了時
     * @param {Object} data
     */
    #onExecutionComplete(data) {
        this.#setExecuting(false);
    }

    /**
     * 実行エラー時
     * @param {Object} data
     */
    #onExecutionError(data) {
        this.#setExecuting(false);
    }

    /**
     * 実行結果を表示
     * @param {Object} result - 実行結果オブジェクト
     */
    #showExecutionResult(result) {
        const drawer = this.#modal.querySelector('.execution-result-drawer');
        const summaryEl = drawer.querySelector('.result-summary');
        const outputEl = drawer.querySelector('.result-output');

        // サマリー表示
        summaryEl.innerHTML = `
            <div class="result-status ${result.success ? 'success' : 'error'}">
                ${result.success ? '✅ 成功' : '❌ エラー'}
            </div>
            <div class="result-duration">⏱ ${result.duration}ms</div>
        `;

        // 結果出力
        if (result.success && result.result) {
            const resultText = typeof result.result === 'string'
                ? result.result
                : JSON.stringify(result.result, null, 2);
            outputEl.innerHTML = `
                <div class="result-label">出力:</div>
                <div class="result-content">${this.#escapeHtml(resultText)}</div>
            `;
        } else if (!result.success) {
            outputEl.innerHTML = `
                <div class="result-label">エラー:</div>
                <div class="result-content error">${this.#escapeHtml(result.error || '不明なエラー')}</div>
            `;
        } else {
            outputEl.innerHTML = `
                <div class="result-label">出力:</div>
                <div class="result-content empty">出力なし</div>
            `;
        }

        drawer.classList.remove('hidden');
    }

    /**
     * HTMLエスケープ
     * @param {string} text
     * @returns {string}
     */
    #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================
    // UI更新
    // ========================================

    /**
     * ズーム表示を更新
     * @param {number} zoom
     */
    #updateZoomDisplay(zoom) {
        const zoomLevel = this.#modal.querySelector('.zoom-level');
        zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    }

    /**
     * ワークフロー情報を更新
     */
    #updateWorkflowInfo() {
        const data = this.#canvas.getWorkflowData();
        const infoEl = this.#modal.querySelector('.workflow-info');
        infoEl.textContent = `ノード: ${data.nodes.length} | 接続: ${data.connections.length}`;
    }

    /**
     * ステータスを表示
     * @param {string} message
     * @param {string} [type='success']
     */
    #showStatus(message, type = 'success') {
        const statusEl = this.#modal.querySelector('.footer-status');
        statusEl.textContent = message;
        statusEl.className = `footer-status ${type}`;

        // 3秒後にクリア
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'footer-status';
        }, 3000);
    }

    // ========================================
    // 公開メソッド
    // ========================================

    /**
     * モーダルを表示
     * @param {Object} [workflow] - 編集するワークフロー
     */
    async show(workflow = null) {
        // 初期化されていなければ初期化
        if (!this.#modal) {
            await this.initialize();
        }

        if (workflow) {
            await this.#loadWorkflow(workflow.id);
        } else if (!this.#currentWorkflow) {
            this.#newWorkflow();
        }

        this.#modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        this.#emit('show', {});
    }

    /**
     * モーダルを非表示
     */
    hide() {
        if (this.#isExecuting) {
            if (!confirm('実行中のワークフローがあります。閉じますか？')) {
                return;
            }
            this.#stopExecution();
        }

        this.#modal.classList.add('hidden');
        document.body.style.overflow = '';

        this.#emit('hide', {});
    }

    /**
     * モーダルが表示されているか
     * @returns {boolean}
     */
    isVisible() {
        return !this.#modal.classList.contains('hidden');
    }

    // ========================================
    // イベント管理
    // ========================================

    /**
     * イベントリスナーを登録
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this.#eventListeners[event]) {
            this.#eventListeners[event] = [];
        }
        this.#eventListeners[event].push(callback);
    }

    /**
     * イベントリスナーを解除
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        if (this.#eventListeners[event]) {
            this.#eventListeners[event] = this.#eventListeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * イベントを発火
     * @param {string} event
     * @param {Object} data
     */
    #emit(event, data) {
        if (this.#eventListeners[event]) {
            for (const callback of this.#eventListeners[event]) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[WorkflowBuilderModal] イベントハンドラエラー (${event}):`, error);
                }
            }
        }
    }
}

// グローバルに公開
window.WorkflowBuilderModal = WorkflowBuilderModal;
