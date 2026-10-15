import { installSafeConsole } from './privacy-logger';
installSafeConsole();
for (const event of ['uncaughtException', 'unhandledRejection'] as const)
  process.on(event, () => {
    console.error(JSON.stringify({ event: 'worker_fatal' }));
    process.exit(1);
  });
try {
  await import('./main');
} catch {
  console.error(JSON.stringify({ event: 'worker_start_failed' }));
  process.exit(1);
}
