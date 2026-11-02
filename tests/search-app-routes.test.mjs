import test, {after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

// Mount the actual application components. The Vite transform only exposes existing
// module bindings; component source, hooks, handlers, and toolbar are unchanged.
const {JSDOM} = createRequire(import.meta.url)('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'https://synthetic.test', pretendToBeVisual: true});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLButtonElement', 'MutationObserver', 'CustomEvent', 'Event', 'Element', 'Node', 'NodeFilter', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// JSDOM does not lay out elements; resize observer delivery is outside these DOM tests.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
// Isolate cross-tab notifications as well as HTTP: no live browser tabs or Node handles.
const originalBroadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class { postMessage() {} close() {} }; 
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const el = React.createElement;
const rootPath = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const vite = await createServer({
  appType: 'custom', configFile: false,
  resolve: {alias: {'@': rootPath}},
  plugins: [{name: 'expose-app-components-for-mounted-tests', enforce: 'pre', transform(source, id) {
    if (id === `${rootPath}/app/page.tsx`) return `${source}\nexport {UserManagementV2, DepartmentManagement, PermissionManagement, BomLookupView, BomChangeContent, LeadtimeMasterView, SafetyRulesView, BulkEngineView, PlanningView, DemandEventViewV3, WarehouseContent, BusinessSkuContext, BomSourceSkuContext, initialSystemUsers, loadSystemUsers, WorkspaceSession};\n`;
  }}],
  server: {middlewareMode: true, hmr: false},
});
const app = await vite.ssrLoadModule('/app/page.tsx');
const {clearClientReads} = await vite.ssrLoadModule('/lib/data-sync.ts');
const originalFetch = globalThis.fetch;
const requests = [];
const forbiddenRequests = [];
const forbiddenCallbacks = [];
const masterRows = ['ALPHA', 'BETA'].map(label => ({
  code: `TEST-${label}`, name: `Synthetic ${label}`, specification: `Spec ${label}`,
  group: `Group ${label}`, line: `Line ${label}`, unit: 'PCS', mode: 'Sản xuất',
  confirmation_status: 'Đã xác nhận', usage_status: 'Đang sử dụng', status: 'Đã xác nhận',
}));
const users = ['ALPHA', 'BETA'].map(label => ({company: 'SHINTUNG', department: `TEST-${label}`, login: `test.${label.toLowerCase()}`, name: `Synthetic ${label}`, email: '', phone: '', mobile: '', role: 'USER', active: true}));
const departments = ['ALPHA', 'BETA'].map(label => ({code: `TEST-${label}`, name: `Synthetic ${label}`, company: `Company ${label}`, description: '', active: true}));
const record = (key, payload) => ({key, payload, revision: 'test-revision', updatedAt: '2026-10-01T00:00:00Z'});
const stock = (label, suffix = '') => ({sku: `TEST-${label}${suffix}`, name: `Synthetic ${label}${suffix}`, spec: 'Test', unit: 'PCS', warehouse: 'TP', location: 'TEST', lot: 'TEST', qty: 20, onHand: 20, updated: '2026-10-01'});
const boms = masterRows.map(row => ({sku: row.code, name: row.name, spec: row.specification, unit: row.unit, category: row.group, status: row.code.endsWith('ALPHA') ? 'Đã xác nhận' : 'Nháp', setup: '2026-10-01', confirmedDate: '2026-10-01', confirmedBy: 'test', items: [{stt: '1', code: `PART-${row.code}`, name: 'Synthetic component', spec: '', qty: '1', denominator: '1', unit: 'PCS', source: 'Mua', waste: '0'}]}));
const fixtureRecords = {
  sku: masterRows.map(row => record(row.code, row)),
  users: [...app.initialSystemUsers.map(row => record(row.login, {...row, _deleted: true})), ...users.map(row => record(row.login, row))],
  departments: departments.map(row => record(row.code, row)),
  permissions: users.map(row => record(row.login, {...row, permissions: '', permissionMode: 'DEPARTMENT'})),
  bom: boms.map(row => record(row.sku, row)),
  bom_change: ['ALPHA', 'BETA'].map((label, i) => record(`TEST-CHANGE-${label}`, {id: `TEST-CHANGE-${label}`, sku: `TEST-${label}`, skus: [`TEST-${label}`], name: `Synthetic ${label}`, status: i ? 'Đã xác nhận' : 'Chờ xác nhận', setupDate: '2026-10-01', date: '01/10/2026', updatedAt: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', createdBy: 'test', updatedBy: 'test', reason: 'Synthetic test', rows: [], items: []})),
  leadtime: masterRows.map(row => record(row.code, {sku: row.code, leadTime: 7, updatedBy: 'test', updatedAt: '2026-10-01T00:00:00Z'})),
  safety_rule_groups: ['ALPHA', 'BETA'].map((label, i) => record(`TEST-SAFETY-${label}`, {id: `TEST-SAFETY-${label}`, code: `TEST-SAFETY-${label}`, name: `Synthetic ${label}`, group: 'leadtime', version: `V${i+10}`, status: i ? 'Nháp' : 'Chờ xác nhận', effectiveFrom: '2026-10-01', effectiveTo: '', createdBy: 'test', createdAt: '2026-10-01T00:00:00Z', updatedBy: 'test', updatedAt: '2026-10-01T00:00:00Z', rows: [{from: 1, to: 7, days: 7, status: 'Đang áp dụng'}], usedByPlans: []})),
  forecast: [record('10/2026', masterRows.map(row => ({month: '10/2026', applicationMonth: '10/2026', sourceReportMonth: '09/2026', group: row.group, sku: row.code, name: row.name, spec: row.specification, line: row.line, f30: 30, f60: 60, f90: 90, d30: 1, d60: 1, used: 1, d90: 1, warning: ''})))],
  demand_event: ['ALPHA', 'BETA'].map((label, i) => record(`TEST-DE-${label}`, {id: `TEST-DE-${label}`, requestDate: i ? '12/10/2026' : '01/10/2026', type: 'Phát sinh', sku: `TEST-${label}`, name: `Synthetic ${label}`, spec: 'Test', qty: 10, delivery: '20/10/2026', priority: 'Thường', order: `TEST-ORDER-${label}`, status: 'Chưa lập kế hoạch', plannedWeek: '2026-10-19', planningWeekStart: '2026-10-19', updatedBy: 'test', updatedAt: '2026-10-01T00:00:00Z'})),
  inventory: [
    record('TEST-STOCK-CURRENT', {weekKey: '2026-10-12', importedAt: '2026-10-12T00:00:00Z', importedBy: 'test', sourceFile: 'Synthetic current.xlsx', status: 'Chưa chốt', rows: [stock('ALPHA'), stock('BETA')]}),
    record('TEST-STOCK-OLDER', {weekKey: '2026-10-05', importedAt: '2026-10-05T00:00:00Z', importedBy: 'test', sourceFile: 'Synthetic older.xlsx', status: 'Chưa chốt', rows: [stock('ALPHA', '-OLDER')]}),
  ],
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input), 'https://synthetic.test');
  const method = String(init.method || 'GET').toUpperCase();
  requests.push({url: url.pathname + url.search, method});
  if (method !== 'GET' || url.origin !== 'https://synthetic.test') {
    forbiddenRequests.push({url: url.href, method});
    throw Error(`Only synthetic local GET fixtures are permitted: ${method} ${url.href}`);
  }
  if (url.pathname === '/api/records') return Response.json({records: structuredClone(fixtureRecords[url.searchParams.get('entity')] || []), total: 0});
  if (url.pathname === '/api/sku-capabilities') return Response.json({canConfirm: false});
  if (url.pathname === '/api/files') return Response.json({files: []});
  return Response.json({rows: [], records: [], files: [], groups: [], total: 0, authenticated: false});
};
beforeEach(() => {clearClientReads(); requests.length = 0; forbiddenRequests.length = 0; forbiddenCallbacks.length = 0;});
after(async () => {globalThis.fetch = originalFetch; globalThis.BroadcastChannel = originalBroadcastChannel; await vite.close(); dom.window.close();});
async function mount(component) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {await act(async () => {root.render(component);});} catch (error) {await act(async () => root.unmount()); host.remove(); throw error;}
  // Record-read cache clones bodies asynchronously, so allow their promise chains to settle.
  await act(async () => {await new Promise(resolve => setTimeout(resolve, 10));});
  return {host, async close() {await act(async () => root.unmount()); host.remove(); assert.deepEqual(forbiddenRequests, [], 'lookup must never issue a write or use a real endpoint'); assert.deepEqual(forbiddenCallbacks, [], 'lookup must not invoke mutation or navigation callbacks');}};
}
async function click(node) {assert.ok(node, 'expected visible button'); await act(async () => node.click());}
async function choose(node, value) {assert.ok(node, 'expected visible select'); await act(async () => {node.value = value; node.dispatchEvent(new window.Event('change', {bubbles: true}));}); assert.equal(node.value, value);}
async function change(node, value) {assert.ok(node, 'expected visible input'); await act(async () => {Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new window.Event('input', {bubbles: true}));}); assert.equal(node.value, value);}
async function enter(node, extra = {}) {assert.ok(node, 'expected Enter target'); await act(async () => node.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true, ...extra})));}
function button(host, label) {return [...host.querySelectorAll('button')].find(node => node.textContent.replace(/\s+/g, ' ').trim().includes(label));}
function tableText(host) {return [...host.querySelectorAll('tbody')].map(node => node.textContent.replace(/\s+/g, ' ').trim()).join('\n');}
function toolbar(host, name) {const result = host.querySelector(`[data-standard-toolbar="${name}"]`); assert.ok(result, `actual ${name} toolbar mounted`); return result;}
function category(bar) {return [...bar.querySelectorAll('label')].find(label => /TRA THEO/i.test(label.textContent))?.querySelector('select');}
function context(component) {return el(app.BusinessSkuContext.Provider, {value: masterRows}, el(app.BomSourceSkuContext.Provider, {value: masterRows}, component));}
const failWrite = () => {forbiddenCallbacks.push('unexpected mutation or navigation callback'); throw Error('lookup must not invoke mutation callback');};
const planRows = masterRows.map(row => ({id: row.code, sku: row.code, name: row.name, spec: row.specification, group: row.group, line: row.line, priority: 'Thường', suggested: 10, qty: 10, status: 'Chưa đưa vào kế hoạch', moq: 1}));
const metrics = new Map(planRows.map(row => [row.id, {weekLabel: '19–25/10/2026', month: '10/2026', dailyDemand: 1, eventWeek: 0, stock: 10, inTransit: 0, replenish: 4, moq: 1, transit: 0, leadTime: 7, safetyDays: 7, rop: 14, needed: 4, afterMoq: 4, reason: 'Synthetic fixture'}]));
// SKU Master is inside WorkspaceSession, not a separately exported component.
// Provide its normal read-only identity prop, retaining its real permission provider,
// navigation guards, SKU loader, table, and handlers. This does not test login/bootstrap.
const skuSession = {language: 'vi', authenticated: true, session: {kind: 'account', login: 'test.reader', name: 'Synthetic Reader', detail: 'Test', role: 'USER', isAdmin: false, grants: ['Dữ liệu cơ bản / SKU Master / Xem']}};
const routes = [
  {name: 'Home', make: () => el('div', {id: 'test-sku-session', className: 'workspace-session'}, el(app.WorkspaceSession, {initialRoute: {view: 'sku', child: 'sku-master', planTab: 'base'}, identity: skuSession, onIdentity: failWrite, onNavigate: failWrite, active: true, scopeId: 'test-sku-session', workspaceTabs: null})), textField: 'sku', textValue: 'TEST-ALPHA', selectField: 'group', selectValue: 'Group ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'UserManagementV2', prepare: () => app.loadSystemUsers(), make: () => el(app.UserManagementV2), textField: '2', textValue: 'test.alpha', selectField: '1', selectValue: 'TEST-ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'DepartmentManagement', make: () => el(app.DepartmentManagement), textField: 'code', textValue: 'TEST-ALPHA', selectField: 'company', selectValue: 'Company ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'PermissionManagement', make: () => el(app.PermissionManagement), textField: '1', textValue: 'test.alpha', selectField: '0', selectValue: 'TEST-ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'BomChangeContent', make: () => context(el(app.BomChangeContent, {operator: 'test'})), textField: 'document', textValue: 'TEST-CHANGE-ALPHA', selectField: 'status', selectValue: 'Chờ xác nhận', keep: 'TEST-CHANGE-ALPHA', remove: 'TEST-CHANGE-BETA'},
  {name: 'LeadtimeMasterView', make: () => el(app.LeadtimeMasterView, {masterSkus: masterRows, skuReadState: {hasData: true, error: null}, operator: 'test', language: 'vi', onOpenSkuMaster: failWrite, onListReset: failWrite}), textField: 'sku', textValue: 'TEST-ALPHA', selectField: 'group', selectValue: 'Group ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'SafetyRulesView', make: () => el(app.SafetyRulesView), textField: 'code', textValue: 'TEST-SAFETY-ALPHA', selectField: 'status', selectValue: 'Chờ xác nhận', keep: 'TEST-SAFETY-ALPHA', remove: 'TEST-SAFETY-BETA'},
  {name: 'BulkEngineView', make: () => el(app.BulkEngineView, {rows: planRows, metrics, week: '2026-10-19', onWeekChange: failWrite, onCalc: failWrite, onMove: failWrite, snapshotsLoaded: true, savedEngineReady: true, savedEngineLoading: false}), textField: 'sku', textValue: 'TEST-ALPHA', selectField: 'group', selectValue: 'Group ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'PlanningView', make: () => el(app.PlanningView, {tab: 'base', operator: 'test', masterRows}), textField: 'sku', textValue: 'TEST-ALPHA', selectField: 'group', selectValue: 'Group ALPHA', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
  {name: 'WarehouseContent', make: () => context(el(app.WarehouseContent, {section: 'inventory', operator: 'test', onOpenSku: failWrite})), textField: 'sku', textValue: 'TEST-ALPHA', selectField: 'week_import', selectValue: 'TEST-STOCK-OLDER', selectKeep: 'TEST-ALPHA-OLDER', keep: 'Synthetic ALPHA', remove: 'Synthetic BETA'},
];
for (const route of routes) {
  for (const kind of ['text', 'select']) {
    test(`actual app ${route.name}: ${kind} lookup keeps results until Enter and matches Search click`, async () => {
      const outputs = [];
      for (const method of ['enter', 'click']) {
        clearClientReads();
        await route.prepare?.();
        const view = await mount(route.make());
        try {
          const before = tableText(view.host);
          assert.ok(before.includes(route.keep), `fixture ${route.keep} present before lookup`);
          assert.ok(before.includes(route.remove), `fixture ${route.remove} present before lookup`);
          let bar = toolbar(view.host, route.name);
          await click(button(bar, 'Tra cứu'));
          assert.equal(tableText(view.host), before, 'opening lookup keeps current results');
          bar = toolbar(view.host, route.name);
          await choose(category(bar), route[`${kind}Field`]);
          assert.equal(tableText(view.host), before, 'choosing lookup category keeps current results');
          bar = toolbar(view.host, route.name);
          const field = [...bar.querySelectorAll('label')].find(label => /NỘI DUNG TRA/i.test(label.textContent));
          const input = kind === 'text' ? field?.querySelector('input') : field?.querySelector('select');
          if (kind === 'text') await change(input, route.textValue); else await choose(input, route.selectValue);
          assert.equal(tableText(view.host), before, 'draft value must not filter before Search/Enter');
          if (method === 'enter') {
            input.focus(); assert.equal(document.activeElement, input, 'lookup field has focus');
            for (const extra of [{isComposing: true}, {keyCode: 229}, {repeat: true}]) await enter(input, extra);
            assert.equal(tableText(view.host), before, 'IME and held Enter do not apply');
            if (kind === 'select') {input.matches = selector => selector === ':open'; await enter(input); assert.equal(tableText(view.host), before, 'open picker consumes Enter'); input.matches = () => false;}
            await enter(input);
            assert.equal(document.activeElement, input, 'search preserves field focus');
          } else await click(button(bar, 'Tìm kiếm'));
          const after = tableText(view.host);
          assert.ok(after.includes(route[`${kind}Keep`] || route.keep), 'matching result remains');
          assert.ok(!after.includes(route.remove), 'nonmatching result is removed');
          outputs.push(after);
        } finally {await view.close();}
      }
      assert.equal(outputs[0], outputs[1], 'Enter and clicking the real Search button give identical tables');
    });
  }
}

test('actual app DemandEventViewV3: date Enter performs the same read-only lookup as click', async () => {
  const outputs = [];
  for (const method of ['enter', 'click']) {
    clearClientReads();
    const view = await mount(el(app.DemandEventViewV3, {operator: 'test', masterRows}));
    try {
      const before = tableText(view.host);
      assert.ok(before.includes('Synthetic ALPHA') && before.includes('Synthetic BETA'));
      const bar = toolbar(view.host, 'DemandEventViewV3');
      const start = bar.querySelector('input[aria-label="Từ ngày"]');
      const end = bar.querySelector('input[aria-label="Đến ngày"]');
      await change(start, '2026-10-01'); await change(end, '2026-10-05');
      assert.equal(tableText(view.host), before);
      if (method === 'enter') await enter(end); else await click(button(bar, 'Tra dữ liệu'));
      await act(async () => {await new Promise(resolve => setTimeout(resolve, 10));});
      const after = tableText(view.host);
      assert.ok(after.includes('Synthetic ALPHA')); assert.ok(!after.includes('Synthetic BETA'));
      assert.ok(requests.some(request => request.url.includes('entity=demand_event') && request.method === 'GET'), 'actual component loaded its read-only source');
      outputs.push(after);
    } finally {await view.close();}
  }
  assert.equal(outputs[0], outputs[1]);
});

test('actual app BomLookupView: real text lookup applies synthetic BOM rows and matches click', async () => {
  const outputs = [];
  for (const method of ['enter', 'click']) {
    clearClientReads();
    // The existing BOM-change read path hydrates the shared BOM cache from fixtures.
    // No component code or callback is replaced to inject the test catalog.
    const loader = await mount(context(el(app.BomChangeContent, {operator: 'test'}))); await loader.close();
    const view = await mount(context(el(app.BomLookupView, {operator: 'test'})));
    try {
      const before = tableText(view.host);
      assert.ok(before.includes('TEST-ALPHA') && before.includes('TEST-BETA'));
      let bar = toolbar(view.host, 'BomLookupView'); await click(button(bar, 'Tra cứu'));
      assert.equal(tableText(view.host), before);
      bar = toolbar(view.host, 'BomLookupView'); await choose(category(bar), 'parentSku');
      const input = bar.querySelector('input'); await change(input, 'TEST-ALPHA');
      assert.equal(tableText(view.host), before);
      if (method === 'enter') await enter(input); else await click(button(bar, 'Tìm kiếm'));
      const after = tableText(view.host); assert.ok(after.includes('TEST-ALPHA')); assert.ok(!after.includes('TEST-BETA')); outputs.push(after);
      assert.equal(view.host.querySelector('.bom-detail-panel'), null, 'legacy raw Enter must not open a separate editor');
    } finally {await view.close();}
  }
  assert.equal(outputs[0], outputs[1]);
});

test('actual app SafetyRulesView: Clear and Back restore rows without mutations or a hidden results table', async () => {
  const view = await mount(el(app.SafetyRulesView));
  try {
    const before = tableText(view.host);
    let bar = toolbar(view.host, 'SafetyRulesView');
    await click(button(bar, 'Tra cứu')); await choose(category(bar), 'code');
    await change(bar.querySelector('input'), 'TEST-SAFETY-ALPHA'); await enter(bar.querySelector('input'));
    assert.ok(tableText(view.host).includes('TEST-SAFETY-ALPHA'));
    assert.ok(!tableText(view.host).includes('TEST-SAFETY-BETA'));
    await click(button(bar, 'Xóa lọc'));
    assert.equal(tableText(view.host), before, 'Clear restores the same visible table');
    await change(bar.querySelector('input'), 'TEST-SAFETY-BETA'); await enter(bar.querySelector('input'));
    assert.ok(!tableText(view.host).includes('TEST-SAFETY-ALPHA'));
    await click(button(bar, 'Quay lại'));
    assert.equal(tableText(view.host), before, 'Back restores table and clears search');
    bar = toolbar(view.host, 'SafetyRulesView'); assert.equal(category(bar), undefined);
    assert.equal(view.host.querySelector('form'), null, 'lookup did not open a rule mutation form');
  } finally {await view.close();}
});

test('actual app BomLookupView: closed status SELECT Enter matches click and an open picker keeps results', async () => {
  const outputs = [];
  for (const method of ['enter', 'click']) {
    clearClientReads();
    const loader = await mount(context(el(app.BomChangeContent, {operator: 'test'}))); await loader.close();
    const view = await mount(context(el(app.BomLookupView, {operator: 'test'})));
    try {
      const before = tableText(view.host);
      const bar = toolbar(view.host, 'BomLookupView'); await click(button(bar, 'Tra cứu'));
      await choose(category(bar), 'parentSku');
      const status = [...bar.querySelectorAll('label')].find(label => /TRẠNG THÁI BOM/i.test(label.textContent)).querySelector('select');
      await choose(status, 'Có thay đổi chờ xác nhận');
      assert.equal(tableText(view.host), before);
      if (method === 'enter') {
        status.focus(); status.matches = selector => selector === ':open'; await enter(status);
        assert.equal(tableText(view.host), before);
        status.matches = () => false; await enter(status);
      } else await click(button(bar, 'Tìm kiếm'));
      const after = tableText(view.host); assert.ok(after.includes('TEST-ALPHA')); assert.ok(!after.includes('TEST-BETA')); outputs.push(after);
    } finally {await view.close();}
  }
  assert.equal(outputs[0], outputs[1]);
});
