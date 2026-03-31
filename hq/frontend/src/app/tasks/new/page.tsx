'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTaskRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tasks?mode=advanced');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-8 text-center text-white">
      <p className="text-lg font-black tracking-widest text-slate-400 uppercase">Redirecting to Unified Task Center...</p>
    </div>
  );
}
