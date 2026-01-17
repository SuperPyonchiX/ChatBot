/**
 * workflowCanvas.js
 * ワークフロービジュアルキャンバス
 * ノードのドラッグ&ドロップ、接続線描画、ズーム/パン機能を提供
 */

class WorkflowCanvas {
    static #instance = null;

    /** @type {HTMLElement} */
    #container = null;

    /** @type {SVGElement} */
    #svg = null;

    /** @type {HTMLElement} */
    #nodesContainer = null;

    /** @type {NodeRegistry} */
    #nodeRegistry = null;

    /** @type {Map<string, HTMLElement>} */
    #nodeElements = new Map();

    /** @type {Map<string, SVGPathElement>} */
    #connectionElements = new Map();

    /** @type {Array} */
    #nodes = [];

    /** @type {Array} */
    #connections = [];

    /** @type {Object|null} */
    #selectedNode = null;

    /** @type {Object|null} */
    #selectedConnection = null;

    /** @type {Object} */
    #viewState = {
        zoom: 1,
        panX: 0,
        panY: 0
    };

    /** @type {Object|null} */
    #dragState = null;

    /** @type {Object|null} */
    #connectionDragState = null;

    /** @type {Object} */
    #eventListeners = {};

    /** @type {number} */
    #gridSize = 20;

    /** @type {boolean} */
    #snapToGrid = true;

    /**
     * @constructor
     */
    constructor() {
        if (WorkflowCanvas.#instance) {
            return WorkflowCanvas.#instance;
        }
        WorkflowCanvas.#instance = this;

        const config = window.CONFIG?.WORKFLOW?.CANVAS || {};
        this.#gridSize = config.GRID_SIZE || 20;
        this.#snapToGrid = config.SNAP_TO_GRID !== false;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {WorkflowCanvas}
     */
    static get getInstance() {
        if (!WorkflowCanvas.#instance) {
            WorkflowCanvas.#instance = new WorkflowCanvas();
        }
        return WorkflowCanvas.#instance;
    }

    /**
     * キャンバスを初期化
     * @param {HTMLElement} container - コンテナ要素
     */
    initialize(container) {
        this.#container = container;
        this.#nodeRegistry = window.NodeRegistry?.getInstance || new NodeRegistry();

        this.#createCanvasStructure();
        this.#setupEventListeners();

        console.log('[WorkflowCanvas] 初期化完了');
    }

    /**
     * キャンバス構造を作成
     */
    #createCanvasStructure() {
        this.#container.innerHTML = '';
        this.#container.classList.add('workflow-canvas-container');

        // SVGレイヤー（接続線用）
        this.#svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.#svg.classList.add('workflow-connections-layer');
        this.#svg.innerHTML = `
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-color, #10a37f)" />
                </marker>
                <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-hover, #0d8a6a)" />
                </marker>
            </defs>
            <g class="connections-group"></g>
            <path class="connection-preview" style="display: none;" />
        `;
        this.#container.appendChild(this.#svg);

        // ノードレイヤー
        this.#nodesContainer = document.createElement('div');
        this.#nodesContainer.classList.add('workflow-nodes-layer');
        this.#container.appendChild(this.#nodesContainer);

        // グリッド背景
        this.#updateGridBackground();
    }

    /**
     * イベントリスナーをセットアップ
     */
    #setupEventListeners() {
        // キャンバスクリック
        this.#container.addEventListener('click', (e) => {
            if (e.target === this.#container || e.target === this.#nodesContainer) {
                this.#deselectAll();
            }
        });

        // ドラッグ操作
        this.#container.addEventListener('mousedown', this.#handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.#handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.#handleMouseUp.bind(this));

        // ズーム
        this.#container.addEventListener('wheel', this.#handleWheel.bind(this), { passive: false });

        // キーボード
        document.addEventListener('keydown', this.#handleKeyDown.bind(this));

        // ドロップ
        this.#container.addEventListener('dragover', (e) => e.preventDefault());
        this.#container.addEventListener('drop', this.#handleDrop.bind(this));
    }

    /**
     * マウスダウンハンドラ
     * @param {MouseEvent} e
     */
    #handleMouseDown(e) {
        const nodeElement = e.target.closest('.workflow-node');
        const portElement = e.target.closest('.node-port');

        if (portElement && nodeElement) {
            // ポートからの接続ドラッグ開始
            const nodeId = nodeElement.dataset.nodeId;
            const portName = portElement.dataset.portName;
            const portType = portElement.dataset.portType;

            if (portType === 'output') {
                this.#startConnectionDrag(nodeId, portName, e);
            }
            e.stopPropagation();
        } else if (nodeElement) {
            // ノードドラッグ開始
            const nodeId = nodeElement.dataset.nodeId;
            this.#selectNode(nodeId);
            this.#startNodeDrag(nodeId, e);
            e.stopPropagation();
        } else if (e.target === this.#container || e.target === this.#nodesContainer) {
            // キャンバスパン開始
            this.#startPan(e);
        }
    }

    /**
     * マウスムーブハンドラ
     * @param {MouseEvent} e
     */
    #handleMouseMove(e) {
        if (this.#dragState) {
            if (this.#dragState.type === 'node') {
                this.#updateNodeDrag(e);
            } else if (this.#dragState.type === 'pan') {
                this.#updatePan(e);
            }
        }

        if (this.#connectionDragState) {
            this.#updateConnectionDrag(e);
        }
    }

    /**
     * マウスアップハンドラ
     * @param {MouseEvent} e
     */
    #handleMouseUp(e) {
        if (this.#connectionDragState) {
            this.#endConnectionDrag(e);
        }

        this.#dragState = null;
    }

    /**
     * ホイールハンドラ（ズーム）
     * @param {WheelEvent} e
     */
    #handleWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.25, Math.min(2, this.#viewState.zoom * delta));

        // ズーム中心をマウス位置に
        const rect = this.#container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomRatio = newZoom / this.#viewState.zoom;
        this.#viewState.panX = mouseX - (mouseX - this.#viewState.panX) * zoomRatio;
        this.#viewState.panY = mouseY - (mouseY - this.#viewState.panY) * zoomRatio;
        this.#viewState.zoom = newZoom;

        this.#applyViewTransform();
        this.#emit('zoomChange', { zoom: newZoom });
    }

    /**
     * キーダウンハンドラ
     * @param {KeyboardEvent} e
     */
    #handleKeyDown(e) {
        if (!this.#container.contains(document.activeElement) &&
            document.activeElement !== document.body) {
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.#selectedNode) {
                this.deleteNode(this.#selectedNode.id);
            } else if (this.#selectedConnection) {
                this.deleteConnection(this.#selectedConnection.id);
            }
            e.preventDefault();
        }

        // Ctrl+A で全選択
        if (e.ctrlKey && e.key === 'a') {
            // 将来の実装用
            e.preventDefault();
        }
    }

    /**
     * ドロップハンドラ
     * @param {DragEvent} e
     */
    #handleDrop(e) {
        e.preventDefault();

        const nodeType = e.dataTransfer.getData('nodeType');
        if (!nodeType) return;

        const rect = this.#container.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.#viewState.panX) / this.#viewState.zoom;
        const y = (e.clientY - rect.top - this.#viewState.panY) / this.#viewState.zoom;

        const snappedX = this.#snapToGrid ? Math.round(x / this.#gridSize) * this.#gridSize : x;
        const snappedY = this.#snapToGrid ? Math.round(y / this.#gridSize) * this.#gridSize : y;

        this.addNode(nodeType, { x: snappedX, y: snappedY });
    }

    // ========================================
    // ノード操作
    // ========================================

    /**
     * ノードを追加
     * @param {string} type - ノードタイプ
     * @param {Object} [position] - 位置
     * @returns {Object} 追加されたノード
     */
    addNode(type, position = { x: 100, y: 100 }) {
        const node = this.#nodeRegistry.createNode(type, null, position);
        this.#nodes.push(node);

        this.#renderNode(node);
        this.#selectNode(node.id);

        this.#emit('nodeAdded', { node });
        return node;
    }

    /**
     * ノードを削除
     * @param {string} nodeId
     */
    deleteNode(nodeId) {
        const nodeIndex = this.#nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex < 0) return;

        const node = this.#nodes[nodeIndex];

        // 関連する接続を削除
        const relatedConnections = this.#connections.filter(
            c => c.sourceNodeId === nodeId || c.targetNodeId === nodeId
        );
        for (const conn of relatedConnections) {
            this.deleteConnection(conn.id);
        }

        // ノードを削除
        this.#nodes.splice(nodeIndex, 1);
        const element = this.#nodeElements.get(nodeId);
        if (element) {
            element.remove();
            this.#nodeElements.delete(nodeId);
        }

        if (this.#selectedNode?.id === nodeId) {
            this.#selectedNode = null;
        }

        this.#emit('nodeDeleted', { nodeId, node });
    }

    /**
     * ノードを描画
     * @param {Object} node
     */
    #renderNode(node) {
        const definition = this.#nodeRegistry.get(node.type);
        if (!definition) return;

        const element = document.createElement('div');
        element.classList.add('workflow-node');
        element.dataset.nodeId = node.id;
        element.style.left = `${node.position.x}px`;
        element.style.top = `${node.position.y}px`;
        element.style.setProperty('--node-color', definition.color);

        element.innerHTML = `
            <div class="node-header">
                <span class="node-icon">${definition.icon}</span>
                <span class="node-title">${definition.name}</span>
            </div>
            <div class="node-ports">
                <div class="node-inputs">
                    ${Object.entries(definition.inputs).map(([name, port]) => `
                        <div class="node-port input-port" data-port-name="${name}" data-port-type="input">
                            <div class="port-dot"></div>
                            <span class="port-label">${port.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="node-outputs">
                    ${Object.entries(definition.outputs).map(([name, port]) => `
                        <div class="node-port output-port" data-port-name="${name}" data-port-type="output">
                            <span class="port-label">${port.label}</span>
                            <div class="port-dot"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // ダブルクリックでプロパティパネルを開く
        element.addEventListener('dblclick', () => {
            this.#emit('nodeDoubleClick', { nodeId: node.id, node });
        });

        this.#nodesContainer.appendChild(element);
        this.#nodeElements.set(node.id, element);
    }

    /**
     * ノードを選択
     * @param {string} nodeId
     */
    #selectNode(nodeId) {
        this.#deselectAll();

        const node = this.#nodes.find(n => n.id === nodeId);
        if (!node) return;

        this.#selectedNode = node;
        const element = this.#nodeElements.get(nodeId);
        if (element) {
            element.classList.add('selected');
        }

        this.#emit('nodeSelected', { nodeId, node });
    }

    /**
     * 選択を解除
     */
    #deselectAll() {
        if (this.#selectedNode) {
            const element = this.#nodeElements.get(this.#selectedNode.id);
            if (element) {
                element.classList.remove('selected');
            }
            this.#selectedNode = null;
        }

        if (this.#selectedConnection) {
            const element = this.#connectionElements.get(this.#selectedConnection.id);
            if (element) {
                element.classList.remove('selected');
            }
            this.#selectedConnection = null;
        }

        this.#emit('selectionCleared', {});
    }

    // ========================================
    // ノードドラッグ
    // ========================================

    /**
     * ノードドラッグ開始
     * @param {string} nodeId
     * @param {MouseEvent} e
     */
    #startNodeDrag(nodeId, e) {
        const element = this.#nodeElements.get(nodeId);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        this.#dragState = {
            type: 'node',
            nodeId: nodeId,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        };

        element.classList.add('dragging');
    }

    /**
     * ノードドラッグ更新
     * @param {MouseEvent} e
     */
    #updateNodeDrag(e) {
        if (this.#dragState?.type !== 'node') return;

        const containerRect = this.#container.getBoundingClientRect();
        let x = (e.clientX - containerRect.left - this.#dragState.offsetX - this.#viewState.panX) / this.#viewState.zoom;
        let y = (e.clientY - containerRect.top - this.#dragState.offsetY - this.#viewState.panY) / this.#viewState.zoom;

        if (this.#snapToGrid) {
            x = Math.round(x / this.#gridSize) * this.#gridSize;
            y = Math.round(y / this.#gridSize) * this.#gridSize;
        }

        const node = this.#nodes.find(n => n.id === this.#dragState.nodeId);
        if (node) {
            node.position.x = Math.max(0, x);
            node.position.y = Math.max(0, y);

            const element = this.#nodeElements.get(node.id);
            if (element) {
                element.style.left = `${node.position.x}px`;
                element.style.top = `${node.position.y}px`;
            }

            this.#updateConnectionsForNode(node.id);
        }
    }

    // ========================================
    // パン操作
    // ========================================

    /**
     * パン開始
     * @param {MouseEvent} e
     */
    #startPan(e) {
        this.#dragState = {
            type: 'pan',
            startX: e.clientX,
            startY: e.clientY,
            startPanX: this.#viewState.panX,
            startPanY: this.#viewState.panY
        };

        this.#container.style.cursor = 'grabbing';
    }

    /**
     * パン更新
     * @param {MouseEvent} e
     */
    #updatePan(e) {
        if (this.#dragState?.type !== 'pan') return;

        this.#viewState.panX = this.#dragState.startPanX + (e.clientX - this.#dragState.startX);
        this.#viewState.panY = this.#dragState.startPanY + (e.clientY - this.#dragState.startY);

        this.#applyViewTransform();
    }

    // ========================================
    // 接続操作
    // ========================================

    /**
     * 接続ドラッグ開始
     * @param {string} nodeId
     * @param {string} portName
     * @param {MouseEvent} e
     */
    #startConnectionDrag(nodeId, portName, e) {
        const node = this.#nodes.find(n => n.id === nodeId);
        const element = this.#nodeElements.get(nodeId);
        if (!node || !element) return;

        const port = element.querySelector(`.output-port[data-port-name="${portName}"] .port-dot`);
        if (!port) return;

        const portRect = port.getBoundingClientRect();
        const containerRect = this.#container.getBoundingClientRect();

        this.#connectionDragState = {
            sourceNodeId: nodeId,
            sourcePort: portName,
            startX: (portRect.left + portRect.width / 2 - containerRect.left - this.#viewState.panX) / this.#viewState.zoom,
            startY: (portRect.top + portRect.height / 2 - containerRect.top - this.#viewState.panY) / this.#viewState.zoom
        };

        const preview = this.#svg.querySelector('.connection-preview');
        preview.style.display = 'block';
    }

    /**
     * 接続ドラッグ更新
     * @param {MouseEvent} e
     */
    #updateConnectionDrag(e) {
        if (!this.#connectionDragState) return;

        const containerRect = this.#container.getBoundingClientRect();
        const endX = (e.clientX - containerRect.left - this.#viewState.panX) / this.#viewState.zoom;
        const endY = (e.clientY - containerRect.top - this.#viewState.panY) / this.#viewState.zoom;

        const path = this.#calculateConnectionPath(
            this.#connectionDragState.startX,
            this.#connectionDragState.startY,
            endX,
            endY
        );

        const preview = this.#svg.querySelector('.connection-preview');
        preview.setAttribute('d', path);
    }

    /**
     * 接続ドラッグ終了
     * @param {MouseEvent} e
     */
    #endConnectionDrag(e) {
        if (!this.#connectionDragState) return;

        const preview = this.#svg.querySelector('.connection-preview');
        preview.style.display = 'none';

        // ドロップ先のポートを確認
        const portElement = e.target.closest('.input-port');
        const nodeElement = e.target.closest('.workflow-node');

        if (portElement && nodeElement) {
            const targetNodeId = nodeElement.dataset.nodeId;
            const targetPort = portElement.dataset.portName;

            if (targetNodeId !== this.#connectionDragState.sourceNodeId) {
                this.addConnection(
                    this.#connectionDragState.sourceNodeId,
                    this.#connectionDragState.sourcePort,
                    targetNodeId,
                    targetPort
                );
            }
        }

        this.#connectionDragState = null;
    }

    /**
     * 接続を追加
     * @param {string} sourceNodeId
     * @param {string} sourcePort
     * @param {string} targetNodeId
     * @param {string} targetPort
     */
    addConnection(sourceNodeId, sourcePort, targetNodeId, targetPort) {
        // 重複チェック
        const exists = this.#connections.some(c =>
            c.sourceNodeId === sourceNodeId &&
            c.sourcePort === sourcePort &&
            c.targetNodeId === targetNodeId &&
            c.targetPort === targetPort
        );

        if (exists) return;

        const connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceNodeId,
            sourcePort,
            targetNodeId,
            targetPort
        };

        this.#connections.push(connection);
        this.#renderConnection(connection);

        this.#emit('connectionAdded', { connection });
    }

    /**
     * 接続を削除
     * @param {string} connectionId
     */
    deleteConnection(connectionId) {
        const index = this.#connections.findIndex(c => c.id === connectionId);
        if (index < 0) return;

        const connection = this.#connections[index];
        this.#connections.splice(index, 1);

        const element = this.#connectionElements.get(connectionId);
        if (element) {
            element.remove();
            this.#connectionElements.delete(connectionId);
        }

        if (this.#selectedConnection?.id === connectionId) {
            this.#selectedConnection = null;
        }

        this.#emit('connectionDeleted', { connectionId, connection });
    }

    /**
     * 接続を描画
     * @param {Object} connection
     */
    #renderConnection(connection) {
        const sourceElement = this.#nodeElements.get(connection.sourceNodeId);
        const targetElement = this.#nodeElements.get(connection.targetNodeId);

        if (!sourceElement || !targetElement) return;

        const sourcePort = sourceElement.querySelector(`.output-port[data-port-name="${connection.sourcePort}"] .port-dot`);
        const targetPort = targetElement.querySelector(`.input-port[data-port-name="${connection.targetPort}"] .port-dot`);

        if (!sourcePort || !targetPort) return;

        const { startX, startY, endX, endY } = this.#getConnectionCoordinates(sourcePort, targetPort);
        const pathD = this.#calculateConnectionPath(startX, startY, endX, endY);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('workflow-connection');
        path.setAttribute('d', pathD);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.dataset.connectionId = connection.id;

        path.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#selectConnection(connection.id);
        });

        const group = this.#svg.querySelector('.connections-group');
        group.appendChild(path);
        this.#connectionElements.set(connection.id, path);
    }

    /**
     * ノードに関連する接続を更新
     * @param {string} nodeId
     */
    #updateConnectionsForNode(nodeId) {
        for (const connection of this.#connections) {
            if (connection.sourceNodeId === nodeId || connection.targetNodeId === nodeId) {
                const element = this.#connectionElements.get(connection.id);
                if (!element) continue;

                const sourceElement = this.#nodeElements.get(connection.sourceNodeId);
                const targetElement = this.#nodeElements.get(connection.targetNodeId);

                if (!sourceElement || !targetElement) continue;

                const sourcePort = sourceElement.querySelector(`.output-port[data-port-name="${connection.sourcePort}"] .port-dot`);
                const targetPort = targetElement.querySelector(`.input-port[data-port-name="${connection.targetPort}"] .port-dot`);

                if (!sourcePort || !targetPort) continue;

                const { startX, startY, endX, endY } = this.#getConnectionCoordinates(sourcePort, targetPort);
                const pathD = this.#calculateConnectionPath(startX, startY, endX, endY);
                element.setAttribute('d', pathD);
            }
        }
    }

    /**
     * 接続の座標を取得
     * @param {HTMLElement} sourcePort
     * @param {HTMLElement} targetPort
     * @returns {Object}
     */
    #getConnectionCoordinates(sourcePort, targetPort) {
        const containerRect = this.#container.getBoundingClientRect();
        const sourceRect = sourcePort.getBoundingClientRect();
        const targetRect = targetPort.getBoundingClientRect();

        return {
            startX: (sourceRect.left + sourceRect.width / 2 - containerRect.left - this.#viewState.panX) / this.#viewState.zoom,
            startY: (sourceRect.top + sourceRect.height / 2 - containerRect.top - this.#viewState.panY) / this.#viewState.zoom,
            endX: (targetRect.left + targetRect.width / 2 - containerRect.left - this.#viewState.panX) / this.#viewState.zoom,
            endY: (targetRect.top + targetRect.height / 2 - containerRect.top - this.#viewState.panY) / this.#viewState.zoom
        };
    }

    /**
     * 接続パスを計算（ベジェ曲線）
     * @param {number} startX
     * @param {number} startY
     * @param {number} endX
     * @param {number} endY
     * @returns {string}
     */
    #calculateConnectionPath(startX, startY, endX, endY) {
        const dx = Math.abs(endX - startX);
        const controlOffset = Math.min(dx * 0.5, 100);

        return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    }

    /**
     * 接続を選択
     * @param {string} connectionId
     */
    #selectConnection(connectionId) {
        this.#deselectAll();

        const connection = this.#connections.find(c => c.id === connectionId);
        if (!connection) return;

        this.#selectedConnection = connection;
        const element = this.#connectionElements.get(connectionId);
        if (element) {
            element.classList.add('selected');
            element.setAttribute('marker-end', 'url(#arrowhead-selected)');
        }

        this.#emit('connectionSelected', { connectionId, connection });
    }

    // ========================================
    // ビュー操作
    // ========================================

    /**
     * ビュー変換を適用
     */
    #applyViewTransform() {
        const transform = `translate(${this.#viewState.panX}px, ${this.#viewState.panY}px) scale(${this.#viewState.zoom})`;
        this.#nodesContainer.style.transform = transform;
        this.#svg.style.transform = transform;

        this.#updateGridBackground();
    }

    /**
     * グリッド背景を更新
     */
    #updateGridBackground() {
        const scaledGridSize = this.#gridSize * this.#viewState.zoom;
        const offsetX = this.#viewState.panX % scaledGridSize;
        const offsetY = this.#viewState.panY % scaledGridSize;

        this.#container.style.backgroundSize = `${scaledGridSize}px ${scaledGridSize}px`;
        this.#container.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    }

    /**
     * ズームレベルを設定
     * @param {number} zoom
     */
    setZoom(zoom) {
        this.#viewState.zoom = Math.max(0.25, Math.min(2, zoom));
        this.#applyViewTransform();
        this.#emit('zoomChange', { zoom: this.#viewState.zoom });
    }

    /**
     * ビューをリセット
     */
    resetView() {
        this.#viewState = { zoom: 1, panX: 0, panY: 0 };
        this.#applyViewTransform();
    }

    /**
     * コンテンツに合わせてビューを調整
     */
    fitToContent() {
        if (this.#nodes.length === 0) {
            this.resetView();
            return;
        }

        const padding = 50;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const node of this.#nodes) {
            const element = this.#nodeElements.get(node.id);
            if (!element) continue;

            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + element.offsetWidth);
            maxY = Math.max(maxY, node.position.y + element.offsetHeight);
        }

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        const containerWidth = this.#container.clientWidth;
        const containerHeight = this.#container.clientHeight;

        const zoom = Math.min(
            containerWidth / contentWidth,
            containerHeight / contentHeight,
            1
        );

        this.#viewState.zoom = zoom;
        this.#viewState.panX = (containerWidth - contentWidth * zoom) / 2 - minX * zoom + padding * zoom;
        this.#viewState.panY = (containerHeight - contentHeight * zoom) / 2 - minY * zoom + padding * zoom;

        this.#applyViewTransform();
    }

    // ========================================
    // データ操作
    // ========================================

    /**
     * ワークフローデータを取得
     * @returns {Object}
     */
    getWorkflowData() {
        return {
            nodes: this.#nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: { ...n.position },
                properties: { ...n.properties }
            })),
            connections: this.#connections.map(c => ({ ...c }))
        };
    }

    /**
     * ワークフローデータを読み込み
     * @param {Object} data
     */
    loadWorkflowData(data) {
        this.clear();

        // ノードを読み込み
        for (const nodeData of (data.nodes || [])) {
            const definition = this.#nodeRegistry.get(nodeData.type);
            if (!definition) continue;

            const node = {
                ...nodeData,
                _definition: definition
            };
            this.#nodes.push(node);
            this.#renderNode(node);
        }

        // 接続を読み込み
        for (const connData of (data.connections || [])) {
            this.#connections.push(connData);
            this.#renderConnection(connData);
        }

        this.fitToContent();
    }

    /**
     * キャンバスをクリア
     */
    clear() {
        this.#nodes = [];
        this.#connections = [];
        this.#nodeElements.clear();
        this.#connectionElements.clear();
        this.#selectedNode = null;
        this.#selectedConnection = null;

        this.#nodesContainer.innerHTML = '';
        this.#svg.querySelector('.connections-group').innerHTML = '';

        this.resetView();
    }

    /**
     * 選択中のノードを取得
     * @returns {Object|null}
     */
    getSelectedNode() {
        return this.#selectedNode;
    }

    /**
     * ノードのプロパティを更新
     * @param {string} nodeId
     * @param {Object} properties
     */
    updateNodeProperties(nodeId, properties) {
        const node = this.#nodes.find(n => n.id === nodeId);
        if (node) {
            node.properties = { ...node.properties, ...properties };
            this.#emit('nodePropertiesChanged', { nodeId, properties: node.properties });
        }
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
                    console.error(`[WorkflowCanvas] イベントハンドラエラー (${event}):`, error);
                }
            }
        }
    }
}

// グローバルに公開
window.WorkflowCanvas = WorkflowCanvas;
