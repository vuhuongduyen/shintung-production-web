import {spawn} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// A completed assertion does not guarantee that a Vite/DOM test releases its
// handles. Bound each file, fail on timeout, and still run every remaining file.
export async function runFile(file, timeoutMs = 180_000) {
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', file], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
  });
  let pending = '', timedOut = false;
  const counts = {};
  child.stdout.on('data', chunk => {
    process.stdout.write(chunk);
    pending += chunk.toString();
    const lines = pending.split('\n'); pending = lines.pop();
    for (const line of lines) {
      const match = /^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/.exec(line);
      if (match) counts[match[1]] = Number(match[2]);
    }
  });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  const timer = setTimeout(() => {
    timedOut = true;
    console.error(`CI TIMEOUT: ${file} exceeded ${timeoutMs}ms; counted as failure, not skipped.`);
    try {
      if (process.platform === 'win32') child.kill('SIGKILL');
      else process.kill(-child.pid, 'SIGKILL');
    } catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
  }, timeoutMs);
  return await new Promise(resolve => {
    child.once('error', error => {clearTimeout(timer);console.error(error.message);resolve({file,code:1,timedOut,counts});});
    child.once('close', code => {clearTimeout(timer);resolve({file,code:code ?? 1,timedOut,counts});});
  });
}

export async function main() {
  const shard = Number(process.argv[2] || 1), shards = Number(process.argv[3] || 1);
  if (!Number.isInteger(shard) || !Number.isInteger(shards) || shard < 1 || shard > shards || shards > 16) throw new Error('Invalid shard index/count');
  const allFiles = readdirSync('tests').filter(file => file.endsWith('.test.mjs')).sort();
  const files = allFiles.filter((_, index) => index % shards === shard - 1);
  if (!files.length) throw new Error('No test files found');
  const results = [];
  for (const file of files) {
    console.log(`\nCI FILE: tests/${file}`);
    results.push(await runFile(`tests/${file}`));
  }
  const totals = {tests:0,pass:0,fail:0,cancelled:0,skipped:0,todo:0};
  for (const result of results) for (const key of Object.keys(totals)) totals[key] += result.counts[key] || 0;
  const failed = results.filter(result => result.code !== 0 || result.timedOut);
  const incomplete = results.filter(result => result.counts.tests === undefined).map(result => result.file);
  console.log('CI SUMMARY: '+JSON.stringify({shard,shards,totalFiles:allFiles.length,files:files.length,failedFiles:failed.map(result=>({file:result.file,timeout:result.timedOut})),reportedTestTotals:totals,filesWithoutFinalTestSummary:incomplete}));
  // Totals from terminated files are unknown, never represented as passing.
  process.exitCode = failed.length || incomplete.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
