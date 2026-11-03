import test from 'node:test';
import assert from 'node:assert/strict';
import {productionConfirmationActorId as actor} from '../lib/production-actor.mjs';
test('confirmation uses reviewer identity and never reporter or last editor',()=>{
 assert.equal(actor({reviewStatus:'Đã xác nhận',reviewedById:'cnphuong',reviewedBy:'other',actorId:'LINE_A'}),'cnphuong');
 assert.equal(actor({reviewStatus:'Đã xác nhận',reviewedBy:'phung8681bt@gmail.com'}),'ntnphung');
 assert.equal(actor({reviewStatus:'Đã xác nhận',confirmationBasis:{by:'dhtin'}}),'dhtin');
 assert.equal(actor({reviewStatus:'Đã xác nhận',actorId:'LINE_A',updatedBy:'admin'}),'');
 assert.equal(actor({reviewStatus:'Cần điều chỉnh',reviewedBy:'cnphuong'}),'');
 assert.equal(actor({reviewStatus:'Chờ kiểm tra',reviewedBy:'cnphuong'}),'');
});
