"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSource } from "../../lib/api";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [portfolioText, setPortfolioText] = useState("");
  const [projectText, setProjectText] = useState("");
  const [targetJobPostingText, setTargetJobPostingText] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createSource({
        resumeText,
        portfolioText,
        projectDescriptions: projectText ? [projectText] : [],
        targetJobPostingText
      });
      router.push(`/results/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 className="mb-4 text-2xl font-semibold">소스 입력</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span>이력서 텍스트</span>
          <textarea rows={7} value={resumeText} onChange={(e) => setResumeText(e.target.value)} required />
        </label>
        <label className="block space-y-2">
          <span>포트폴리오 텍스트</span>
          <textarea rows={7} value={portfolioText} onChange={(e) => setPortfolioText(e.target.value)} required />
        </label>
        <label className="block space-y-2">
          <span>프로젝트 설명 (선택)</span>
          <textarea rows={5} value={projectText} onChange={(e) => setProjectText(e.target.value)} />
        </label>
        <label className="block space-y-2">
          <span>타겟 채용공고 텍스트</span>
          <textarea
            rows={7}
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
