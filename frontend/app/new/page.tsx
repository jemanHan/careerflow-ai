"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createSource } from "../../lib/api";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [portfolioText, setPortfolioText] = useState("");
  const [projectText, setProjectText] = useState("");
  const [targetJobPostingText, setTargetJobPostingText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
    <main>
      <h1 className="mb-4 text-2xl font-semibold">소스 입력</h1>
      <p className="mb-3 text-sm text-slate-600">
        `resumeText`, `portfolioText`, `targetJobPostingText`는 각각 최소 20자 이상이어야 합니다.
      </p>
      {errorMessage ? (
        <pre className="mb-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </pre>
      ) : null}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span>이력서 텍스트</span>
          <textarea
            rows={7}
            minLength={20}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-2">
          <span>포트폴리오 텍스트</span>
          <textarea
            rows={7}
            minLength={20}
            value={portfolioText}
            onChange={(e) => setPortfolioText(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-2">
          <span>강조하고 싶은 프로젝트 (선택)</span>
          <textarea rows={5} value={projectText} onChange={(e) => setProjectText(e.target.value)} />
        </label>
        <label className="block space-y-2">
          <span>타겟 채용공고 텍스트</span>
          <textarea
            rows={7}
            minLength={20}
            value={targetJobPostingText}
            onChange={(e) => setTargetJobPostingText(e.target.value)}
            required
          />
        </label>
        <button disabled={loading} type="submit">
          {loading ? "저장 중..." : "저장 후 결과 페이지로 이동"}
        </button>
      </form>
    </main>
  );
}
