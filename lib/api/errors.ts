export const E = {
  NOT_CONFIGURED:       'not_configured',
  RATE_LIMITED:         'rate_limited',
  VALIDATION_ERROR:     'validation_error',
  FORBIDDEN:            'forbidden',
  NOT_FOUND:            'not_found',
  UPSTREAM_ERROR:       'upstream_error',
  ALL_PROVIDERS_FAILED: 'all_providers_failed',
  INVALID_ID:           'invalid_id',
  MISSING_QUERY:        'missing_query',
  UNAUTHORIZED:         'unauthorized',
} as const;

export type ErrorCode = typeof E[keyof typeof E];
