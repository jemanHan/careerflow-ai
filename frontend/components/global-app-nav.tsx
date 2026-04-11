"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStoredTestUserId, getStoredTestUserIdHistory, getTestUserChangedEventName, storeTestUserId } from "../lib/test-user";

export function GlobalAppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [testUserId, setTestUserId] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [openProfile, setOpenProfile] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTestUserId(getStoredTestUserId().trim());
    setHistory(getStoredTestUserIdHistory());
  }, [pathname]);

  useEffect(() => {
    const handleSync = () => {
      setTestUserId(getStoredTestUserId().trim());
      setHistory(getStoredTestUserIdHistory());
    };
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

  function navLinkClass(href: string) {
    const active =
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return [
      "text-sm font-medium transition-colors h-16 flex items-center border-b-2 -mb-px",
      active
        ? "border-primary font-semibold text-primary"
        : "border-transparent text-tertiary hover:text-primary"
    ].join(" ");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-header border-b border-outline-variant/10 bg-surface/80">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between gap-4 px-6 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {pathname !== "/" ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">뒤로</span>
            </button>
          ) : null}
          <Link href="/" className="font-headline text-xl font-bold tracking-tight text-on-surface">
            CareerFlow AI
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex" aria-label="주요 메뉴">
          <Link href="/" className={navLinkClass("/")}>
            홈
          </Link>
          <Link href="/new" className={navLinkClass("/new")}>
            새 워크플로
          </Link>
          <Link href="/my" className={navLinkClass("/my")}>
            나의 CareerFlow
          </Link>
        </nav>

        <div className="relative flex shrink-0 items-center gap-3" ref={profileWrapRef}>
          <button
            type="button"
            onClick={() => setOpenProfile((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high shadow-ambient-soft ring-1 ring-outline-variant/20 hover:bg-surface-container"
            aria-haspopup="menu"
            aria-expanded={openProfile}
            aria-label={testUserId ? "프로필 메뉴" : "세션 안내"}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full editorial-gradient text-xs font-bold text-on-primary"
              aria-hidden
            >
              U
            </span>
          </button>

          {openProfile ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-[min(300px,92vw)] rounded-2xl bg-surface-container-lowest p-4 shadow-ambient"
            >
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-tertiary">세션</p>
              <div className="mt-2 rounded-xl bg-surface-container-low px-3 py-2">
                <p className="text-xs text-on-surface-variant">현재 ID</p>
                <p className="mt-1 font-mono text-sm font-semibold text-on-surface">{testUserId || "미설정"}</p>
              </div>

              {history.length > 0 ? (
                <div className="mt-3">
                  <p className="px-1 text-xs font-semibold uppercase tracking-wider text-tertiary">최근 ID</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {history.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          storeTestUserId(id);
                          setTestUserId(id);
                          setOpenProfile(false);
                        }}
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                          id === testUserId
                            ? "bg-primary/15 text-primary"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        ].join(" ")}
                        aria-label={`ID ${id}로 전환`}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/"
                  role="menuitem"
                  className="rounded-xl bg-surface-container-low px-3 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
                  onClick={() => setOpenProfile(false)}
                >
                  홈 · ID 설정
                </Link>
                <Link
                  href="/my"
                  role="menuitem"
                  className="rounded-xl bg-surface-container-low px-3 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
                  onClick={() => setOpenProfile(false)}
                >
                  나의 CareerFlow
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
