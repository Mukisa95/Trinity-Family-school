type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const productionLevel: LogLevel = 'warn';
const developmentLevel: LogLevel = 'debug';

function configuredLevel(): LogLevel {
  const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in levelRank) return envLevel;
  return process.env.NODE_ENV === 'production' ? productionLevel : developmentLevel;
}

function shouldLog(level: LogLevel) {
  return levelRank[level] >= levelRank[configuredLevel()];
}

function sanitizeMeta(meta: unknown): unknown {
  if (!meta || typeof meta !== 'object') return meta;
  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message, stack: process.env.NODE_ENV === 'production' ? undefined : meta.stack };
  }

  const redactedKeys = ['password', 'passwordHash', 'token', 'secret', 'apiKey', 'authorization'];
  const input = meta as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      redactedKeys.some(redacted => key.toLowerCase().includes(redacted)) ? '[REDACTED]' : value,
    ])
  );
}

function write(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) return;

  const payload = meta === undefined ? [] : [sanitizeMeta(meta)];
  const prefix = `[Trinity:${level}]`;

  if (level === 'error') {
    console.error(prefix, message, ...payload);
    return;
  }

  if (level === 'warn') {
    console.warn(prefix, message, ...payload);
    return;
  }

  console.log(prefix, message, ...payload);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
