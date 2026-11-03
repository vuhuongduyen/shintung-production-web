import test, {after, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const {JSDOM} = createRequire(import.meta.url)('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'https://synthetic.test'});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLSelectElement', 'MutationObserver', 'CustomEvent', 'Event', 'Node', 'NodeFilter', 'getComputedStyle', 'localStorage']) {
  globalThis[name] = dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const vite = await createServer({
  appType: 'custom', configFile: false,
  resolve: {alias: {'@': fileURLToPath(new URL('..', import.meta.url))}},
  server: {middlewareMode: true, hmr: false},
});
const {default: UserPermissionSetup} = await vite.ssrLoadModule('/components/user-permission-setup.tsx');
const {ActionFeedbackHost} = await vite.ssrLoadModule('/components/action-feedback.tsx');
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
after(async () => { await vite.close(); dom.window.close(); });

const endpoint = '/api/user-permission-setup';
const existing = 'Dữ liệu cơ bản / SKU Master / Xem';
const viewGrant = 'Quản lý sản xuất / Báo công sản xuất / Xem';
const addGrant = 'Quản lý sản xuất / Báo công sản xuất / Thêm';
const otherGrant = 'Quản lý kho / Tồn kho ERP / Xem';
const labels = {
  preview: 'Xem trước quyền bổ sung',
  apply: 'Xác nhận bổ sung quyền',
  edit: 'Sửa lựa chọn',
  back: 'Quay lại',
};

function listing(revision = 'revision-1') {
  return {
    revision,
    users: [
      {login: 'foo', name: 'Synthetic Foo', department: 'QLSX', active: true, eligible: true, reason: '', before: [existing]},
      {login: 'bar', name: 'Synthetic Bar', department: 'QC', active: true, eligible: true, reason: '', before: [viewGrant]},
      {login: 'inactive', name: 'Synthetic Inactive', department: 'QLSX', active: false, eligible: false, reason: 'User ngưng hoạt động', before: [existing]},
      {login: 'admin', name: 'Synthetic Admin', department: 'ADMIN', active: true, eligible: false, reason: 'Admin đã có toàn quyền', before: []},
    ],
    catalog: [
      {group: 'Quản lý sản xuất', menus: [{label: 'Báo công sản xuất', grants: [viewGrant, addGrant]}]},
      {group: 'Quản lý kho', menus: [{label: 'Tồn kho ERP', grants: [otherGrant]}]},
    ],
  };
}

function previewFor(body, source = listing(), previewToken = 'preview-1') {
  const users = body.selectedLogins.map(login => {
    const user = source.users.find(candidate => candidate.login === login);
    const added = body.grants.filter(grant => !user.before.includes(grant));
    return {login, name: user.name, department: user.department, before: user.before, added, after: [...user.before, ...added]};
  });
  return {
    revision: source.revision, previewToken,
    selectedLogins: body.selectedLogins, grants: body.grants, users,
    changedUsers: users.filter(user => user.added.length > 0).length,
  };
}

function fakeApi(handler = () => Response.json(listing())) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    assert.equal(String(input), endpoint, 'mounted UI only uses its permission setup API');
    const call = {method: (init.method || 'GET').toUpperCase(), body: init.body ? JSON.parse(init.body) : null};
    calls.push(call);
    return handler(call, calls);
  };
  return {calls, posts: () => calls.filter(call => call.method === 'POST').map(call => call.body)};
}

const button = (host, label) => [...host.querySelectorAll('button')].find(node => node.textContent.trim() === label);
const checkbox = (host, label) => [...host.querySelectorAll('input[type="checkbox"]')].find(node => node.getAttribute('aria-label') === label);
const alerts = host => [...host.querySelectorAll('[role="alert"]')].map(node => node.textContent).join('\n');
const click = async node => {
  assert.ok(node, 'the expected control is mounted');
  await act(async () => { node.click(); });
};
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); };

async function mount(t) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const callbacks = [];
  let closed = false;
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(ActionFeedbackHost),
    React.createElement(UserPermissionSetup, {
      onApplied: () => callbacks.push('applied'),
      onClose: () => callbacks.push('closed'),
    }),
  )));
  const close = async () => {
    if (closed) return;
    closed = true;
    await act(async () => root.unmount());
    host.remove();
  };
  t.after(close);
  await settle();
  return {host, callbacks, close};
}

async function selectOne(host) {
  await click(checkbox(host, 'Chọn user foo'));
  await click(checkbox(host, addGrant));
}

test('opening and selecting users or grants is read-only, with no default or ineligible selection', async t => {
  const api = fakeApi();
  const {host, callbacks} = await mount(t);
  assert.deepEqual(api.calls, [{method: 'GET', body: null}]);
  assert.ok(host.querySelector('[role="dialog"]'));
  assert.equal([...host.querySelectorAll('input[type="checkbox"]')].some(node => node.checked), false);
  assert.equal(checkbox(host, 'Chọn user foo').disabled, false);
  assert.equal(checkbox(host, 'Chọn user bar').disabled, false);
  for (const login of ['inactive', 'admin']) {
    assert.equal(checkbox(host, `Chọn user ${login}`).disabled, true);
    await click(checkbox(host, `Chọn user ${login}`));
    assert.equal(checkbox(host, `Chọn user ${login}`).checked, false);
  }
  assert.match(host.textContent, /User ngưng hoạt động/);
  assert.match(host.textContent, /Admin đã có toàn quyền/);
  assert.equal(button(host, labels.preview).disabled, true);
  assert.equal(button(host, labels.apply), undefined);
  await click(checkbox(host, 'Chọn user foo'));
  assert.equal(button(host, labels.preview).disabled, true, 'a user alone is not a complete selection');
  await click(checkbox(host, addGrant));
  assert.equal(button(host, labels.preview).disabled, false);
  await click(checkbox(host, 'Chọn user bar'));
  await click(checkbox(host, 'Chọn user bar'));
  assert.deepEqual(api.posts(), []);
  assert.deepEqual(callbacks, []);
  await click(button(host, labels.back));
  assert.deepEqual(callbacks, ['closed']);
  assert.deepEqual(api.posts(), []);
});

test('preview contains only explicit users and grants; only confirmation applies its exact token and selection', async t => {
  let preview;
  const api = fakeApi(call => {
    if (call.method === 'GET') return Response.json(listing());
    if (call.body.action === 'preview') {
      preview = previewFor(call.body);
      return Response.json(preview);
    }
    return Response.json({ok: true, users: preview.users, changedUsers: preview.changedUsers, auditId: 'synthetic-audit'});
  });
  const {host, callbacks} = await mount(t);
  await click(checkbox(host, 'Chọn user bar'));
  await click(checkbox(host, 'Chọn user foo'));
  await click(checkbox(host, addGrant));
  await click(checkbox(host, viewGrant));
  await click(button(host, labels.preview));
  const selection = {expectedRevision: 'revision-1', selectedLogins: ['bar', 'foo'], grants: [addGrant, viewGrant]};
  assert.deepEqual(api.posts(), [{action: 'preview', ...selection}]);
  assert.deepEqual(callbacks, []);
  assert.ok(button(host, labels.apply));
  assert.match(host.textContent, /trước/i);
  assert.match(host.textContent, /[Bb]ổ sung/);
  assert.match(host.textContent, /sau/i);
  for (const value of ['Synthetic Foo', 'Synthetic Bar', existing, addGrant, viewGrant]) {
    assert.ok(host.textContent.includes(value), `preview displays ${value}`);
  }
  const rows = [...host.querySelectorAll('section[aria-label="Xem trước quyền bổ sung"] tbody tr')];
  assert.equal(rows.length, 2, 'preview contains only the selected users');
  const [bar, foo] = rows.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent));
  assert.match(bar[0], /^bar/);
  assert.ok(bar[1].includes(viewGrant), 'existing permission is retained');
  assert.ok(bar[2].includes(addGrant));
  assert.equal(bar[2].includes(viewGrant), false, 'an existing permission is not counted as newly added');
  assert.equal(bar[3], '2 quyền');
  assert.match(foo[0], /^foo/);
  assert.ok(foo[1].includes(existing));
  assert.ok(foo[2].includes(addGrant));
  assert.ok(foo[2].includes(viewGrant));
  assert.equal(foo[3], '3 quyền');
  await click(button(host, labels.apply));
  assert.deepEqual(api.posts(), [
    {action: 'preview', ...selection},
    {action: 'apply', ...selection, previewToken: 'preview-1', confirmed: true},
  ]);
  assert.deepEqual(callbacks, ['applied', 'closed']);
});

test('a preview with no new rights cannot submit an unnecessary apply', async t => {
  const api = fakeApi(call => Response.json(call.method === 'GET' ? listing() : previewFor(call.body)));
  const {host, callbacks} = await mount(t);
  await click(checkbox(host, 'Chọn user bar'));
  await click(checkbox(host, viewGrant));
  await click(button(host, labels.preview));
  assert.match(host.textContent, /Đã có đủ quyền đã chọn/);
  const confirm = button(host, labels.apply);
  assert.equal(confirm.disabled, true);
  await click(confirm);
  await click(confirm.parentElement);
  assert.deepEqual(api.posts(), [{
    action: 'preview', expectedRevision: 'revision-1', selectedLogins: ['bar'], grants: [viewGrant],
  }]);
  assert.deepEqual(callbacks, []);
});

test('editing a preview invalidates confirmation and changed choices require a new preview token', async t => {
  let previews = 0;
  const api = fakeApi(call => {
    if (call.method === 'GET') return Response.json(listing());
    return Response.json(previewFor(call.body, listing(), `preview-${++previews}`));
  });
  const {host, callbacks} = await mount(t);
  await selectOne(host);
  await click(button(host, labels.preview));
  assert.ok(button(host, labels.apply));
  await click(button(host, labels.edit));
  assert.equal(button(host, labels.apply), undefined);
  assert.equal(api.posts().length, 1);
  await click(checkbox(host, 'Chọn user foo'));
  await click(checkbox(host, 'Chọn user bar'));
  await click(checkbox(host, addGrant));
  await click(checkbox(host, otherGrant));
  await click(button(host, labels.preview));
  assert.deepEqual(api.posts(), [
    {action: 'preview', expectedRevision: 'revision-1', selectedLogins: ['foo'], grants: [addGrant]},
    {action: 'preview', expectedRevision: 'revision-1', selectedLogins: ['bar'], grants: [otherGrant]},
  ]);
  await click(button(host, labels.back));
  assert.deepEqual(callbacks, ['closed']);
  assert.equal(api.posts().some(body => body.action === 'apply'), false);
});

test('closing and reopening discards the previous selection and preview', async t => {
  const api = fakeApi(call => Response.json(call.method === 'GET' ? listing() : previewFor(call.body)));
  const first = await mount(t);
  await selectOne(first.host);
  await click(button(first.host, labels.preview));
  await click(button(first.host, labels.back));
  assert.deepEqual(first.callbacks, ['closed']);
  await first.close();
  const second = await mount(t);
  assert.equal([...second.host.querySelectorAll('input[type="checkbox"]')].some(node => node.checked), false);
  assert.equal(button(second.host, labels.apply), undefined);
  assert.equal(button(second.host, labels.preview).disabled, true);
  assert.equal(api.posts().length, 1);
  assert.deepEqual(second.callbacks, []);
});

for (const action of ['preview', 'apply']) {
  test(`pending ${action} cannot double-submit, change selection, or close before its response`, async t => {
    let finish;
    let preview;
    const api = fakeApi(async call => {
      if (call.method === 'GET') return Response.json(listing());
      if (call.body.action === action) await new Promise(resolve => { finish = resolve; });
      if (call.body.action === 'preview') {
        preview = previewFor(call.body);
        return Response.json(preview);
      }
      return Response.json({ok: true, users: preview.users, changedUsers: preview.changedUsers, auditId: 'synthetic-audit'});
    });
    const {host, callbacks} = await mount(t);
    await selectOne(host);
    if (action === 'apply') await click(button(host, labels.preview));
    const target = button(host, labels[action]);
    await act(async () => { target.click(); target.click(); });
    assert.equal(api.posts().filter(body => body.action === action).length, 1);
    assert.equal(typeof finish, 'function');
    const pendingButton = button(host, labels[action]) || [...host.querySelectorAll('button')].find(node => /Đang/.test(node.textContent));
    assert.ok(pendingButton);
    assert.equal(pendingButton.disabled, true);
    await click(pendingButton);
    if (pendingButton.parentElement.matches('[data-feedback-button]')) await click(pendingButton.parentElement);
    assert.equal(api.posts().filter(body => body.action === action).length, 1);
    for (const node of host.querySelectorAll('input[type="checkbox"]')) assert.equal(node.matches(':disabled'), true);
    assert.equal(button(host, labels.back).disabled, true);
    await click(button(host, labels.back));
    const close = host.querySelector('button[aria-label="Đóng"]');
    if (close) { assert.equal(close.disabled, true); await click(close); }
    assert.deepEqual(callbacks, []);
    await act(async () => { finish(); });
    await settle();
    assert.equal(api.posts().filter(body => body.action === action).length, 1);
    assert.deepEqual(callbacks, action === 'apply' ? ['applied', 'closed'] : []);
    if (action === 'preview') assert.ok(button(host, labels.apply));
  });
}

for (const stage of ['read', 'preview', 'apply']) {
  for (const failure of ['http', 'denied', 'network']) {
    test(`${stage} ${failure} failure stays visible and never reports application or closes`, async t => {
      const api = fakeApi(call => {
        const isFailure = stage === 'read' ? call.method === 'GET' : call.body?.action === stage;
        if (isFailure) {
          if (failure === 'network') throw Error('Synthetic private SQL token');
          return Response.json({error: 'Synthetic private SQL token'}, {status: failure === 'denied' ? 403 : 500});
        }
        return Response.json(call.method === 'GET' ? listing() : previewFor(call.body));
      });
      const {host, callbacks} = await mount(t);
      if (stage !== 'read') {
        await selectOne(host);
        await click(button(host, labels.preview));
        if (stage === 'apply') await click(button(host, labels.apply));
      }
      await settle();
      assert.match(alerts(host), /\S/, 'an error is visible in the still-open dialog');
      assert.doesNotMatch(alerts(host), /Synthetic|private|SQL|token/, 'server internals are not exposed in error notices');
      assert.ok(host.querySelector('[role="dialog"]'));
      assert.deepEqual(callbacks, []);
      assert.equal(api.posts().filter(body => body.action === 'apply').length, stage === 'apply' ? 1 : 0);
      if (stage !== 'apply') assert.equal(button(host, labels.apply), undefined);
    });
  }
}

test('an unverified apply response cannot be mistaken for a successful save', async t => {
  const api = fakeApi(call => {
    if (call.method === 'GET') return Response.json(listing());
    return Response.json(call.body.action === 'preview' ? previewFor(call.body) : {ok: false});
  });
  const {host, callbacks} = await mount(t);
  await selectOne(host);
  await click(button(host, labels.preview));
  await click(button(host, labels.apply));
  assert.match(alerts(host), /Chưa xác minh/);
  assert.deepEqual(callbacks, []);
  assert.equal(api.posts().filter(body => body.action === 'apply').length, 1);
});

for (const stage of ['read', 'preview', 'apply']) {
  test(`an interrupted ${stage} request does not call success or close callbacks after unmount`, async t => {
    let finish;
    let preview;
    fakeApi(async call => {
      const current = call.method === 'GET' ? 'read' : call.body.action;
      if (current === stage) await new Promise(resolve => { finish = resolve; });
      if (current === 'read') return Response.json(listing());
      if (current === 'preview') {
        preview = previewFor(call.body);
        return Response.json(preview);
      }
      return Response.json({ok: true, users: preview.users, changedUsers: preview.changedUsers, auditId: 'synthetic-audit'});
    });
    const view = await mount(t);
    if (stage !== 'read') {
      await selectOne(view.host);
      await click(button(view.host, labels.preview));
      if (stage === 'apply') await click(button(view.host, labels.apply));
    }
    assert.equal(typeof finish, 'function');
    await view.close();
    await act(async () => { finish(); });
    await settle();
    assert.deepEqual(view.callbacks, []);
    assert.equal(view.host.isConnected, false);
  });
}

for (const stage of ['preview', 'apply']) {
  test(`${stage} 409 invalidates the stale preview and requires refreshed data before another confirmation`, async t => {
    let revision = 'revision-1';
    let rejected = false;
    const api = fakeApi(call => {
      if (call.method === 'GET') return Response.json(listing(revision));
      if (call.body.action === stage && !rejected) {
        rejected = true;
        revision = 'revision-2';
        return Response.json({error: 'Dữ liệu đã thay đổi. Vui lòng tải lại và xem trước.'}, {status: 409});
      }
      return Response.json(previewFor(call.body, listing(revision), 'fresh-preview'));
    });
    let view = await mount(t);
    let {host, callbacks} = view;
    await selectOne(host);
    await click(button(host, labels.preview));
    if (stage === 'apply') await click(button(host, labels.apply));
    await settle();
    assert.equal(rejected, true);
    assert.match(alerts(host), /\S/);
    const confirm = button(host, labels.apply);
    assert.ok(!confirm || confirm.disabled, 'the stale token cannot be confirmed again');
    if (confirm) await click(confirm);
    assert.equal(api.posts().filter(body => body.action === 'apply').length, stage === 'apply' ? 1 : 0);
    assert.deepEqual(callbacks, []);
    // Stale data can refresh directly, through a reload control, or by closing
    // and reopening as directed. None of those routes may reuse the old token.
    if (api.calls.filter(call => call.method === 'GET').length < 2) {
      const refresh = [...host.querySelectorAll('button')].find(node => /Tải lại|Làm mới/.test(node.textContent));
      if (refresh) await click(refresh);
      else {
        assert.match(alerts(host), /[Đđ]óng và mở lại/);
        assert.equal(button(host, labels.preview).disabled, true);
        await click(button(host, labels.preview));
        assert.equal(api.posts().filter(body => body.action === 'preview').length, 1);
        await click(button(host, labels.back));
        assert.deepEqual(callbacks, ['closed']);
        await view.close();
        view = await mount(t);
        ({host, callbacks} = view);
      }
      await settle();
    }
    assert.equal(api.calls.filter(call => call.method === 'GET').length, 2);
    assert.equal(button(host, labels.apply), undefined);
    if (!checkbox(host, 'Chọn user foo').checked) await click(checkbox(host, 'Chọn user foo'));
    if (!checkbox(host, addGrant).checked) await click(checkbox(host, addGrant));
    await click(button(host, labels.preview));
    assert.deepEqual(api.posts().at(-1), {
      action: 'preview', expectedRevision: 'revision-2', selectedLogins: ['foo'], grants: [addGrant],
    });
    assert.ok(button(host, labels.apply));
    assert.deepEqual(callbacks, []);
  });
}
