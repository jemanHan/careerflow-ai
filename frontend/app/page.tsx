"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, createTestUser } from "../lib/api";
import { clearStoredTestUserId, getStoredTestUserId, storeTestUserId } from "../lib/test-user";

const TEST_USER_ID_REGEX = /^\d{3}$/;

export default function HomePage() {
  const router = useRouter();
  const [testUserId, setTestUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const stored = getStoredTestUserId();
    if (stored) {
      setTestUserId(stored);
      setIsLoggedIn(true);
    }
  }, []);

  async function handleCreateTestUser() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");
    try {
      const user = await createTestUser();
      setTestUserId(user.id);
      storeTestUserId(user.id);
      setIsLoggedIn(true);
      setMessage(`테스트 계정 생성 및 로그인 성공: ${user.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("테스트 계정 생성 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalized = testUserId.trim();
    if (!normalized) {
      setErrorMessage("테스트 ID를 입력해 주세요.");
      return;
    }
    if (!TEST_USER_ID_REGEX.test(normalized)) {
      setErrorMessage("테스트 ID는 숫자 3자리여야 합니다. (예: 027)");
      return;
    }
    storeTestUserId(normalized);
    setTestUserId(normalized);
    setIsLoggedIn(true);
    setErrorMessage("");
    setMessage("");
  }

  function goToMyCareerFlow() {
    if (!isLoggedIn) {
      setErrorMessage("먼저 테스트 ID로 로그인해 주세요.");
      return;
    }
    const normalized = testUserId.trim();
    if (!normalized) {
      setErrorMessage("먼저 테스트 계정을 생성하거나 ID를 입력해 주세요.");
      return;
    }
    storeTestUserId(normalized);
    router.push("/my");
  }

  function handleLogout() {
    clearStoredTestUserId();
    setIsLoggedIn(false);
    setTestUserId("");
    setMessage("로그아웃 완료");
    setErrorMessage("");
  }

  const hasActiveLogin = isLoggedIn && Boolean(testUserId.trim());

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-transparent opacity-70" />
        <div className="p-8 md:p-10">
          <div className="max-w-4xl space-y-5">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              문서 기반 취업 준비 워크플로우
            </div>
            <div className="space-y-4 break-keep">
              <p className="text-sm font-semibold tracking-wide text-slate-500">CareerFlow AI</p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-[44px] md:leading-[1.12]">
                지원 문서를 분석하고, <span className="text-blue-600">합격 가능성을 높이는</span>{" "}
                <span className="whitespace-nowrap">개선 흐름</span>을 만드세요
              </h1>
              <p className="max-w-3xl text-[15px] leading-relaxed text-slate-700 md:text-base">
                이력서·포트폴리오·채용공고를 함께 분석해 <span className="font-semibold text-slate-900">강점과 부족 신호</span>를 정리하고,
                보완 질문에 답하면 <span className="font-semibold text-slate-900 whitespace-nowrap">문서 초안</span>과{" "}
                <span className="font-semibold text-slate-900 whitespace-nowrap">면접 준비</span>까지 한 번에 이어집니다.
              </p>
            </div>

            <p className="text-sm leading-relaxed text-slate-500">
              계속 사용하려면 로그인 후 워크플로우를 저장해 이어서 사용할 수 있습니다.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => router.push("/new")}
                disabled={!hasActiveLogin}
                aria-disabled={!hasActiveLogin}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                새 워크플로우 시작
              </button>
              <button
                type="button"
                onClick={goToMyCareerFlow}
                disabled={!hasActiveLogin}
                aria-disabled={!hasActiveLogin}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                나의 CareerFlow로 이동
              </button>
            </div>

            {!hasActiveLogin ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span className="font-semibold">로그인이 필요합니다.</span> 아래에서 테스트 ID로 시작하거나 데모 ID를 발급해 주세요.
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">데모/테스트 접속 (보조)</h2>
                <p className="text-xs leading-relaxed text-slate-600">
                  형식: 숫자 3자리 (예: <code>027</code>). 데모용 기능이며 정식 인증이 아닙니다.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {hasActiveLogin ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">현재 ID 사용 중</span>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 font-semibold text-slate-700">미설정</span>
                )}
              </div>
            </div>

            <form className="mt-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-start" onSubmit={handleLogin}>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">현재 ID</span>
                  <span className="font-mono font-semibold text-slate-700">{hasActiveLogin ? testUserId.trim() : "—"}</span>
                </div>

                {!hasActiveLogin ? (
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="예: 027"
                    value={testUserId}
                    onChange={(e) => {
                      setTestUserId(e.target.value);
                      setIsLoggedIn(false);
                    }}
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                    type="submit"
                    disabled={hasActiveLogin}
                  >
                    로그인
                  </button>
                  <button
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    onClick={handleCreateTestUser}
                    disabled={loading}
                  >
                    {loading ? "새로운 ID 발급 중..." : "새로운 ID 발급"}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!hasActiveLogin}
                  >
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 md:mt-0">
                <p className="font-semibold text-slate-900">안내</p>
                <p className="mt-1 leading-relaxed">처음이라면 「새로운 ID 발급」으로 바로 시작할 수 있습니다.</p>
                <p className="mt-2 leading-relaxed">로그인 후 생성한 워크플로우는 나의 CareerFlow에서 다시 열 수 있습니다.</p>
              </div>
            </form>

            {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
            {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">빠르게 이해하는 4단계 워크플로우</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            입력 문서를 붙여넣고, 분석 → 보완 → 초안·면접 준비까지 이어지는 흐름을 제공합니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { step: "01", title: "입력 문서 붙여넣기", desc: "이력서·포트폴리오·채용공고 텍스트 입력" },
            { step: "02", title: "장·단점 분석", desc: "강점과 부족 신호를 서면 평가처럼 정리" },
            { step: "03", title: "대화형 보완", desc: "부족 근거를 질문으로 채워 설득력 강화" },
            { step: "04", title: "문서 생성 / 면접 준비", desc: "초안 문서와 질문별 준비 포인트 생성" },
          ].map((item) => (
            <div key={item.step} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-slate-500">{`STEP ${item.step}`}</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              <div className="mt-auto pt-4" aria-hidden />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">제품이 하는 일</h2>
          <p className="text-sm leading-relaxed text-slate-600">문서 중심의 워크플로우로, 분석부터 초안과 면접 준비까지 연결합니다.</p>
        </div>
        <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">장·단점 분석</p>
            <p className="text-slate-600">공고 대비 강점과 부족 신호를 문서처럼 정리합니다.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">대화형 보완</p>
            <p className="text-slate-600">근거가 약한 부분을 질문으로 보완해 설득력을 높입니다.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">문서·면접 준비</p>
            <p className="text-slate-600">초안 생성과 면접 대비 포인트를 한 흐름으로 제공합니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
