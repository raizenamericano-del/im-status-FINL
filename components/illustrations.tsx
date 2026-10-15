export function Orbit({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`orbit-art ${compact ? 'compact' : ''}`} aria-hidden="true">
      <div className="orbit-ring r1" />
      <div className="orbit-ring r2" />
      <div className="orbit-dot d1" />
      <div className="orbit-dot d2" />
      <div className="orbit-dot d3" />
      <div className="art-photo">
        <svg viewBox="0 0 180 210">
          <rect width="180" height="210" rx="16" fill="#dbe9bc" />
          <circle cx="132" cy="48" r="22" fill="#f6f9df" />
          <path d="M0 170 66 89l65 81 25-36 50 76H0Z" fill="#638d6b" />
          <path d="m0 210 71-62 54 62" fill="#2e6657" />
        </svg>
        <span>Hanya momen pilihan Anda</span>
      </div>
      <div className="art-check">✓</div>
      <div className="art-tag">
        <i />
        Privat, dalam kendali Anda
      </div>
    </div>
  );
}
export function EmptyArt({ type = 'status' }: { type?: 'status' | 'library' | 'history' }) {
  return (
    <div className={`empty-art ${type}`} aria-hidden="true">
      <div className="ea-back" />
      <div className="ea-front">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <rect x="7" y="8" width="24" height="22" rx="5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="m9 27 8-8 5 5 4-4 5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="ea-spark">+</span>
    </div>
  );
}
