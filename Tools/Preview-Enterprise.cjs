// Isolated local preview with synthetic data. No production credentials or AI calls.
// Run: node Tools/Preview-Enterprise.cjs (Ctrl+C stops the preview).
const express = require('../app/node_modules/express');
const path = require('node:path');
const { registerEnterpriseRoutes } = require('../app/server/enterpriseRoutes');
const app = express();
registerEnterpriseRoutes(app);
app.get('/fixture/rest/api/2/myself', (req, res) => res.json({ name: 'demo' }));
app.get('/fixture/rest/api/space', (req, res) => res.json({ size: 1, results: [{ key: 'DOC', name: 'Demo' }] }));
app.get('/fixture/rest/api/2/search', (req, res) => res.json({ startAt: 0, total: 1, issues: [{ key: 'TEST-1', fields: { summary: 'Demo issue', status: { name: 'In Progress' } } }] }));
app.get('/fixture/rest/api/2/issue/TEST-1', (req, res) => res.json({ key: 'TEST-1', fields: { summary: 'Demo issue', description: 'The review is in progress.', status: { name: 'In Progress' }, updated: '2026-09-12', parent: { key: 'TEST-2', fields: { summary: 'Parent' } } } }));
app.get('/fixture/rest/api/2/issue/TEST-1/comment', (req, res) => res.json({ total: 1, comments: [{ id: '1', body: 'Waiting for review.', author: { displayName: 'Demo' } }] }));
app.get('/fixture/rest/api/content/search', (req, res) => res.json({ results: [{ id: '42', title: 'Demo page' }], _links: {} }));
app.get('/fixture/rest/api/content/42', (req, res) => res.json({ id: '42', title: 'Demo page', version: { when: '2026-09-12' }, body: { storage: { value: '<h2>Review</h2><table><tr><th>Issue</th><th>Status</th></tr><tr><td>TEST-1</td><td>In Progress</td></tr></table><ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">TEST-1</ac:parameter></ac:structured-macro><p><a href="/fixture/browse/TEST-1">Issue</a></p>' } } }));
app.get('/fixture/rest/api/content/42/child/comment', (req, res) => res.json({ results: [{ id: 'c1', version: { when: '2026-09-12' }, body: { storage: { value: '<p>Review requested</p>' } } }], _links: {} }));
app.get('/enterprise-check', (req, res) => res.sendFile(path.join(__dirname, '../tests/fixtures/enterprise-browser.html')));
app.use(express.static(path.join(__dirname, '../app/public')));
const server = app.listen(0, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${server.address().port}\nSynthetic base URL: http://127.0.0.1:${server.address().port}/fixture\nBrowser checks: /enterprise-check`));
