type LogMeta = Record<string, unknown>;

const logger = {
  error(context: string, message: string, err?: unknown) {
    if (process.env.NODE_ENV === 'production') return;
    const detail =
      err instanceof Error ? err.message : err !== undefined ? String(err) : '';
    console.error(`[${context}] ${message}${detail ? ` — ${detail}` : ''}`);
  },
  warn(context: string, message: string, meta?: LogMeta) {
    if (process.env.NODE_ENV === 'production') return;
    console.warn(`[${context}] ${message}`, meta ?? '');
  },
};

export function logError(context: string, message: string, err?: unknown) {
  logger.error(context, message, err);
}

export function logWarn(context: string, message: string, meta?: LogMeta) {
  logger.warn(context, message, meta);
}
