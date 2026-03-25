"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStoredTestUserId, getTestUserChangedEventName } from "../lib/test-user";

/** 모든 페이지 상단: 뒤로가기 + 주요 이동 */
export function GlobalAppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [testUserId, setTestUserId] = useState("");
  const [openProfile, setOpenProfile] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTestUserId(getStoredTestUserId().trim());
  }, [pathname]);

  useEffect(() => {
    const handleSync = () => setTestUserId(getStoredTestUserId().trim());
    const onCustom = () => handleSync();
    window.addEventListener(getTestUserChangedEventName(), onCustom as EventListener);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(getTestUserChangedEventName(), onCustom as EventListener);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!openProfile) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (profileWrapRef.current?.contains(target)) return;
      setOpenProfile(false);
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenProfile(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openProfile]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {pathname !== "/" ? (
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => router.back()}
            type="button"
          >
            <span aria-hidden>←</span>
            뒤로가기
          </button>
        ) : null}
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-label="주요 메뉴">
          <Link className="font-semibold text-slate-900 hover:text-blue-700" href="/">
            CareerFlow AI
          </Link>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <Link className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline" href="/my">
            내 워크플로우
          </Link>
        </nav>
        </div>

        <div className="relative" ref={profileWrapRef}>
          <button
            type="button"
            onClick={() => setOpenProfile((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            aria-haspopup="menu"
            aria-expanded={openProfile}
            aria-label={testUserId ? "프로필 메뉴 열기" : "로그인 안내 열기"}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
              aria-hidden
            >
              U
            </span>
          </button>

          {openProfile ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-[min(280px,92vw)] rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <p className="px-1 text-xs font-semibold text-slate-500">프로필</p>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-600">현재 테스트 ID</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{testUserId || "미설정"}</p>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/"
                  role="menuitem"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setOpenProfile(false)}
                >
                  홈에서 ID 변경/발급
                </Link>
                <Link
                  href="/my"
                  role="menuitem"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setOpenProfile(false)}
                >
                  내 워크플로우 보기
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
