import test from 'node:test';
import assert from 'node:assert/strict';
import {trackBrowserChannels} from './helpers/browser-channels.mjs';

test('browser fixture keeps real channel delivery and closes all channels on teardown',async()=>{
  const original=globalThis.BroadcastChannel,close=trackBrowserChannels();
  const first=new BroadcastChannel('fixture-'+process.pid),second=new BroadcastChannel(first.name);
  try {
    const message=new Promise(resolve=>{second.onmessage=event=>resolve(event.data);});
    first.postMessage('synthetic');assert.equal(await message,'synthetic');
  } finally {close();}
  assert.equal(globalThis.BroadcastChannel,original);
  assert.throws(()=>first.postMessage('after-close'),/closed/i);
  assert.throws(()=>second.postMessage('after-close'),/closed/i);
});
