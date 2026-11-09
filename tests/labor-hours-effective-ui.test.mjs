import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const {JSDOM} = createRequire(import.meta.url)('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://synthetic.test', pretendToBeVisual: true,
});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement',
  'HTMLButtonElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLFormElement',
  'MutationObserver', 'CustomEvent', 'Event', 'Node', 'NodeFilter', 'getComputedStyle']) {
  globalThis[name] = dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const originalFetch = globalThis.fetch;
// Every request is synthetic. An unexpected path fails instead of contacting a service.
globalThis.fetch = async () => { throw Error('Unexpected unstubbed network request'); };
let harness;
const vite = await createServer({
  appType: 'custom', configFile: false,
  ssr: {noExternal: ['pdfjs-dist']},
  resolve: {alias: {'@': fileURLToPath(new URL('..', import.meta.url))}},
  server: {middlewareMode: true, hmr: false},
  plugins: [{
    name: 'labor-hours-ui-fixtures', enforce: 'pre',
    resolveId(id) {
      if (id === 'pdfjs-dist/legacy/build/pdf.mjs') return '\0test-labor-pdf';
    },
    load(id) {
      if (id === '\0test-labor-pdf') return `
        export const GlobalWorkerOptions = {};
        export function getDocument() {
          globalThis.__laborHoursUi.pdfReads++;
          return {promise: Promise.resolve({numPages: 1,
            async getPage() { return {async getTextContent() {
              return {items: globalThis.__laborHoursUi.pdfItems};
            }}; },
            async destroy() { globalThis.__laborHoursUi.pdfDestroyed++; }
          })};
        }
      `;
      if (id.endsWith('/lib/data-sync.ts')) return `
        export const apiFetch = (...args) => globalThis.__laborHoursUi.fetch(...args);
        export const useDataRefresh = () => 0;
      `;
      // These unrelated workflows are not exercised by the rate/history tests.
      if (id.endsWith('/components/production-plan.tsx')) return 'export function invalidateLaborPlanCache() {}';
      if (id.endsWith('/components/basic-master-cancel.tsx')) return 'export const useMasterCancellation = () => ({dialog: null, busy: false, open() {}});';
      if (id.endsWith('/lib/client-action-audit.ts')) return 'export function recordClientAttempt() {}';
    },
  }],
});
const {default: LaborHoursImport} = await vite.ssrLoadModule('/components/labor-hours-import.tsx');
const {ActionFeedbackHost} = await vite.ssrLoadModule('/components/action-feedback.tsx');
const {clearActionFeedback} = await vite.ssrLoadModule('/lib/action-feedback.ts');
let masterModule = 0;
after(async () => {
  globalThis.fetch = originalFetch;
  delete globalThis.__laborHoursUi;
  await vite.close();
  dom.window.close();
});

const masters = [{code: '123ABC', name: 'Synthetic product', specification: 'Test only',
  group: 'TEST', line: 'L1', status: 'Đã xác nhận', confirmation_status: 'Đã xác nhận',
  usage_status: 'Đang sử dụng'}];
const version = (id, validFrom, value, extra = {}) => ({
  id, validFrom, validTo: null, value, status: 'published', revision: 1, ...extra,
});
function reset({records = [], history = [], pdfHour = 0.75, onPost} = {}) {
  clearActionFeedback();
  harness = {
    records: structuredClone(records), history: structuredClone(history),
    requests: [], pdfReads: 0, pdfDestroyed: 0, saved: 0, closed: 0,
    pdfItems: [
      {str: 'GIỜ CÔNG CHUẨN', transform: [1, 0, 0, 1, 300, 700]},
      {str: '123ABC', transform: [1, 0, 0, 1, 30, 600]},
      {str: String(pdfHour), transform: [1, 0, 0, 1, 300, 600]},
    ],
    async fetch(url, init = {}) {
      const method = init.method || 'GET';
      const body = init.body ? JSON.parse(init.body) : undefined;
      harness.requests.push({url, method, body});
      if (url === '/api/records?entity=labor_hours') {
        return Response.json({records: harness.records.map(payload => ({key: payload.sku, payload}))});
      }
      if (url === '/api/records?entity=labor_hours_history&sku=123ABC') {
        return Response.json({records: harness.history.map(payload => ({key: payload.id, payload}))});
      }
      if (url === '/api/labor-hours' && method === 'POST' && onPost) return onPost(body);
      throw Error(`Unexpected synthetic request: ${method} ${url}`);
    },
  };
  globalThis.__laborHoursUi = harness;
  return harness;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function mount(Component, props) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(React.Fragment, null,
      React.createElement(ActionFeedbackHost), React.createElement(Component, props)));
    await tick();
  });
  return {host, async close() { await act(async () => root.unmount()); host.remove(); }};
}
const mountImport = () => mount(LaborHoursImport, {
  masterSkus: masters, onClose() { harness.closed++; },
  async onSaved() { harness.saved++; },
});
async function mountMaster() {
  // A unique module instance isolates the component's intentionally retained read cache.
  const {default: Component} = await vite.ssrLoadModule(`/components/labor-hours-master.tsx?fixture=${++masterModule}`);
  return mount(Component, {masterSkus: masters, operator: 'SYNTHETIC', language: 'vi', onListReset() {}});
}
const button = (host, label) => [...host.querySelectorAll('button')].find(node => node.textContent.trim() === label);
const saveButton = host => button(host, 'Lưu');
async function click(node) {
  assert.ok(node, 'Expected an available control');
  await act(async () => { node.click(); await tick(); });
}
async function change(node, value) {
  assert.ok(node, 'Expected an input');
  const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new Event('input', {bubbles: true}));
    node.dispatchEvent(new Event('change', {bubbles: true}));
    await tick();
  });
}
async function upload(view) {
  const input = view.host.querySelector('input[type=file]');
  const file = new dom.window.File(['Synthetic PDF bytes'], 'synthetic-hours.pdf', {type: 'application/pdf'});
  Object.defineProperty(file, 'arrayBuffer', {value: async () => new Uint8Array([1, 2, 3]).buffer});
  Object.defineProperty(input, 'files', {configurable: true, value: [file]});
  await act(async () => {
    input.dispatchEvent(new Event('change', {bubbles: true}));
    await tick();
  });
  // The first dynamic Vite module load can outlive a fixed number of event-loop
  // ticks. Wait for the visible completion condition, not machine speed.
  for (let attempt = 0; !saveButton(view.host) && attempt < 200; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  }
  assert.ok(saveButton(view.host), 'PDF processing must finish before inspecting its preview');
}
const posts = () => harness.requests.filter(request => request.method === 'POST');

test('PDF loaded before date stays unsaved; date changes re-evaluate effective versions without reread or mutation', async () => {
  const state = reset({records: [{sku: '123ABC', laborHour: 0.75, version: 3, effectiveVersions: [
    version('jan', '2026-01-01', 0.25, {validTo: '2026-07-01'}),
    version('jul', '2026-07-01', 0.5, {validTo: '2027-01-01'}),
    version('future', '2027-01-01', 0.75),
  ]}]});
  const view = await mountImport();
  try {
    await upload(view);
    assert.match(view.host.textContent, /Đã đọc 1 mã/);
    assert.equal(view.host.querySelector('input[type=date]').value, '');
    assert.equal(saveButton(view.host).disabled, true);
    assert.doesNotMatch(view.host.textContent, /Đã khớp:/);
    assert.equal(state.pdfReads, 1);
    assert.equal(state.pdfDestroyed, 1);
    assert.equal(state.requests.length, 1);

    await change(view.host.querySelector('input[type=date]'), '2026-01-01');
    assert.match(view.host.textContent, /Cập nhật: 1 · Đã khớp: 0/);
    assert.equal(saveButton(view.host).disabled, false, 'The scalar equals the PDF, but the selected historical rate differs');
    await change(view.host.querySelector('input[type=date]'), '2027-01-01');
    assert.match(view.host.textContent, /Cập nhật: 0 · Đã khớp: 1/);
    assert.equal(saveButton(view.host).disabled, true);
    await change(view.host.querySelector('input[type=date]'), '2026-12-31');
    assert.match(view.host.textContent, /Cập nhật: 1 · Đã khớp: 0/);
    await change(view.host.querySelector('input[type=date]'), '');
    assert.equal(saveButton(view.host).disabled, true);
    assert.doesNotMatch(view.host.textContent, /Đã khớp:/);
    assert.equal(state.requests.length, 1, 'Changing or clearing the date is a local comparison');
    assert.equal(state.pdfReads, 1);
    assert.equal(posts().length, 0);
  } finally { await view.close(); }
});

test('PDF comparison recognizes the latest linked same-day revision rather than the superseded rate', async () => {
  reset({pdfHour: 0.5, records: [{sku: '123ABC', laborHour: 0.25, version: 2, effectiveVersions: [
    version('original', '2026-01-01', 0.25),
    version('correction', '2026-01-01', 0.5, {revision: 2, supersedesVersionId: 'original'}),
  ]}]});
  const view = await mountImport();
  try {
    await change(view.host.querySelector('input[type=date]'), '2026-01-01');
    await upload(view);
    assert.match(view.host.textContent, /Cập nhật: 0 · Đã khớp: 1/);
    assert.equal(saveButton(view.host).disabled, true);
    assert.equal(posts().length, 0);
  } finally { await view.close(); }
});

test('future PDF save succeeds while today scalar differs and repeated pending/finished clicks cannot duplicate it', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const state = reset({records: [{sku: '123ABC', laborHour: 0.5, version: 7, note: 'Keep note', effectiveVersions: [
    version('current', '2026-01-01', 0.5),
  ]}], async onPost(body) {
    await pending;
    state.records = [{...state.records[0], version: 8, effectiveVersions: [
      version('current', '2026-01-01', 0.5, {validTo: body.effectiveFrom}),
      version('future', body.effectiveFrom, body.laborHour, {revision: 8}),
    ]}];
    return Response.json({ok: true});
  }});
  const view = await mountImport();
  try {
    await upload(view);
    await change(view.host.querySelector('input[type=date]'), '2099-01-01');
    const save = saveButton(view.host);
    await act(async () => { save.click(); save.click(); await tick(); });
    assert.equal(posts().length, 1);
    assert.deepEqual(posts()[0].body, {
      mode: 'edit', sku: '123ABC', laborHour: 0.75, expectedVersion: 7, note: 'Keep note',
      reason: 'Đối chiếu PDF: synthetic-hours.pdf', source: 'PDF', effectiveFrom: '2099-01-01',
    });
    assert.equal(view.host.querySelector('input[type=date]').disabled, true);
    const pendingSave = button(view.host, 'Đang lưu…');
    assert.equal(pendingSave.disabled, true);
    await click(pendingSave.parentElement);
    assert.equal(posts().length, 1);
    await act(async () => { release(); await tick(); await tick(); });
    assert.equal(state.records[0].laborHour, 0.5, 'Today projection intentionally remains unchanged');
    assert.match(view.host.textContent, /Đã cập nhật giờ công thành công: 1 mã đã lưu/);
    assert.doesNotMatch(view.host.textContent, /Chưa lưu đầy đủ|còn cần cập nhật/);
    assert.match(view.host.textContent, /Cập nhật: 0 · Đã khớp: 1/);
    assert.equal(state.saved, 1);
    assert.equal(saveButton(view.host).disabled, true);
    await click(saveButton(view.host).parentElement);
    assert.equal(posts().length, 1);
    assert.equal(state.requests.filter(request => request.method === 'GET').length, 2);
  } finally { release(); await view.close(); }
});

test('ambiguous effective history blocks PDF writes instead of comparing the today scalar', async () => {
  reset({records: [{sku: '123ABC', laborHour: 0.75, version: 2, effectiveVersions: [
    version('a', '2026-01-01', 0.25), version('b', '2026-02-01', 0.5),
  ]}]});
  const view = await mountImport();
  try {
    await upload(view);
    await change(view.host.querySelector('input[type=date]'), '2026-03-01');
    assert.match(view.host.textContent, /Lịch sử hiệu lực cần đối chiếu/);
    assert.match(view.host.textContent, /Bỏ qua: 1/);
    assert.equal(saveButton(view.host).disabled, true);
    assert.equal(posts().length, 0);
  } finally { await view.close(); }
});

test('master history separates effective day from recorded time and distinguishes missing values from zero', async () => {
  reset({records: [{sku: '123ABC', laborHour: null, version: 3, note: '', source: 'PDF'}], history: [
    {id: 'revision', sku: '123ABC', version: 3, effectiveFrom: '2026-01-01',
      oldLaborHour: null, newLaborHour: 0, reason: 'Synthetic correction', actor: 'TEST',
      at: '2026-11-09T20:30:00Z', supersedesVersionId: 'earlier', source: 'PDF'},
    {id: 'legacy', sku: '123ABC', version: 1, reason: 'Synthetic legacy', actor: 'TEST',
      at: '2026-10-31T01:00:00Z', source: 'PDF'},
  ]});
  const view = await mountMaster();
  try {
    const row = view.host.querySelector('.labor-hours-card tbody tr');
    assert.equal(row.querySelectorAll('td')[5].textContent.trim(), '—');
    await click(row);
    await click([...view.host.querySelectorAll('button')].find(node => /Lịch sử/.test(node.textContent)));
    const panel = view.host.querySelector('.labor-history-panel');
    assert.ok(panel);
    assert.deepEqual([...panel.querySelectorAll('th')].map(node => node.textContent), [
      'PHIÊN BẢN', 'NGÀY HIỆU LỰC', 'NHÓM SẢN PHẨM', 'TÊN SẢN PHẨM',
      'GIỜ CŨ', 'GIỜ MỚI', 'LÝ DO', 'NGƯỜI THAY ĐỔI', 'THỜI GIAN',
    ]);
    const [revision, legacy] = panel.querySelectorAll('tbody tr');
    const cells = [...revision.querySelectorAll('td')].map(node => node.textContent.trim());
    assert.equal(cells[1], '01/01/2026');
    assert.equal(cells[4], '—');
    assert.equal(cells[5], '0.000');
    assert.equal(cells[8], '10/11/2026 03:30:00', 'Recorded time is shown in Vietnam, independent of effective day');
    const legacyCells = [...legacy.querySelectorAll('td')].map(node => node.textContent.trim());
    assert.equal(legacyCells[1], 'Chưa ghi nhận', 'Do not infer effective day from recorded time');
    assert.equal(legacyCells[4], '—');
    assert.equal(legacyCells[5], '—');
    await click(revision);
    const detail = panel.querySelector('.labor-history-detail');
    const fields = Object.fromEntries([...detail.querySelectorAll('dl > div')].map(node => [
      node.querySelector('dt').textContent, node.querySelector('dd').textContent.trim(),
    ]));
    assert.equal(fields['Ngày hiệu lực'], '01/01/2026');
    assert.equal(fields['Loại cập nhật'], 'Sửa mức cùng ngày, giữ phiên bản trước');
    assert.equal(fields['Giờ công cũ'], '—');
    assert.equal(fields['Giờ công mới'], '0.000');
    assert.equal(posts().length, 0);
  } finally { await view.close(); }
});

test('master direct save carries effective day and guards repeated form submissions while pending', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const state = reset({records: [{sku: '123ABC', laborHour: 0.5, version: 4, note: '', source: 'PDF'}],
    async onPost() { await pending; return Response.json({ok: true}); },
  });
  const view = await mountMaster();
  try {
    await click(view.host.querySelector('.labor-hours-card tbody tr'));
    await click([...view.host.querySelectorAll('button')].find(node => /Sửa/.test(node.textContent)));
    const form = view.host.querySelector('form');
    await change(form.querySelector('input[type=date]'), '2026-01-01');
    await change(form.querySelector('input[type=number]'), '0.750');
    await change([...form.querySelectorAll('textarea')].find(node => node.required), 'Synthetic same-day correction');
    await act(async () => {
      form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      await tick();
    });
    assert.equal(posts().length, 1, 'Repeated submits must not create multiple same-day revisions');
    assert.equal(posts()[0].body.effectiveFrom, '2026-01-01');
    assert.equal(posts()[0].body.expectedVersion, 4);
    assert.equal(posts()[0].body.laborHour, 0.75);
    assert.equal(posts()[0].body.reason, 'Synthetic same-day correction');
    await act(async () => { release(); await tick(); await tick(); });
    assert.equal(view.host.querySelector('form'), null);
    assert.match(view.host.textContent, /Đã lưu 123ABC: 0.750 giờ\/sản phẩm/);
    assert.equal(state.requests.filter(request => request.method === 'GET').length, 2);
  } finally {
    await act(async () => { release(); await tick(); await tick(); });
    await view.close();
  }
});

test('editing an unconfigured master rate leaves it blank and requires an explicit value, including explicit zero', async () => {
  reset({records: [{sku: '123ABC', laborHour: null, version: 2, note: '', source: 'PDF'}],
    async onPost() { return Response.json({ok: true}); },
  });
  const view = await mountMaster();
  try {
    await click(view.host.querySelector('.labor-hours-card tbody tr'));
    await click([...view.host.querySelectorAll('button')].find(node => /Sửa/.test(node.textContent)));
    const form = view.host.querySelector('form');
    const hour = form.querySelector('input[type=number]');
    assert.equal(hour.value, '', 'A missing rate is not prefilled with zero');
    await change(form.querySelector('input[type=date]'), '2026-01-01');
    await change([...form.querySelectorAll('textarea')].find(node => node.required), 'Synthetic explicit zero');
    await act(async () => {
      form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      await tick();
    });
    assert.equal(posts().length, 0, 'The submit handler must reject an empty rate even without native validation');
    assert.match(form.textContent, /Giờ công\/SP phải là số không âm/);
    await change(hour, '0');
    await click(saveButton(form));
    assert.equal(posts().length, 1);
    assert.equal(posts()[0].body.laborHour, 0);
    assert.equal(posts()[0].body.effectiveFrom, '2026-01-01');
    assert.match(view.host.textContent, /Đã lưu 123ABC: 0.000 giờ\/sản phẩm/);
  } finally { await view.close(); }
});
