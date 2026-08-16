export interface AuthEnvironment {
  NODE_ENV?: string
  AUTH_ALLOW_DEMO?: string
}

export function isDemoAuthAllowed(environment: AuthEnvironment): boolean {
  return environment.NODE_ENV !== 'production' && environment.AUTH_ALLOW_DEMO === 'true'
}
