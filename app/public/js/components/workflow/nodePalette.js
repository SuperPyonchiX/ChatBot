/**
 * nodePalette.js
 * ノードパレット - ドラッグ可能なノードタイプ一覧
 */

class NodePalette {
    static #instance = null;

    /** @type {HTMLElement} */
    #container = null;

    /** @type {NodeRegistry} */
    #nodeRegistry = null;

    /** @type {string} */
    #searchQuery = '';

    /** @type {string|null} */
    #selectedCategory = null;

    /**
     * @constructor
     */
    constructor() {
        if (NodePalette.#instance) {
            return NodePalette.#instance;
        }
        NodePalette.#instance = this;
    }

    /**
     * シングルトンインスタンスを取得
     * @returns {NodePalette}
     */
    static get getInstance() {
        if (!NodePalette.#instance) {
            NodePalette.#instance = new NodePalette();
        }
        return NodePalette.#instance;
    }

    /**
     * パレットを初期化
     * @param {HTMLElement} container
     */
    initialize(container) {
        this.#container = container;
        this.#nodeRegistry = window.NodeRegistry?.getInstance || new NodeRegistry();

        this.#render();
        console.log('[NodePalette] 初期化完了');
    }

    /**
     * パレットを描画
     */
    #render() {
        this.#container.innerHTML = '';
        this.#container.classList.add('node-palette');

        // 検索バー
        const searchBar = document.createElement('div');
        searchBar.classList.add('palette-search');
        searchBar.innerHTML = `
            <input type="text" placeholder="ノードを検索..." class="palette-search-input">
            <span class="palette-search-icon">🔍</span>
        `;
        this.#container.appendChild(searchBar);

        const searchInput = searchBar.querySelector('input');
        searchInput.addEventListener('input', (e) => {
            this.#searchQuery = e.target.value.toLowerCase();
            this.#renderCategories();
        });

        // カテゴリコンテナ
        const categoriesContainer = document.createElement('div');
        categoriesContainer.classList.add('palette-categories');
        this.#container.appendChild(categoriesContainer);

        this.#renderCategories();
    }

    /**
     * カテゴリを描画
     */
    #renderCategories() {
        const categoriesContainer = this.#container.querySelector('.palette-categories');
        categoriesContainer.innerHTML = '';

        const categorizedNodes = this.#nodeRegistry.getByCategory();

        for (const [categoryId, category] of Object.entries(categorizedNodes)) {
            // フィルタリング
            const filteredNodes = category.nodes.filter(node =>
                node.name.toLowerCase().includes(this.#searchQuery) ||
                node.type.toLowerCase().includes(this.#searchQuery)
            );

            if (filteredNodes.length === 0) continue;

            const categoryElement = document.createElement('div');
            categoryElement.classList.add('palette-category');
            categoryElement.dataset.categoryId = categoryId;

            const isExpanded = this.#selectedCategory === null || this.#selectedCategory === categoryId;

            categoryElement.innerHTML = `
                <div class="category-header ${isExpanded ? 'expanded' : ''}">
                    <span class="category-icon">${category.icon}</span>
                    <span class="category-name">${category.name}</span>
                    <span class="category-count">${filteredNodes.length}</span>
                    <span class="category-toggle">${isExpanded ? '▼' : '▶'}</span>
                </div>
                <div class="category-nodes ${isExpanded ? '' : 'collapsed'}">
                    ${filteredNodes.map(node => this.#renderNodeItem(node)).join('')}
                </div>
            `;

            // カテゴリヘッダーのクリック
            const header = categoryElement.querySelector('.category-header');
            header.addEventListener('click', () => {
                const nodesContainer = categoryElement.querySelector('.category-nodes');
                const toggle = categoryElement.querySelector('.category-toggle');
                const isCurrentlyExpanded = !nodesContainer.classList.contains('collapsed');

                if (isCurrentlyExpanded) {
                    nodesContainer.classList.add('collapsed');
                    header.classList.remove('expanded');
                    toggle.textContent = '▶';
                } else {
                    nodesContainer.classList.remove('collapsed');
                    header.classList.add('expanded');
                    toggle.textContent = '▼';
                }
            });

            // ノードアイテムのドラッグ設定
            const nodeItems = categoryElement.querySelectorAll('.palette-node-item');
            nodeItems.forEach(item => {
                item.draggable = true;
                item.addEventListener('dragstart', this.#handleDragStart.bind(this));
                item.addEventListener('dragend', this.#handleDragEnd.bind(this));
            });

            categoriesContainer.appendChild(categoryElement);
        }
    }

    /**
     * ノードアイテムのHTMLを生成
     * @param {Object} node
     * @returns {string}
     */
    #renderNodeItem(node) {
        return `
            <div class="palette-node-item" data-node-type="${node.type}">
                <div class="node-item-icon" style="color: ${node.color}">${node.icon}</div>
                <div class="node-item-info">
                    <div class="node-item-name">${node.name}</div>
                    <div class="node-item-type">${node.type}</div>
                </div>
            </div>
        `;
    }

    /**
     * ドラッグ開始ハンドラ
     * @param {DragEvent} e
     */
    #handleDragStart(e) {
        const nodeType = e.target.closest('.palette-node-item')?.dataset.nodeType;
        if (!nodeType) return;

        e.dataTransfer.setData('nodeType', nodeType);
        e.dataTransfer.effectAllowed = 'copy';

        // ドラッグ中のスタイル
        e.target.classList.add('dragging');

        // ドラッグイメージをカスタマイズ
        const dragImage = e.target.cloneNode(true);
        dragImage.classList.add('drag-ghost');
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 40, 20);

        setTimeout(() => dragImage.remove(), 0);
    }

    /**
     * ドラッグ終了ハンドラ
     * @param {DragEvent} e
     */
    #handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    /**
     * 検索をクリア
     */
    clearSearch() {
        this.#searchQuery = '';
        const searchInput = this.#container.querySelector('.palette-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        this.#renderCategories();
    }

    /**
     * カテゴリをフィルタ
     * @param {string|null} categoryId
     */
    filterByCategory(categoryId) {
        this.#selectedCategory = categoryId;
        this.#renderCategories();
    }

    /**
     * すべてのカテゴリを展開
     */
    expandAll() {
        const nodesContainers = this.#container.querySelectorAll('.category-nodes');
        const headers = this.#container.querySelectorAll('.category-header');
        const toggles = this.#container.querySelectorAll('.category-toggle');

        nodesContainers.forEach(container => container.classList.remove('collapsed'));
        headers.forEach(header => header.classList.add('expanded'));
        toggles.forEach(toggle => toggle.textContent = '▼');
    }

    /**
     * すべてのカテゴリを折りたたむ
     */
    collapseAll() {
        const nodesContainers = this.#container.querySelectorAll('.category-nodes');
        const headers = this.#container.querySelectorAll('.category-header');
        const toggles = this.#container.querySelectorAll('.category-toggle');

        nodesContainers.forEach(container => container.classList.add('collapsed'));
        headers.forEach(header => header.classList.remove('expanded'));
        toggles.forEach(toggle => toggle.textContent = '▶');
    }
}

// グローバルに公開
window.NodePalette = NodePalette;
