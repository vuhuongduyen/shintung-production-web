import {createHash} from 'node:crypto';

export function assertSafeTrackedPaths(paths) {
  for (const path of paths) {
    if (path === '.env.example') continue;
    if (/(^|\/)(?:\.git|\.local-data|\.wrangler|\.sites-runtime|node_modules|uploads|backups)(\/|$)/i.test(path)
        || /^handoff(\/|$)/i.test(path) || /(^|\/)\.env(?:\.|$)/i.test(path) || /(^|\/)\.dev\.vars(?:\.|$)/i.test(path)
        || /\.(?:sqlite(?:-shm|-wal)?|db|dump|pem|key|p12|pfx)$/i.test(path)) {
      throw new Error(`Runtime/credential path in snapshot: ${path}`);
    }
  }
}

export function assertApprovedBaseline(path, bytes, manifest) {
  const entry = manifest.files.find(file => file.path === path);
  if (!entry || entry.bytes !== bytes.length || entry.sha256 !== createHash('sha256').update(bytes).digest('hex')) {
    throw new Error(`Unapproved baseline content: ${path}`);
  }
}
