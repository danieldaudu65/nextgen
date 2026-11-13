// A random id for this browser, kept in localStorage.
// Accounts made with a school code are locked to the device they first log in on.
const KEY = 'ng_device';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      id = 'd_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'd_nostorage00';
  }
}
