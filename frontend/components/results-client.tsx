"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  fetchApplication,
  generateDocuments,
  generateInterview,
  runAnalysis,
  submitFollowup
} from "../lib/api";

type Props = { applicationId: number };
type ActionKind = "analysis" | "followup" | "documents" | "interview" | null;
type ApplicationData = {
  status: string;
  projectDescriptions?: string[];
  jobPostingJson?: unknown;
  candidateProfileJson?: { summary?: string; strengths?: string[] };
  gapAnalysisJson?: { matchedSignals?: string[]; missingSignals?: string[]; weakEvidence?: string[] };
  followUpQuestions?: string[];
  followUpAnswersJson?: Array<{ questionId: string; answer: string }>;
  workflowRuns?: Array<{
    id: number;
    stage: string;
    errorMessage?: string | null;
    createdAt: string;
    inputJson?: {
      llmExecution?: {
        provider?: string;
        model?: string;
        fallbackUsed?: boolean;
        fallbackReason?: string;
        hasProviderApiKey?: boolean;
      };
    } | null;
  }>;
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
  const [loadingAction, setLoadingAction] = useState<ActionKind>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>({});
  const [data, setData] = useState<ApplicationData | null>(null);
  const [error, setError] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");

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

  async function refetch() {
    setRefreshKey((prev) => prev + 1);
  }

  function setApiError(err: unknown) {
    if (err instanceof ApiError) {
      setError(err.message);
      return;
    }
    if (err instanceof Error) {
      setError(err.message);
      return;
    }
    setError("요청 처리 중 알 수 없는 오류가 발생했습니다.");
  }

  async function handleRunAnalysis() {
    setLoading(true);
    setLoadingAction("analysis");
    setError("");
    setActionMessage("");
    try {
      await runAnalysis(applicationId, true);
      await refetch();
      setActionMessage("분석 재실행 완료");
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleSubmitFollowup() {
    setLoading(true);
    setLoadingAction("followup");
    setError("");
    setActionMessage("");
    try {
      const answers = (data?.followUpQuestions ?? [])
        .map((question, index) => ({
          questionId: `q-${index + 1}`,
          answer: (answersByQuestionId[`q-${index + 1}`] ?? "").trim(),
          question
        }))
        .filter((item) => item.answer.length > 0);
      if (answers.length === 0) {
        setActionMessage("후속 답변을 먼저 입력해 주세요.");
        return;
      }
      await submitFollowup(
        applicationId,
        answers.map((item) => ({ questionId: item.questionId, answer: item.answer })),
        true
      );
      await refetch();
      setActionMessage("후속 답변 제출 완료 (후보자 요약이 답변 반영 형태로 재분석됩니다)");
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleGenerateDocuments() {
    setLoading(true);
    setLoadingAction("documents");
    setError("");
    setActionMessage("");
    try {
      await generateDocuments(applicationId, true, true);
      await refetch();
      setActionMessage("문서 재생성 완료");
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleGenerateInterview() {
    setLoading(true);
    setLoadingAction("interview");
    setError("");
    setActionMessage("");
    try {
      await generateInterview(applicationId, true);
      await refetch();
      setActionMessage("면접 질문 재생성 완료");
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  const loadingMessage =
    loadingAction === "analysis"
      ? "분석 중입니다..."
      : loadingAction === "followup"
        ? "후속 답변 반영 중입니다..."
        : loadingAction === "documents"
          ? "문서 생성 중입니다..."
          : loadingAction === "interview"
            ? "면접 질문 생성 중입니다..."
            : "";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span>{loadingMessage}</span>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        <button
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          onClick={handleRunAnalysis}
          type="button"
        >
          분석 실행
        </button>
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          onClick={handleGenerateDocuments}
          type="button"
        >
          문서 생성
        </button>
        <button
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          onClick={handleGenerateInterview}
          type="button"
        >
          면접 질문 생성
        </button>
      </div>
      {actionMessage ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionMessage}</p> : null}
      {error ? <p className="whitespace-pre-wrap rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      <FollowUpAnswerForm
        loading={loading}
        questions={data?.followUpQuestions ?? []}
        value={answersByQuestionId}
        submittedAnswers={data?.followUpAnswersJson ?? []}
        onChange={setAnswersByQuestionId}
        onSubmit={handleSubmitFollowup}
      />
      <LiveView data={data} error={error} />
    </section>
  );
}

function FollowUpAnswerForm(props: {
  loading: boolean;
  questions: string[];
  value: Record<string, string>;
  submittedAnswers: Array<{ questionId: string; answer: string }>;
  onChange: (next: Record<string, string>) => void;
  onSubmit: () => Promise<void>;
}) {
  const hasQuestions = props.questions.length > 0;
  const answeredCount = props.questions.filter((_, index) => {
    const key = `q-${index + 1}`;
    return (props.value[key] ?? "").trim().length > 0;
  }).length;
  const totalLength = props.questions.reduce((acc, _, index) => {
    const key = `q-${index + 1}`;
    return acc + (props.value[key] ?? "").trim().length;
  }, 0);
  const averageLength = answeredCount > 0 ? Math.round(totalLength / answeredCount) : 0;
  const completionScore = hasQuestions ? Math.round((answeredCount / props.questions.length) * 100) : 0;
  const qualityBonus = Math.min(20, Math.floor(averageLength / 20));
  const answerScore = Math.min(100, completionScore + qualityBonus);
  const submittedCount = props.submittedAnswers.length;

  const scoreGuide =
    answerScore >= 85
      ? "좋아요. 근거 중심으로 잘 작성되었습니다."
      : answerScore >= 60
        ? "보통입니다. 수치/성과/역할을 더 구체적으로 써보세요."
        : "보완 필요. 질문별로 본인 역할, 기술, 결과를 2~3문장 이상 작성해보세요.";
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">후속 답변 입력</h3>
      <p className="mt-1 text-xs text-slate-600">
        후속 답변을 제출하면 답변 근거가 후보자 프로필 재분석에 반영됩니다.
      </p>
      {!hasQuestions ? <p className="mt-2 text-sm text-slate-500">분석 실행 후 후속 질문이 표시됩니다.</p> : null}
      {hasQuestions ? (
        <div className="mt-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <p>
            답변 점수: <span className="font-semibold">{answerScore}</span>/100
            {"  "}({answeredCount}/{props.questions.length}개 입력, 평균 {averageLength}자)
          </p>
          <p className="mt-1">{scoreGuide}</p>
          {submittedCount > 0 ? <p className="mt-1 text-emerald-700">최근 제출 답변 수: {submittedCount}개</p> : null}
        </div>
      ) : null}
      <div className="mt-3 space-y-3">
        {props.questions.map((question, index) => {
          const key = `q-${index + 1}`;
          return (
            <label key={key} className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Q{index + 1}. {question}
              </span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={props.loading}
                onChange={(event) => props.onChange({ ...props.value, [key]: event.target.value })}
                placeholder="이 질문에 대한 본인 경험/근거를 입력하세요."
                value={props.value[key] ?? ""}
              />
            </label>
          );
        })}
      </div>
      <button
        className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={props.loading || !hasQuestions}
        onClick={() => void props.onSubmit()}
        type="button"
      >
        후속 답변 제출
      </button>
    </section>
  );
}

function LiveView({ data, error }: { data: ApplicationData | null; error: string }) {
  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  const latestRuns = [...(data?.workflowRuns ?? [])].sort((a, b) => b.id - a.id).slice(0, 8);
  const latestLlmRun = latestRuns.find((run) => run.inputJson?.llmExecution);
  const llmExecution = latestLlmRun?.inputJson?.llmExecution;
  const isFallbackActive = llmExecution?.fallbackUsed;
  const summaryReasons = useMemo(() => {
    const reasons: string[] = [];
    const gap = data?.gapAnalysisJson;
    if ((gap?.missingSignals ?? []).length > 0) {
      reasons.push(
        `후속 질문은 누락 신호(${(gap?.missingSignals ?? []).slice(0, 3).map(toKoreanSignal).join(", ")})를 보완하기 위해 생성되었습니다.`
      );
    }
    if ((gap?.weakEvidence ?? []).length > 0) {
      reasons.push(
        `문서 초안은 약한 근거(${(gap?.weakEvidence ?? []).slice(0, 2).map(toKoreanSignal).join(", ")})를 강화하는 방향으로 생성되었습니다.`
      );
    }
    if ((data?.candidateProfileJson?.strengths ?? []).length > 0) {
      reasons.push(`면접 질문은 강점(${data?.candidateProfileJson?.strengths?.slice(0, 3).join(", ")})의 실제 증빙을 검증하도록 생성되었습니다.`);
    }
    if (llmExecution) {
      reasons.push(`최근 실행 모델은 ${llmExecution.provider}/${llmExecution.model}이며 fallback=${String(llmExecution.fallbackUsed)} 입니다.`);
    }
    return reasons;
  }, [data, llmExecution]);

  return (
    <section className="space-y-4">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">현재 상태 요약</h2>
        <p className="mt-2 text-sm text-slate-600">상태: {data?.status ?? "-"}</p>
        <CandidateSnapshot data={data} />
      </section>
      {isFallbackActive ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">현재 LLM 실응답이 아니라 fallback 결과입니다.</p>
          <p className="mt-1">
            reason: <code>{llmExecution?.fallbackReason ?? "unknown"}</code> / provider key:
            {" "}
            <code>{String(llmExecution?.hasProviderApiKey ?? false)}</code>
          </p>
        </div>
      ) : null}
      {data?.projectDescriptions?.[0] ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-medium">강조 프로젝트 반영됨!</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-emerald-700">입력한 내용 펼쳐보기</summary>
            <p className="mt-1 whitespace-pre-wrap">{data.projectDescriptions[0]}</p>
          </details>
        </div>
      ) : null}
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900">왜 이런 결과가 나왔나 (도출 근거 요약)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {summaryReasons.length === 0 ? <li>아직 충분한 분석 결과가 없습니다.</li> : null}
          {summaryReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900">생성 문서</h3>
        {data?.generatedDraftJson?.coverLetter ? null : (
          <p className="mb-2 text-sm text-amber-700">
            아직 문서 본문이 없습니다. 먼저 분석 실행 후 문서 생성을 다시 눌러주세요.
          </p>
        )}
        <p className="mb-1 mt-2 text-sm font-semibold text-slate-700">지원동기/자기소개 초안</p>
        <pre className="max-h-64 overflow-auto rounded bg-slate-100 p-3 text-sm leading-6 text-slate-800">
          {data?.generatedDraftJson?.coverLetter ?? "문서 생성 전"}
        </pre>
        <p className="mb-1 mt-4 text-sm font-semibold text-slate-700">경력기술서 도우미 (경력 + 프로젝트 근거 통합)</p>
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-100 p-3 text-sm leading-6 text-slate-800">
          {mergeCareerGuide(data?.generatedDraftJson?.careerDescription, data?.generatedDraftJson?.projectIntro)}
        </pre>
      </section>
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900">면접 예상 질문</h3>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
          {(data?.generatedDraftJson?.interviewQuestions ?? []).map((q, idx) => (
            <li key={`${idx}-${q}`}>{q}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function CandidateSnapshot({ data }: { data: ApplicationData | null }) {
  const strengths = data?.candidateProfileJson?.strengths ?? [];
  const missing = data?.gapAnalysisJson?.missingSignals ?? [];
  const weak = data?.gapAnalysisJson?.weakEvidence ?? [];
  const level = (data?.candidateProfileJson?.summary ?? "").includes("신입")
    ? "신입/주니어 중심"
    : "경력/실무 중심";

  return (
    <div className="mt-2 space-y-2 text-sm text-slate-800">
      <p>
        <span className="font-medium">경력 레벨:</span> {level}
      </p>
      <p>
        <span className="font-medium">특화 포인트:</span> {strengths.length > 0 ? strengths.join(", ") : "분석 데이터 대기 중"}
      </p>
      <p>
        <span className="font-medium">주요 보완점:</span>{" "}
        {[...missing, ...weak].slice(0, 3).map(toKoreanSignal).join(", ") || "현재 보완점 데이터 없음"}
      </p>
    </div>
  );
}

function mergeCareerGuide(careerDescription?: string, projectIntro?: string): string {
  const career = (careerDescription ?? "").trim();
  const project = (projectIntro ?? "").trim();
  if (!career && !project) {
    return "경력기술서 도우미 생성 전";
  }
  if (!project) {
    return career;
  }
  if (!career) {
    return `프로젝트 근거 정리\n${project}`;
  }
  return `${career}\n\n[프로젝트 근거 정리]\n${project}`;
}

function toKoreanSignal(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("rag")) return "문서 검색/참조 기반 생성 경험";
  if (normalized.includes("agent")) return "단계형 워크플로우 설계 경험";
  if (normalized.includes("next.js")) return "Next.js 실무 적용 경험";
  if (normalized.includes("typescript")) return "TypeScript 실무 적용 경험";
  if (normalized.includes("aws")) return "배포/운영(AWS) 경험";
  return value;
}
