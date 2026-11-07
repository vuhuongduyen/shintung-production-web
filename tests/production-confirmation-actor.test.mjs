import test from 'node:test';
import assert from 'node:assert/strict';
import {productionConfirmationActorId as actor,productionReviewResult} from '../lib/production-actor.mjs';
test('confirmation uses reviewer identity and never reporter or last editor',()=>{
 assert.equal(actor({reviewStatus:'Đã xác nhận',reviewedById:'cnphuong',reviewedBy:'other',actorId:'LINE_A'}),'cnphuong');
 assert.equal(actor({reviewStatus:'Đã xác nhận',reviewedBy:'phung8681bt@gmail.com'}),'ntnphung');
 assert.equal(actor({reviewStatus:'Đã xác nhận',confirmationBasis:{by:'dhtin'}}),'dhtin');
 assert.equal(actor({reviewStatus:'Đã xác nhận',actorId:'LINE_A',updatedBy:'admin'}),'');
 assert.equal(actor({reviewStatus:'Cần điều chỉnh',reviewedBy:'cnphuong'}),'');
 assert.equal(actor({reviewStatus:'Chờ kiểm tra',reviewedBy:'cnphuong'}),'');
});

test('review attribution separates confirmation, rejection and pending without inventing an actor',()=>{
 const source={reviewedById:'SYNTHETIC-REVIEWER',reviewedAt:'2026-11-04T03:00:00Z',actorId:'SYNTHETIC-REPORTER',confirmationBasis:{by:'SYNTHETIC-OLDER-REVIEWER',at:'2026-11-03T01:00:00Z'}};
 const rejected=productionReviewResult({...source,reviewStatus:'Cần điều chỉnh'});assert.equal(rejected.result,'Từ chối');assert.equal(rejected.label,'Người từ chối');assert.equal(rejected.actorId,'SYNTHETIC-REVIEWER');assert.equal(rejected.at,source.reviewedAt);
 const approved=productionReviewResult({...source,reviewStatus:'Đã xác nhận'});assert.equal(approved.result,'Xác nhận');assert.equal(approved.label,'Người xác nhận');assert.equal(approved.actorId,'SYNTHETIC-REVIEWER');
 const pending=productionReviewResult({...source,reviewStatus:'Chờ kiểm tra'});assert.equal(pending.actorId,'');assert.equal(pending.at,'');assert.equal(pending.result,'Chưa xử lý');
 assert.equal(productionReviewResult({reviewStatus:'Cần điều chỉnh',actorId:'SYNTHETIC-REPORTER',confirmationBasis:source.confirmationBasis}).actorId,'');
});
