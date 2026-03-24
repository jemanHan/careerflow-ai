"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createSource } from "../../lib/api";
import {
  DEMO_JOB_POSTING_TEXT,
  DEMO_PORTFOLIO_TEXT,
  DEMO_PROJECT_TEXT,
  DEMO_RESUME_TEXT
} from "../../lib/demo-sample-input";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [portfolioText, setPortfolioText] = useState("");
  const [projectText, setProjectText] = useState("");
  const [targetJobPostingText, setTargetJobPostingText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function fillDemoSample() {
    setResumeText(DEMO_RESUME_TEXT);
    setPortfolioText(DEMO_PORTFOLIO_TEXT);
    setProjectText(DEMO_PROJECT_TEXT);
    setTargetJobPostingText(DEMO_JOB_POSTING_TEXT);
    setErrorMessage("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await createSource({
        resumeText,
        portfolioText,
        projectDescriptions: projectText ? [projectText] : [],
        targetJobPostingText
      });
      router.push(`/results/${result.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("요청 중 알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">소스 입력</h1>
      <p className="text-sm text-slate-600">
        `resumeText`, `portfolioText`, `targetJobPostingText`는 각각 최소 20자 이상이어야 합니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          onClick={fillDemoSample}
          type="button"
        >
          데모용 샘플 입력 채우기
        </button>
        <span className="text-xs text-slate-500">로컬 테스트용 고정 본문(이력서·포트폴리오·강조 프로젝트·JD)</span>
      </div>
      {errorMessage ? (
        <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </pre>
      ) : null}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 rounded-lg border border-slate-200 p-3">
          <span className="text-sm font-medium text-slate-800">이력서 텍스트</span>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={7}
            minLength={20}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-2 rounded-lg border border-slate-200 p-3">
          <span className="text-sm font-medium text-slate-800">포트폴리오 텍스트</span>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={7}
            minLength={20}
            value={portfolioText}
            onChange={(e) => setPortfolioText(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-2 rounded-lg border border-slate-200 p-3">
          <span className="text-sm font-medium text-slate-800">강조하고 싶은 프로젝트 (선택)</span>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={5}
            value={projectText}
            onChange={(e) => setProjectText(e.target.value)}
          />
          <span className="text-xs text-slate-500">입력 시 문서 생성/면접 질문에서 우선 근거로 반영됩니다.</span>
        </label>
        <label className="block space-y-2 rounded-lg border border-slate-200 p-3">
          <span className="text-sm font-medium text-slate-800">타겟 채용공고 텍스트</span>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            rows={7}
            minLength={20}
            value={targetJobPostingText}
            onChange={(e) => setTargetJobPostingText(e.target.value)}
            required
          />
        </label>
        <button
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          type="submit"
        >
          {loading ? "저장 중..." : "저장 후 결과 페이지로 이동"}
        </button>
      </form>
    </main>
  );
}
