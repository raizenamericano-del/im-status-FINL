'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'wide' : ''}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id={id}>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
