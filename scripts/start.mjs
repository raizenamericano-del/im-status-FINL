import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { dataDirectory } from './config.mjs';
process.umask(0o077);
try {
  const root = dataDirectory();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const child = spawn(
    'flock',
    [
      '--no-fork',
      '--nonblock',
      '--conflict-exit-code',
      '73',
      join(root, '.instance.lock'),
      process.execPath,
      'scripts/service.mjs',
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit', detached: true },
  );
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      try {
        child.kill(signal);
      } catch {
        /* already exited */
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already exited */
        }
      }, 12000).unref();
    });
  child.once('error', () => {
    console.error('START_FAILED: Linux flock diperlukan; gunakan image Docker yang disediakan.');
    process.exit(1);
  });
  child.once('exit', (code) => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* no surviving children */
    }
    if (code === 73)
      console.error(
        'INSTANCE_BUSY: direktori data sedang dipakai. Jalankan satu service, satu replica.',
      );
    process.exit(stopping ? 0 : (code ?? 1));
  });
} catch {
  console.error('DATA_DIRECTORY_UNAVAILABLE: periksa volume /data dan izin tulis.');
  process.exit(1);
}
