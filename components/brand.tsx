import Link from 'next/link';
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M7 8h18v12a5 5 0 0 1-5 5h-3l-5 4v-4H7V8Z" fill="currentColor" />
        <path
          d="M12 12v8m4-8v5l3-5v8m3-8v8"
          stroke="#163d35"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`brand ${dark ? 'on-dark' : ''}`} aria-label="IM Status Hub, beranda">
      <Mark />
      <span>
        IM <b>Status Hub</b>
        <small>YOUR MOMENTS, ORGANIZED.</small>
      </span>
    </Link>
  );
}
