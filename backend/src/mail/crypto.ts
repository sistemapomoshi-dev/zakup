const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function deriveKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string, secret: string) {
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  const payload = new Uint8Array(iv.length + ciphertext.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(ciphertext), iv.length)
  return Buffer.from(payload).toString('base64')
}

export async function decryptSecret(encrypted: string, secret: string) {
  const key = await deriveKey(secret)
  const payload = Buffer.from(encrypted, 'base64')
  const iv = payload.subarray(0, 12)
  const ciphertext = payload.subarray(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return decoder.decode(plaintext)
}
