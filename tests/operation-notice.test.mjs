import test from 'node:test';import assert from 'node:assert/strict';
import {operationResolution,resultKind} from '../lib/operation-notice.mjs';
test('loading is not success; business failures get actionable remedies',()=>{
 assert.equal(resultKind('Đang tải danh sách','cap-notice','status'),null);
 assert.equal(resultKind('Đã lưu','notice success','status'),'success');
 assert.equal(resultKind('Thiếu ngày','error','alert'),'error');
 assert.match(operationResolution('Nhân viên trùng khoảng giờ'),/khoảng trùng/);
 assert.match(operationResolution('Không có quyền'),/quyền tài khoản/);
 assert.match(operationResolution('Mất kết nối'),/đã lưu chưa/);
 assert.match(operationResolution('Dữ liệu đã thay đổi'),/trạng thái mới nhất/);
 assert.match(operationResolution('Unknown error','en'),/administrator/);
});
