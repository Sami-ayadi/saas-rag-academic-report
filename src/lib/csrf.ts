import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_BYTES = 32

function signatureFor(nonce: string, secret: string) {
  return createHmac('sha256', secret).update(nonce).digest('base64url')
}

export function createCsrfToken(secret: string) {
  if (secret.length < 32) throw new Error('NEXTAUTH_SECRET must contain at least 32 characters')
  const nonce = randomBytes(TOKEN_BYTES).toString('base64url')
  return `${nonce}.${signatureFor(nonce, secret)}`
}

export function verifyCsrfToken(token: string | undefined, secret: string) {
  if (!token || secret.length < 32) return false
  const [nonce, signature, extra] = token.split('.')
  if (!nonce || !signature || extra) return false

  const expected = Buffer.from(signatureFor(nonce, secret))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function csrfCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-rag-csrf' : 'rag-csrf'
}
