// JSDOM closes browser resources, but not Node's global BroadcastChannel.
// Track real channels created by the fixture and close them with its window.
export function trackBrowserChannels() {
  const Original = globalThis.BroadcastChannel;
  const channels = new Set();
  class FixtureBroadcastChannel extends Original {
    constructor(name) {super(name);channels.add(this);}
    close() {channels.delete(this);super.close();}
  }
  globalThis.BroadcastChannel = FixtureBroadcastChannel;
  return () => {
    for (const channel of channels) channel.close();
    globalThis.BroadcastChannel = Original;
  };
}
