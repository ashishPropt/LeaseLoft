const KEY = "leaseloft.device_id";

/** Works on HTTP (no secure-context required), unlike crypto.randomUUID() */
export function randomUUID(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return [...b].map((v, i) =>
    ([4, 6, 8, 10].includes(i) ? '-' : '') + v.toString(16).padStart(2, '0')
  ).join('');
}

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
