'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
export function ToastPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const update = () => {
      const dialogs = document.querySelectorAll('dialog[open]');
      const next = dialogs.item(dialogs.length - 1) ?? document.body;
      setHost((old) => (old === next ? old : next));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, []);
  return host ? createPortal(children, host) : null;
}
