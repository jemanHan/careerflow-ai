"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, listMyWorkflows, SavedWorkflowItem } from "../../lib/api";
import { getStoredTestUserId, storeTestUserId } from "../../lib/test-user";

const TEST_USER_ID_REGEX = /^\d{3}$/;

function summarizeJobPosting(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 90) {
    return normalized;
  }
  return `${normalized.slice(0, 90)}...`;
}

export default function MyCareerFlowPage() {
  const [testUserId, setTestUserId] = useState("");
  const [items, setItems] = useState<SavedWorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadByTestUser(id: string) {
    const normalized = id.trim();
    if (!normalized) {
      setErrorMessage("테스트 ID를 입력해 주세요.");
      return;
    }
    if (!TEST_USER_ID_REGEX.test(normalized)) {
      setErrorMessage("테스트 ID는 숫자 3자리여야 합니다. (예: 027)");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listMyWorkflows(normalized);
      setItems(result.applications);
      setTestUserId(result.id);
      storeTestUserId(result.id);
    } catch (error) {
      setItems([]);
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("저장된 워크플로우 조회 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = getStoredTestUserId();
    if (saved) {
      setTestUserId(saved);
      void loadByTestUser(saved);
    }
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void loadByTestUser(testUserId);
  }

  return (
    <main className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">나의 CareerFlow</h1>
      <p className="text-sm text-slate-600">
        현재 브라우저에 저장된 테스트 ID와 일치하는 워크플로우만 조회됩니다. 이 기능은 데모/테스트 편의용이며 정식 인증이 아닙니다.
      </p>

      <form className="flex flex-wrap items-center gap-2" onSubmit={handleSubmit}>
        <input
          className="min-w-72 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={testUserId}
          placeholder="테스트 ID 입력 (예: 027)"
          onChange={(e) => setTestUserId(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
        >
          {loading ? "조회 중..." : "워크플로우 조회"}
        </button>
      </form>

      {errorMessage ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p> : null}

      <div className="space-y-2">
        {items.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">저장된 워크플로우가 없습니다.</p>
        ) : null}
        {items.map((item) => {
          const score = typeof item.fitAnalysisJson?.estimatedFitScore === "number" ? item.fitAnalysisJson.estimatedFitScore : null;
          return (
            <Link
              key={item.id}
              href={`/results/${item.id}`}
              className="block rounded-lg border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">워크플로우 #{item.id}</p>
                <p className="text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString("ko-KR")}</p>
              </div>
              <p className="mt-1 text-sm text-slate-700">{summarizeJobPosting(item.targetJobPostingText)}</p>
              <p className="mt-1 text-xs text-slate-500">
                상태: {item.status}
                {score !== null ? ` · 적합도 ${score}점` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
