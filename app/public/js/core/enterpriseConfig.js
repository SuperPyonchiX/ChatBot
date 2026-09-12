/* Browser/server shared limits. Loaded immediately after config.js. */
(function () {
    const settings = Object.freeze({
        ENDPOINT: '/api/enterprise/read', SEARCH_LIMIT: 10, COMMENT_LIMIT: 20,
        CONTENT_LIMIT: 20000, TIMEOUT_MS: 30000, RESPONSE_LIMIT: 5000000,
        RESULT_LIMIT: 40000, COMMENT_SCAN_LIMIT: 500, COMMENT_PAGE_SIZE: 100
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = settings;
    else window.CONFIG.ENTERPRISE = settings;
})();
