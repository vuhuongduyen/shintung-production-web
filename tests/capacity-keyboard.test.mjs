import test from 'node:test';
import assert from 'node:assert/strict';
import {isCapacityAddRowKey} from '../lib/capacity-keyboard.mjs';

const event=(target,other={})=>({key:'ArrowDown',target,altKey:false,ctrlKey:false,metaKey:false,...other});
test('last registration text and staff picker add a row without taking arrow keys from other controls',()=>{
 const text={tagName:'INPUT',type:'text'},number={tagName:'INPUT',type:'number'};
 const picker=open=>({tagName:'SUMMARY',closest:selector=>selector==='details.cap-employee-picker'?{}:selector==='details[open]'&&open?{}:null});
 assert.equal(isCapacityAddRowKey(event(text),true,false),true);
 assert.equal(isCapacityAddRowKey(event(number),true,false),true);
 assert.equal(isCapacityAddRowKey(event(picker(false)),true,false),true);
 for(const target of [picker(true),{tagName:'SELECT'},{tagName:'INPUT',type:'time'},{tagName:'INPUT',type:'checkbox'}])assert.equal(isCapacityAddRowKey(event(target),true,false),false);
 assert.equal(isCapacityAddRowKey(event(text),false,false),false);
 assert.equal(isCapacityAddRowKey(event(text),true,true),false);
 assert.equal(isCapacityAddRowKey(event(text,{altKey:true}),true,false),false);
});
