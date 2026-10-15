// libsignal currently writes entire session records to console. Never forward its raw logs.
const events = new Set([
  'worker_started',
  'worker_tick_failed',
  'status_ingest_failed',
  'media_delete_failed',
  'worker_lock_busy',
  'worker_lease_lost',
  'worker_fatal',
  'worker_start_failed',
]);
export function sanitizeLogArgs(args: unknown[]): Record<string, string | boolean> | null {
  if (args.length !== 1 || typeof args[0] !== 'string') return null;
  try {
    const value = JSON.parse(args[0]);
    if (!value || typeof value.event !== 'string' || !events.has(value.event)) return null;
    return {
      event: value.event,
      ...(value.event === 'worker_started'
        ? { provider: 'baileys', storageReady: value.storageReady === true }
        : {}),
    };
  } catch {
    return null;
  }
}
export function installSafeConsole() {
  for (const level of ['log', 'info', 'debug', 'warn', 'error'] as const) {
    console[level] = (...args: unknown[]) => {
      const safe = sanitizeLogArgs(args);
      if (safe)
        (level === 'error' ? process.stderr : process.stdout).write(JSON.stringify(safe) + '\n');
    };
  }
}
