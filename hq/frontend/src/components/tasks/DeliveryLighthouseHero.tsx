'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import type { DeliveryFocus } from '../../lib/delivery-focus';

interface DeliveryLighthouseHeroProps {
  focus: DeliveryFocus;
  preferencesSlot?: ReactNode;
}

export function DeliveryLighthouseHero({ focus, preferencesSlot }: DeliveryLighthouseHeroProps) {
  const href = focus.primaryCta.href;
  const hash = focus.primaryCta.hash;

  return (
    <section
      data-testid="delivery-lighthouse-hero"
      className="mb-5 rounded-[1.8rem] border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white p-6 shadow-sm ring-1 ring-sky-100/60"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-200">
            <Compass size={24} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-700">交付主线</p>
              {focus.focusSource === 'pin' ? (
                <span
                  data-testid="delivery-focus-pinned-badge"
                  className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800"
                >
                  已固定
                </span>
              ) : null}
            </div>
            <p data-testid="delivery-current" className="mt-1 text-lg font-black text-slate-900">
              {focus.currentLabel}
            </p>
            {focus.completionHint ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{focus.completionHint}</p>
            ) : null}
            {focus.blocker ? (
              <p
                data-testid="delivery-blocker"
                className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
              >
                阻塞：{focus.blocker}
              </p>
            ) : (
              <p data-testid="delivery-blocker" className="mt-2 text-xs font-medium text-slate-400">
                当前无阻塞
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          {href ? (
            <Link
              data-testid="delivery-primary-cta"
              href={href}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-slate-800"
            >
              {focus.primaryCta.label}
            </Link>
          ) : hash ? (
            <a
              data-testid="delivery-primary-cta"
              href={hash}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-slate-800"
            >
              {focus.primaryCta.label}
            </a>
          ) : null}
        </div>
      </div>
      {preferencesSlot}
    </section>
  );
}
