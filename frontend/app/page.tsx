"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, createTestUser } from "../lib/api";
import { getStoredTestUserId, storeTestUserId } from "../lib/test-user";

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
    setMessage("로그인 성공");
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

  return (
    <main className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">CareerFlow AI</h1>
      <p className="text-slate-700">
        이력서/포트폴리오/채용공고를 분석하고 보완한 뒤 문서와 면접 준비까지 이어지는 저장형 워크플로우입니다.
      </p>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-slate-900">로그인 (테스트 ID 입력)</h2>
        <p className="text-xs text-slate-600">
          형식: 숫자 3자리 (예: <code>027</code>). 데모용 계정이며 정식 인증이 아닙니다.
        </p>
        <form className="space-y-2" onSubmit={handleLogin}>
          <input
            className="min-w-72 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="예: 027"
            value={testUserId}
            onChange={(e) => {
              setTestUserId(e.target.value);
              setIsLoggedIn(false);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="submit">
              로그인하기
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              type="button"
              onClick={handleCreateTestUser}
              disabled={loading}
            >
              {loading ? "생성 중..." : "테스트 계정 생성"}
            </button>
          </div>
        </form>
        {!testUserId.trim() ? (
          <p className="text-xs text-amber-700">아직 계정이 없다면 먼저 `테스트 계정 생성` 버튼으로 ID를 발급해 주세요.</p>
        ) : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!isLoggedIn}
        >
          새 지원서 워크플로우 시작
        </button>
        <button
          type="button"
          onClick={goToMyCareerFlow}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={!isLoggedIn}
        >
          나의 CareerFlow 보기
        </button>
      </div>
      {!isLoggedIn ? <p className="text-xs text-slate-500">로그인 성공 후 아래 기능 버튼이 활성화됩니다.</p> : null}
    </main>
  );
}
