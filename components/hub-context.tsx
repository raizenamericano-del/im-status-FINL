'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/client';
import type { Dashboard } from '@/lib/ui-types';
export type HubContextValue = {
  csrf: string;
  user: { name: string; email: string };
  refresh: () => void;
  version: number;
  toast: (message: string, error?: boolean) => void;
  dashboard: Dashboard | null;
  notifications: boolean;
  setNotifications: (value: boolean) => void;
};
export const HubContext = createContext<HubContextValue | null>(null);
export function useHub() {
  const value = useContext(HubContext);
  if (!value) throw new Error('Missing workspace context');
  return value;
}
export function useResource<T>(path: string, version: number) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const router = useRouter(),
    lastPath = useRef(path);
  useEffect(() => {
    const controller = new AbortController();
    if (lastPath.current !== path) {
      setData(null);
      lastPath.current = path;
    }
    setLoading(true);
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        setData(value);
        setError('');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') router.replace('/login');
        setData(null);
        setError(e instanceof Error ? e.message : 'Layanan tidak tersedia.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version, router]);
  return { data, loading, error };
}
