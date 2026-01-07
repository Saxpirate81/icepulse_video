// Testing utilities
//
// We intentionally treat "dev mode" as testing-enabled so view/user toggles work
// even if env vars fail to hot-reload or are inconsistently injected.

export function isTestingEnabled() {
  // Vite exposes DEV/MODE reliably at runtime
  const isDev = Boolean(import.meta.env.DEV) || import.meta.env.MODE === 'development'

  // Explicit flag (preferred)
  const envFlag = import.meta.env.VITE_ENABLE_TESTING_TOGGLES
  const flagEnabled = envFlag === 'true' || envFlag === true

  // Mock mode implies testing
  const mockFlag = import.meta.env.VITE_USE_MOCK_DATA
  const mockEnabled = mockFlag === 'true' || mockFlag === true

  return isDev || flagEnabled || mockEnabled
}

