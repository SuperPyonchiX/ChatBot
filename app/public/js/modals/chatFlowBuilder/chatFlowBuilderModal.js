/**
 * ChatFlowBuilderModal - チャットフロービルダーのモーダルUI
 * @description マルチターン会話フローを設計するビジュアルエディタ
 */
class ChatFlowBuilderModal {
    static #instance = null;

    /** @type {HTMLElement|null} */
    #modal = null;

    /** @type {Object|null} 現在編集中のフロー */
    #currentFlow = null;

    /** @type {Object|null} 選択中のノード */
    #selectedNode = null;

    /** @type {boolean} ドラッグ中フラグ */
    #isDragging = false;

    /** @type {Object|null} ドラッグ開始位置 */
    #dragStart = null;

    /** @type {Object} キャンバスのオフセット */
    #canvasOffset = { x: 0, y: 0 };

    /** @type {number} ズームレベル */
    #zoom = 1;

    constructor() {
        if (ChatFlowBuilderModal.#instance) {
            return ChatFlowBuilderModal.#instance;
        }
        ChatFlowBuilderModal.#instance = this;
    }

    static get getInstance() {
        if (!ChatFlowBuilderModal.#instance) {
            ChatFlowBuilderModal.#instance = new ChatFlowBuilderModal();
        }
        return ChatFlowBuilderModal.#instance;
    }

    /**
     * 初期化
     */
    async initialize() {
        this.#createModal();
        this.#setupEventListeners();
        await ChatFlowEngine.getInstance.initialize();
        console.log('[ChatFlowBuilderModal] 初期化完了');
    }

    /**
     * モーダルDOMを作成
     */
    #createModal() {
        this.#modal = document.createElement('div');
        this.#modal.id = 'chatFlowBuilderModal';
        this.#modal.className = 'chatflow-builder-modal hidden';
        this.#modal.innerHTML = `
            <div class="chatflow-builder-container">
                <!-- ヘッダー -->
                <div class="chatflow-builder-header">
                    <div class="chatflow-header-left">
                        <span class="chatflow-title-icon">💬</span>
                        <input type="text" class="chatflow-name-input" value="新しいチャットフロー" placeholder="フロー名">
                    </div>
                    <div class="chatflow-header-actions">
                        <button class="chatflow-action-btn" data-action="new" title="新規作成">
                            <i class="fas fa-file"></i>
                        </button>
                        <button class="chatflow-action-btn" data-action="save" title="保存">
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="chatflow-action-btn" data-action="load" title="読み込み">
                            <i class="fas fa-folder-open"></i>
                        </button>
                        <button class="chatflow-action-btn" data-action="export" title="エクスポート">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="chatflow-action-btn" data-action="import" title="インポート">
                            <i class="fas fa-upload"></i>
                        </button>
                        <button class="chatflow-close-btn" data-action="close" title="閉じる">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- メインコンテンツ -->
                <div class="chatflow-builder-main">
                    <!-- ノードパレット -->
                    <div class="chatflow-palette">
                        <div class="chatflow-palette-header">ノード</div>
                        <div class="chatflow-palette-content"></div>
                    </div>

                    <!-- キャンバス -->
                    <div class="chatflow-canvas-container">
                        <div class="chatflow-canvas">
                            <svg class="chatflow-connections"></svg>
                            <div class="chatflow-nodes"></div>
                        </div>
                        <div class="chatflow-zoom-controls">
                            <button class="chatflow-zoom-btn" data-action="zoom-out">−</button>
                            <span class="chatflow-zoom-level">100%</span>
                            <button class="chatflow-zoom-btn" data-action="zoom-in">+</button>
                        </div>
                    </div>

                    <!-- プロパティパネル -->
                    <div class="chatflow-properties">
                        <div class="chatflow-properties-header">プロパティ</div>
                        <div class="chatflow-properties-content">
                            <p class="chatflow-properties-empty">ノードを選択してください</p>
                        </div>
                    </div>
                </div>

                <!-- フッター -->
                <div class="chatflow-builder-footer">
                    <div class="chatflow-status"></div>
                    <div class="chatflow-footer-actions">
                        <button class="chatflow-action-btn primary" data-action="test">
                            <i class="fas fa-play"></i> テスト実行
                        </button>
                    </div>
                </div>

                <!-- フロー一覧ドロワー -->
                <div class="chatflow-list-drawer hidden">
                    <div class="drawer-header">
                        <span class="drawer-title">📋 フロー一覧</span>
                        <button class="drawer-close">×</button>
                    </div>
                    <div class="drawer-content">
                        <div class="chatflow-list"></div>
                    </div>
                </div>

                <!-- 隠しファイル入力 -->
                <input type="file" class="chatflow-import-input hidden" accept=".json">
            </div>
        `;

        document.body.appendChild(this.#modal);
        this.#renderPalette();
    }

    /**
     * ノードパレットを描画
     */
    #renderPalette() {
        const content = this.#modal.querySelector('.chatflow-palette-content');
        const nodesByCategory = ChatFlowNodes.getInstance.getNodeTypesByCategory();

        const categoryLabels = {
            control: '制御',
            ai: 'AI',
            input: '入力',
            output: '出力',
            process: '処理'
        };

        let html = '';
        for (const [category, nodes] of Object.entries(nodesByCategory)) {
            html += `
                <div class="chatflow-palette-category">
                    <div class="chatflow-palette-category-header">${categoryLabels[category] || category}</div>
                    ${nodes.map(node => `
                        <div class="chatflow-palette-node" data-type="${node.type}" draggable="true">
                            <span class="chatflow-palette-node-icon">${node.icon}</span>
                            <span class="chatflow-palette-node-name">${node.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        content.innerHTML = html;
    }

    /**
     * イベントリスナーをセットアップ
     */
    #setupEventListeners() {
        // アクションボタン
        this.#modal.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.#handleAction(action);
            });
        });

        // パレットからのドラッグ
        this.#modal.querySelectorAll('.chatflow-palette-node').forEach(node => {
            node.addEventListener('dragstart', (e) => this.#handlePaletteDragStart(e));
        });

        // キャンバスへのドロップ
        const canvas = this.#modal.querySelector('.chatflow-canvas');
        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', (e) => this.#handleCanvasDrop(e));

        // キャンバスクリック（選択解除）
        canvas.addEventListener('click', (e) => {
            if (e.target === canvas || e.target.classList.contains('chatflow-nodes')) {
                this.#selectNode(null);
            }
        });

        // ドロワー閉じるボタン
        this.#modal.querySelector('.chatflow-list-drawer .drawer-close').addEventListener('click', () => {
            this.#modal.querySelector('.chatflow-list-drawer').classList.add('hidden');
        });

        // インポートファイル入力
        this.#modal.querySelector('.chatflow-import-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.#handleImport(e.target.files[0]);
            }
        });

        // フロー名変更
        this.#modal.querySelector('.chatflow-name-input').addEventListener('change', (e) => {
            if (this.#currentFlow) {
                this.#currentFlow.name = e.target.value;
            }
        });
    }

    /**
     * アクションを処理
     * @param {string} action
     */
    async #handleAction(action) {
        switch (action) {
            case 'close':
                this.hide();
                break;
            case 'new':
                this.#newFlow();
                break;
            case 'save':
                await this.#saveFlow();
                break;
            case 'load':
                this.#showFlowList();
                break;
            case 'export':
                this.#exportFlow();
                break;
            case 'import':
                this.#modal.querySelector('.chatflow-import-input').click();
                break;
            case 'test':
                await this.#testFlow();
                break;
            case 'zoom-in':
                this.#setZoom(Math.min(this.#zoom + 0.1, 2));
                break;
            case 'zoom-out':
                this.#setZoom(Math.max(this.#zoom - 0.1, 0.5));
                break;
        }
    }

    /**
     * 新規フローを作成
     */
    #newFlow() {
        this.#currentFlow = {
            id: null,
            name: '新しいチャットフロー',
            nodes: [],
            connections: [],
            metadata: {
                type: 'chatflow'
            }
        };

        this.#modal.querySelector('.chatflow-name-input').value = this.#currentFlow.name;
        this.#renderCanvas();
        this.#selectNode(null);
        this.#showStatus('新しいフローを作成しました');
    }

    /**
     * フローを保存
     */
    async #saveFlow() {
        if (!this.#currentFlow) {
            this.#showStatus('保存するフローがありません', 'error');
            return;
        }

        this.#currentFlow.name = this.#modal.querySelector('.chatflow-name-input').value;

        try {
            const saved = await ChatFlowEngine.getInstance.registerChatFlow(this.#currentFlow);
            this.#currentFlow = saved;
            this.#showStatus('フローを保存しました');
        } catch (error) {
            console.error('[ChatFlowBuilderModal] 保存エラー:', error);
            this.#showStatus('保存に失敗しました', 'error');
        }
    }

    /**
     * フロー一覧を表示
     */
    #showFlowList() {
        const drawer = this.#modal.querySelector('.chatflow-list-drawer');
        const list = drawer.querySelector('.chatflow-list');

        const flows = ChatFlowEngine.getInstance.getAllChatFlows();

        if (flows.length === 0) {
            list.innerHTML = '<p class="chatflow-list-empty">保存されたフローはありません</p>';
        } else {
            list.innerHTML = flows.map(flow => `
                <div class="chatflow-list-item" data-id="${flow.id}">
                    <div class="chatflow-list-item-info">
                        <div class="chatflow-list-item-name">${this.#escapeHtml(flow.name)}</div>
                        <div class="chatflow-list-item-meta">
                            ノード: ${flow.nodes?.length || 0} |
                            更新: ${new Date(flow.updatedAt).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="chatflow-list-item-actions">
                        <button class="chatflow-list-btn" data-action="load-flow">読込</button>
                        <button class="chatflow-list-btn danger" data-action="delete-flow">削除</button>
                    </div>
                </div>
            `).join('');

            // イベントリスナーを追加
            list.querySelectorAll('.chatflow-list-item').forEach(item => {
                item.querySelector('[data-action="load-flow"]').addEventListener('click', () => {
                    this.#loadFlow(item.dataset.id);
                    drawer.classList.add('hidden');
                });
                item.querySelector('[data-action="delete-flow"]').addEventListener('click', async () => {
                    if (confirm('このフローを削除しますか？')) {
                        await ChatFlowEngine.getInstance.deleteChatFlow(item.dataset.id);
                        this.#showFlowList();
                    }
                });
            });
        }

        drawer.classList.remove('hidden');
    }

    /**
     * フローを読み込む
     * @param {string} flowId
     */
    #loadFlow(flowId) {
        const flow = ChatFlowEngine.getInstance.getChatFlow(flowId);
        if (!flow) {
            this.#showStatus('フローが見つかりません', 'error');
            return;
        }

        this.#currentFlow = JSON.parse(JSON.stringify(flow)); // ディープコピー
        this.#modal.querySelector('.chatflow-name-input').value = this.#currentFlow.name;
        this.#renderCanvas();
        this.#selectNode(null);
        this.#showStatus(`"${flow.name}" を読み込みました`);
    }

    /**
     * フローをエクスポート
     */
    #exportFlow() {
        if (!this.#currentFlow || !this.#currentFlow.id) {
            this.#showStatus('先にフローを保存してください', 'error');
            return;
        }

        ChatFlowStorage.getInstance.downloadFlow(this.#currentFlow.id);
        this.#showStatus('フローをエクスポートしました');
    }

    /**
     * インポート処理
     * @param {File} file
     */
    async #handleImport(file) {
        try {
            const result = await ChatFlowStorage.getInstance.importFromFile(file);
            if (Array.isArray(result)) {
                this.#showStatus(`${result.length} 件のフローをインポートしました`);
            } else {
                this.#currentFlow = result;
                this.#modal.querySelector('.chatflow-name-input').value = this.#currentFlow.name;
                this.#renderCanvas();
                this.#showStatus('フローをインポートしました');
            }
        } catch (error) {
            console.error('[ChatFlowBuilderModal] インポートエラー:', error);
            this.#showStatus('インポートに失敗しました', 'error');
        }
    }

    /**
     * テスト実行
     */
    async #testFlow() {
        if (!this.#currentFlow || this.#currentFlow.nodes.length === 0) {
            this.#showStatus('テストするノードがありません', 'error');
            return;
        }

        // 先に保存
        await this.#saveFlow();

        // テスト用の会話IDを生成
        const testConversationId = `test_${Date.now()}`;

        try {
            this.#showStatus('テスト実行中...');

            // 出力イベントをリッスン
            const outputs = [];
            const outputHandler = (data) => {
                outputs.push(data);
            };
            ChatFlowEngine.getInstance.on('output', outputHandler);

            // フローを開始
            const session = await ChatFlowEngine.getInstance.startFlow(
                this.#currentFlow.id,
                testConversationId
            );

            ChatFlowEngine.getInstance.off('output', outputHandler);

            // 結果を表示
            if (outputs.length > 0) {
                alert(`テスト結果:\n\n${outputs.map(o => o.content).join('\n\n')}`);
            }

            this.#showStatus(`テスト完了 (セッション状態: ${session.status})`);

        } catch (error) {
            console.error('[ChatFlowBuilderModal] テストエラー:', error);
            this.#showStatus(`テストエラー: ${error.message}`, 'error');
        }
    }

    /**
     * パレットからのドラッグ開始
     * @param {DragEvent} e
     */
    #handlePaletteDragStart(e) {
        e.dataTransfer.setData('nodeType', e.target.dataset.type);
    }

    /**
     * キャンバスへのドロップ
     * @param {DragEvent} e
     */
    #handleCanvasDrop(e) {
        e.preventDefault();

        const nodeType = e.dataTransfer.getData('nodeType');
        if (!nodeType) return;

        const canvas = this.#modal.querySelector('.chatflow-canvas');
        const rect = canvas.getBoundingClientRect();

        const x = (e.clientX - rect.left) / this.#zoom - this.#canvasOffset.x;
        const y = (e.clientY - rect.top) / this.#zoom - this.#canvasOffset.y;

        this.#addNode(nodeType, { x, y });
    }

    /**
     * ノードを追加
     * @param {string} type
     * @param {Object} position
     */
    #addNode(type, position) {
        if (!this.#currentFlow) {
            this.#newFlow();
        }

        const nodeTypeInfo = ChatFlowNodes.getInstance.getNodeType(type);
        if (!nodeTypeInfo) return;

        const node = {
            id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: type,
            position: position,
            properties: {}
        };

        // デフォルトプロパティを設定
        if (nodeTypeInfo.properties) {
            nodeTypeInfo.properties.forEach(prop => {
                node.properties[prop.name] = prop.default;
            });
        }

        this.#currentFlow.nodes.push(node);
        this.#renderCanvas();
        this.#selectNode(node);
    }

    /**
     * キャンバスを描画
     */
    #renderCanvas() {
        if (!this.#currentFlow) return;

        const nodesContainer = this.#modal.querySelector('.chatflow-nodes');
        const svg = this.#modal.querySelector('.chatflow-connections');

        // ノードを描画
        nodesContainer.innerHTML = this.#currentFlow.nodes.map(node => {
            const nodeType = ChatFlowNodes.getInstance.getNodeType(node.type);
            return `
                <div class="chatflow-node ${this.#selectedNode?.id === node.id ? 'selected' : ''}"
                     data-id="${node.id}"
                     style="left: ${node.position.x}px; top: ${node.position.y}px; border-color: ${nodeType?.color || '#666'};">
                    <div class="chatflow-node-header" style="background: ${nodeType?.color || '#666'}">
                        <span class="chatflow-node-icon">${nodeType?.icon || '📦'}</span>
                        <span class="chatflow-node-name">${nodeType?.name || node.type}</span>
                    </div>
                    <div class="chatflow-node-ports">
                        ${(nodeType?.inputs || []).map(input => `
                            <div class="chatflow-node-port input" data-port="${input.id}">
                                <span class="chatflow-port-dot"></span>
                                <span class="chatflow-port-label">${input.name}</span>
                            </div>
                        `).join('')}
                        ${(nodeType?.outputs || []).map(output => `
                            <div class="chatflow-node-port output" data-port="${output.id}">
                                <span class="chatflow-port-label">${output.name}</span>
                                <span class="chatflow-port-dot"></span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // ノードのイベントリスナー
        nodesContainer.querySelectorAll('.chatflow-node').forEach(nodeEl => {
            nodeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const node = this.#currentFlow.nodes.find(n => n.id === nodeEl.dataset.id);
                this.#selectNode(node);
            });

            // ドラッグでノード移動
            this.#setupNodeDrag(nodeEl);

            // ポートからの接続
            nodeEl.querySelectorAll('.chatflow-node-port').forEach(port => {
                port.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.#handlePortClick(nodeEl.dataset.id, port.dataset.port, port.classList.contains('output'));
                });
            });
        });

        // 接続線を描画
        this.#renderConnections();
    }

    /**
     * ノードドラッグをセットアップ
     * @param {HTMLElement} nodeEl
     */
    #setupNodeDrag(nodeEl) {
        const header = nodeEl.querySelector('.chatflow-node-header');
        let startX, startY, startLeft, startTop;

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            nodeEl.style.left = `${startLeft + dx / this.#zoom}px`;
            nodeEl.style.top = `${startTop + dy / this.#zoom}px`;
        };

        const onMouseUp = () => {
            const node = this.#currentFlow.nodes.find(n => n.id === nodeEl.dataset.id);
            if (node) {
                node.position.x = parseFloat(nodeEl.style.left);
                node.position.y = parseFloat(nodeEl.style.top);
            }
            this.#renderConnections();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        header.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseFloat(nodeEl.style.left) || 0;
            startTop = parseFloat(nodeEl.style.top) || 0;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /** @type {Object|null} 接続開始情報 */
    #connectionStart = null;

    /**
     * ポートクリック処理
     * @param {string} nodeId
     * @param {string} portId
     * @param {boolean} isOutput
     */
    #handlePortClick(nodeId, portId, isOutput) {
        if (isOutput) {
            // 出力ポートクリック - 接続開始
            this.#connectionStart = { nodeId, portId };
            this.#showStatus('入力ポートをクリックして接続');
        } else if (this.#connectionStart) {
            // 入力ポートクリック - 接続完了
            const connection = {
                id: `conn_${Date.now()}`,
                sourceNodeId: this.#connectionStart.nodeId,
                sourcePortId: this.#connectionStart.portId,
                targetNodeId: nodeId,
                targetPortId: portId
            };

            // 重複チェック
            const exists = this.#currentFlow.connections.some(c =>
                c.sourceNodeId === connection.sourceNodeId &&
                c.targetNodeId === connection.targetNodeId
            );

            if (!exists && this.#connectionStart.nodeId !== nodeId) {
                this.#currentFlow.connections.push(connection);
                this.#renderConnections();
                this.#showStatus('接続を作成しました');
            }

            this.#connectionStart = null;
        }
    }

    /**
     * 接続線を描画
     */
    #renderConnections() {
        const svg = this.#modal.querySelector('.chatflow-connections');
        const nodesContainer = this.#modal.querySelector('.chatflow-nodes');

        let paths = '';

        this.#currentFlow.connections.forEach(conn => {
            const sourceNode = nodesContainer.querySelector(`[data-id="${conn.sourceNodeId}"]`);
            const targetNode = nodesContainer.querySelector(`[data-id="${conn.targetNodeId}"]`);

            if (!sourceNode || !targetNode) return;

            const sourcePort = sourceNode.querySelector(`.output[data-port="${conn.sourcePortId}"] .chatflow-port-dot`);
            const targetPort = targetNode.querySelector(`.input[data-port="${conn.targetPortId}"] .chatflow-port-dot`);

            if (!sourcePort || !targetPort) return;

            const sourceRect = sourcePort.getBoundingClientRect();
            const targetRect = targetPort.getBoundingClientRect();
            const containerRect = nodesContainer.getBoundingClientRect();

            const x1 = (sourceRect.left + sourceRect.width / 2 - containerRect.left) / this.#zoom;
            const y1 = (sourceRect.top + sourceRect.height / 2 - containerRect.top) / this.#zoom;
            const x2 = (targetRect.left + targetRect.width / 2 - containerRect.left) / this.#zoom;
            const y2 = (targetRect.top + targetRect.height / 2 - containerRect.top) / this.#zoom;

            // ベジェ曲線
            const dx = Math.abs(x2 - x1) / 2;
            const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            paths += `<path d="${path}" class="chatflow-connection-path" data-conn-id="${conn.id}"/>`;
        });

        svg.innerHTML = paths;

        // 接続線クリックで削除
        svg.querySelectorAll('.chatflow-connection-path').forEach(path => {
            path.addEventListener('click', () => {
                if (confirm('この接続を削除しますか？')) {
                    const connId = path.dataset.connId;
                    this.#currentFlow.connections = this.#currentFlow.connections.filter(c => c.id !== connId);
                    this.#renderConnections();
                }
            });
        });
    }

    /**
     * ノードを選択
     * @param {Object|null} node
     */
    #selectNode(node) {
        this.#selectedNode = node;

        // 選択状態を更新
        this.#modal.querySelectorAll('.chatflow-node').forEach(el => {
            el.classList.toggle('selected', node && el.dataset.id === node.id);
        });

        // プロパティパネルを更新
        this.#renderProperties(node);
    }

    /**
     * プロパティパネルを描画
     * @param {Object|null} node
     */
    #renderProperties(node) {
        const content = this.#modal.querySelector('.chatflow-properties-content');

        if (!node) {
            content.innerHTML = '<p class="chatflow-properties-empty">ノードを選択してください</p>';
            return;
        }

        const nodeType = ChatFlowNodes.getInstance.getNodeType(node.type);
        if (!nodeType) {
            content.innerHTML = '<p class="chatflow-properties-empty">不明なノードタイプ</p>';
            return;
        }

        let html = `
            <div class="chatflow-property-header">
                <span>${nodeType.icon} ${nodeType.name}</span>
                <button class="chatflow-delete-node-btn" data-action="delete-node">削除</button>
            </div>
        `;

        if (nodeType.properties) {
            nodeType.properties.forEach(prop => {
                const value = node.properties[prop.name] ?? prop.default ?? '';
                html += this.#renderPropertyInput(prop, value, node.id);
            });
        }

        content.innerHTML = html;

        // イベントリスナー
        content.querySelector('[data-action="delete-node"]').addEventListener('click', () => {
            if (confirm('このノードを削除しますか？')) {
                this.#currentFlow.nodes = this.#currentFlow.nodes.filter(n => n.id !== node.id);
                this.#currentFlow.connections = this.#currentFlow.connections.filter(c =>
                    c.sourceNodeId !== node.id && c.targetNodeId !== node.id
                );
                this.#selectNode(null);
                this.#renderCanvas();
            }
        });

        content.querySelectorAll('[data-prop]').forEach(input => {
            input.addEventListener('change', (e) => {
                const propName = e.target.dataset.prop;
                let value = e.target.value;

                if (e.target.type === 'checkbox') {
                    value = e.target.checked;
                } else if (e.target.type === 'number') {
                    value = parseFloat(value);
                }

                node.properties[propName] = value;
            });
        });
    }

    /**
     * プロパティ入力を描画
     * @param {Object} prop
     * @param {*} value
     * @param {string} nodeId
     * @returns {string}
     */
    #renderPropertyInput(prop, value, nodeId) {
        let input = '';

        switch (prop.type) {
            case 'text':
                input = `<input type="text" data-prop="${prop.name}" value="${this.#escapeHtml(value)}">`;
                break;
            case 'textarea':
            case 'code':
                input = `<textarea data-prop="${prop.name}" rows="4">${this.#escapeHtml(value)}</textarea>`;
                break;
            case 'number':
                input = `<input type="number" data-prop="${prop.name}" value="${value}"
                         min="${prop.min ?? ''}" max="${prop.max ?? ''}" step="${prop.step ?? 'any'}">`;
                break;
            case 'checkbox':
                input = `<input type="checkbox" data-prop="${prop.name}" ${value ? 'checked' : ''}>`;
                break;
            case 'model-select':
                input = `<select data-prop="${prop.name}">
                    <option value="">-- 現在のモデルを使用 --</option>
                    ${this.#getModelOptions(value)}
                </select>`;
                break;
            default:
                input = `<input type="text" data-prop="${prop.name}" value="${this.#escapeHtml(value)}">`;
        }

        return `
            <div class="chatflow-property-group">
                <label class="chatflow-property-label">${prop.label || prop.name}</label>
                ${input}
            </div>
        `;
    }

    /**
     * モデル選択オプションを取得
     * @param {string} currentValue
     * @returns {string}
     */
    #getModelOptions(currentValue) {
        const models = window.CONFIG?.MODELS || {};
        let options = '';

        for (const [provider, modelList] of Object.entries(models)) {
            if (Array.isArray(modelList)) {
                modelList.forEach(model => {
                    const modelId = typeof model === 'object' ? model.id : model;
                    const modelName = typeof model === 'object' ? model.name : model;
                    options += `<option value="${modelId}" ${modelId === currentValue ? 'selected' : ''}>${modelName}</option>`;
                });
            }
        }

        return options;
    }

    /**
     * ズームを設定
     * @param {number} zoom
     */
    #setZoom(zoom) {
        this.#zoom = zoom;
        const canvas = this.#modal.querySelector('.chatflow-canvas');
        canvas.style.transform = `scale(${zoom})`;
        this.#modal.querySelector('.chatflow-zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    }

    /**
     * ステータスを表示
     * @param {string} message
     * @param {string} [type='info']
     */
    #showStatus(message, type = 'info') {
        const status = this.#modal.querySelector('.chatflow-status');
        status.textContent = message;
        status.className = `chatflow-status ${type}`;
    }

    /**
     * HTMLエスケープ
     * @param {string} text
     * @returns {string}
     */
    #escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * モーダルを表示
     */
    async show() {
        if (!this.#modal) {
            await this.initialize();
        }

        if (!this.#currentFlow) {
            this.#newFlow();
        }

        this.#modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    /**
     * モーダルを非表示
     */
    hide() {
        if (this.#modal) {
            this.#modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
}

// グローバルに公開
window.ChatFlowBuilderModal = ChatFlowBuilderModal;
