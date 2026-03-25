"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** 모든 페이지 상단: 뒤로가기 + 주요 이동 */
export function GlobalAppNav() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <button
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() => router.back()}
          type="button"
        >
          <span aria-hidden>←</span>
          뒤로가기
        </button>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-label="주요 메뉴">
          <Link className="font-semibold text-slate-900 hover:text-blue-700" href="/">
            CareerFlow AI
          </Link>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <Link className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline" href="/new">
            새 워크플로
          </Link>
          <Link className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline" href="/my">
            내 워크플로
          </Link>
        </nav>
      </div>
    </header>
  );
}
