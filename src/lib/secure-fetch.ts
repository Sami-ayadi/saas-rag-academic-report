'use client'

let csrfTokenPromise: Promise<string> | null = null

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

async function loadCsrfToken(forceRefresh = false) {
  if (!csrfTokenPromise || forceRefresh) {
    csrfTokenPromise = fetch('/api/security/csrf', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Impossible d’initialiser la protection CSRF')
      const data = await response.json() as { token: string }
      return data.token
    })
  }
  return csrfTokenPromise
}

export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return fetch(input, init)

  async function execute(forceRefresh = false) {
    const token = await loadCsrfToken(forceRefresh)
    const headers = new Headers(init.headers)
    headers.set('X-CSRF-Token', token)
    return fetch(input, { ...init, headers, credentials: 'same-origin' })
  }

  let response = await execute()
  if (response.status === 403 && response.headers.get('X-CSRF-Error') === '1') {
    csrfTokenPromise = null
    response = await execute(true)
  }
  return response
}
