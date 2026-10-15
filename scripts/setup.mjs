import { randomBytes } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
try {
  await access('.env');
  console.log('.env sudah ada; tidak ditimpa.');
  process.exit(0);
} catch {
  /* new setup */
}
const source = (await readFile('.env.example', 'utf8')).replace(
  'ADMIN_PASSWORD=\n',
  `ADMIN_PASSWORD=${randomBytes(24).toString('base64url')}\n`,
);
await writeFile('.env', source, { mode: 0o600, flag: 'wx' });
console.log(
  '.env dibuat. Password admin ada di file tersebut, tidak dicetak. npm start menyiapkan SQLite dan kunci lokal otomatis.',
);
