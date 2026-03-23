"use client";

import { useEffect, useState } from "react";
import {
  fetchApplication,
  generateDocuments,
  generateInterview,
  runAnalysis,
  submitFollowup
} from "../lib/api";

type Props = { applicationId: number };
type ApplicationData = {
  status: string;
  candidateProfileJson?: { summary?: string; strengths?: string[] };
  gapAnalysisJson?: { matchedSignals?: string[]; missingSignals?: string[]; weakEvidence?: string[] };
  followUpQuestions?: string[];
  generatedDraftJson?: {
    coverLetter?: string;
    careerDescription?: string;
    projectIntro?: string;
    interviewQuestions?: string[];
  };
  rewrittenDraftJson?: {
    coverLetter?: string;
    careerDescription?: string;
    projectIntro?: string;
  };
};

export default function ResultsClient({ applicationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [answersText, setAnswersText] = useState("");

  async function refetch() {
    setRefreshKey((prev) => prev + 1);
  }

  async function handleRunAnalysis() {
    setLoading(true);
    try {
      await runAnalysis(applicationId);
      await refetch();
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFollowup() {
    setLoading(true);
    try {
      const answers = answersText
        .split("\n")
        .map((line, index) => ({ questionId: `q-${index + 1}`, answer: line.trim() }))
        .filter((item) => item.answer.length > 0);
      if (answers.length === 0) {
        return;
      }
      await submitFollowup(applicationId, answers);
      await refetch();
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDocuments() {
    setLoading(true);
    try {
      await generateDocuments(applicationId, true);
      await refetch();
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateInterview() {
    setLoading(true);
    try {
      await generateInterview(applicationId);
      await refetch();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <button disabled={loading} onClick={handleRunAnalysis} type="button">
          분석 실행
        </button>
        <button disabled={loading} onClick={handleGenerateDocuments} type="button">
          문서 생성
        </button>
        <button disabled={loading} onClick={handleGenerateInterview} type="button">
          면접 질문 생성
        </button>
      </div>
      <label className="block space-y-2">
        <span>후속 답변(한 줄=한 답변)</span>
        <textarea rows={5} value={answersText} onChange={(e) => setAnswersText(e.target.value)} />
      </label>
      <button disabled={loading} onClick={handleSubmitFollowup} type="button">
        후속 답변 제출
      </button>
      <LiveView applicationId={applicationId} refreshKey={refreshKey} />
    </section>
  );
}

function LiveView({ applicationId, refreshKey }: { applicationId: number; refreshKey: number }) {
  const [data, setData] = useState<ApplicationData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void fetchApplication(applicationId)
      .then((result) => {
        setData(result as ApplicationData);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "load failed");
      });
  }, [applicationId, refreshKey]);

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">분석 요약</h2>
      <p className="text-sm">상태: {data?.status ?? "-"}</p>
      <p className="text-sm">{data?.candidateProfileJson?.summary ?? "분석 전"}</p>
      <div>
        <h3 className="font-medium">후속 질문</h3>
        <ul className="list-disc pl-6 text-sm">
          {(data?.followUpQuestions ?? []).map((q, idx) => (
            <li key={`${idx}-${q}`}>{q}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-medium">생성 문서</h3>
        <pre className="max-h-56 overflow-auto rounded bg-slate-100 p-2 text-xs">
          {data?.generatedDraftJson?.coverLetter ?? "문서 생성 전"}
        </pre>
      </div>
      <div>
        <h3 className="font-medium">면접 질문</h3>
        <ul className="list-disc pl-6 text-sm">
          {(data?.generatedDraftJson?.interviewQuestions ?? []).map((q, idx) => (
            <li key={`${idx}-${q}`}>{q}</li>
          ))}
        </ul>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">Raw JSON 보기</summary>
        <pre className="max-h-[360px] overflow-auto rounded bg-slate-900 p-3 text-xs text-white">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </section>
  );
}
