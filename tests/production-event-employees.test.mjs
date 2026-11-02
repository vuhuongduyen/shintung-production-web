import test from 'node:test';
import assert from 'node:assert/strict';
import {eventEmployees} from '../lib/production-event-employees.mjs';
test('names use saved identity, legacy records resolve inactive staff, unknown IDs remain visible',()=>{
 const directory=[{id:'NV01',name:'Tên mới',active:false},{id:'NV02',name:'Nguyễn Văn B'}];
 assert.deepEqual(eventEmployees({employees:['nv01','NV02','NV03','NV02'],employeeDetails:[{id:'NV01',name:'Tên lúc ghi'}]},directory),[{id:'NV01',name:'Tên lúc ghi'},{id:'NV02',name:'Nguyễn Văn B'},{id:'NV03',name:''}]);
 assert.deepEqual(eventEmployees({employees:['NV01']},directory),[{id:'NV01',name:'Tên mới'}]);
 assert.deepEqual(eventEmployees({count:2},directory),[]);
});
