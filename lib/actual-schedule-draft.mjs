// Preserve the edit's original concurrency versions during background reads.
export function createScheduleDraftSync() {
  let current = null;
  return {
    reset() { current = null; },
    sync(key, edited, incoming, version, approved) {
      const signature = JSON.stringify({incoming, version, approved});
      if (current?.key === key) {
        if (JSON.stringify(edited) !== current.days) return null;
        if (signature === current.signature) return null;
      }
      current = {key, days:JSON.stringify(incoming), signature};
      return {days:structuredClone(incoming), version, approved:approved ? structuredClone(approved) : undefined};
    }
  };
}
