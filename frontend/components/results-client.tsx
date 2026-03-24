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
type FitAnalysisJson = {
  estimatedFitScore?: number;
  scoreLabel?: string;
  disclaimer?: string;
  strengthsHighlight?: string[];
  weakAreas?: string[];
  improvementPoints?: string[];
  previousEstimatedFitScore?: number;
  scoreDelta?: number;
  computedAt?: string;
};

type ApplicationData = {
  status: string;
  projectDescriptions?: string[];
  jobPostingJson?: unknown;
  candidateProfileJson?: { summary?: string; strengths?: string[] };
  gapAnalysisJson?: { matchedSignals?: string[]; missingSignals?: string[]; weakEvidence?: string[] };
  fitAnalysisJson?: FitAnalysisJson;
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
    interviewReport?: Array<{
      section?: "core" | "deep";
      question: string;
      whyAsked: string;
      answerPoints: string[];
      modelAnswer?: string;
      caution?: string;
    }>;
  };
  rewrittenDraftJson?: {
    coverLetter?: string;
    careerDescription?: string;
    projectIntro?: string;
  };
};

const PRIMARY_ACTION_BUTTON_CLASS =
  "w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:bg-slate-300";

export default function ResultsClient({ applicationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<ActionKind>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
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
      setActionMessage("지원 적합도 분석이 완료되었습니다.");
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
      setAnswersByQuestionId({});
      await refetch();
      setActionMessage("보완 내용이 반영되었고 적합도 점수가 갱신되었습니다.");
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
      setActionMessage("면접 대비 리포트가 갱신되었습니다.");
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  const loadingMessage =
    loadingAction === "analysis"
      ? "지원 적합도 분석 중입니다..."
      : loadingAction === "followup"
        ? "답변 반영 및 적합도 갱신 중입니다..."
        : loadingAction === "documents"
          ? "문서 생성 중입니다..."
          : loadingAction === "interview"
            ? "면접 대비 리포트 생성 중입니다..."
            : "";

  useEffect(() => {
    if (!loading || !loadingAction) {
      setProgressPercent(0);
      return;
    }
    const limitByAction: Record<Exclude<ActionKind, null>, number> = {
      analysis: 92,
      followup: 90,
      documents: 88,
      interview: 90
    };
    const maxUntilDone = limitByAction[loadingAction];
    setProgressPercent(6);
    const timer = window.setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= maxUntilDone) return prev;
        const step = prev < 30 ? 4 : prev < 60 ? 3 : prev < 80 ? 2 : 1;
        return Math.min(maxUntilDone, prev + step);
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [loading, loadingAction]);

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[1px]">
          <div className="w-[min(420px,92vw)] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
            <p className="mt-4 text-center text-sm font-semibold text-slate-900">{loadingMessage}</p>
            <p className="mt-1 text-center text-xs text-slate-500">잠시만 기다려 주세요. 결과를 정리하고 있습니다.</p>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-2.5 rounded-full bg-blue-700 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs font-semibold tabular-nums text-slate-600">{progressPercent}%</p>
            <p className="mt-1 text-center text-[11px] text-slate-500">실시간 API 스트리밍이 없어 추정 진행률로 표시됩니다.</p>
          </div>
        </div>
      ) : null}
      {actionMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMessage}</p> : null}
      {error ? <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <LiveView
        answersByQuestionId={answersByQuestionId}
        data={data}
        error={error}
        loading={loading}
        onRunAnalysis={handleRunAnalysis}
        onGenerateDocuments={handleGenerateDocuments}
        onGenerateInterview={handleGenerateInterview}
        onFollowupChange={setAnswersByQuestionId}
        onFollowupSubmit={handleSubmitFollowup}
      />
    </section>
  );
}

function GuidedFollowUpSection(props: {
  loading: boolean;
  questions: string[];
  value: Record<string, string>;
  submittedAnswers: Array<{ questionId: string; answer: string }>;
  onChange: (next: Record<string, string>) => void;
  onSubmit: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const hasQuestions = props.questions.length > 0;
  const hasSubmitted = props.submittedAnswers.length > 0;
  const total = props.questions.length;
  const safeStep = hasQuestions ? Math.min(step, total - 1) : 0;
  const currentIndex = safeStep;
  const key = `q-${currentIndex + 1}`;
  const currentQuestion = props.questions[currentIndex] ?? "";

  useEffect(() => {
    if (hasQuestions && step >= total) {
      setStep(Math.max(0, total - 1));
    }
  }, [hasQuestions, step, total]);

  useEffect(() => {
    setStep(0);
  }, [props.questions]);

  const answeredCount = props.questions.filter((_, index) => {
    const k = `q-${index + 1}`;
    return (props.value[k] ?? "").trim().length > 0;
  }).length;
  const submittedCount = props.submittedAnswers.length;
  const isLast = hasQuestions && currentIndex >= total - 1;

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <h3 className="text-base font-semibold text-slate-900">대화형 보완</h3>
      {hasSubmitted ? (
        <p className="mt-2 text-sm text-slate-600">보완 제출이 완료되었습니다. 필요하면 지원 적합도 분석을 다시 실행해 최신 질문을 받아볼 수 있습니다.</p>
      ) : null}
      {!hasQuestions ? (
        <p className="mt-2 text-sm text-slate-600">
          지원 적합도 분석 실행 후 보완 질문이 표시됩니다. 보완을 건너뛰어도 상단 「문서 생성」으로 초안을 만들 수 있습니다.
        </p>
      ) : !hasSubmitted ? (
        <p className="mt-2 text-xs text-slate-600">제출 시 프로필·적합도가 갱신됩니다.</p>
      ) : null}
      {hasQuestions && !hasSubmitted ? (
        <p className="mt-2 text-xs text-slate-600">
          진행 {currentIndex + 1}/{total} · 입력 완료 {answeredCount}/{total}
          {submittedCount > 0 ? (
            <span className="ml-2 text-emerald-700">제출 이력 {submittedCount}회</span>
          ) : null}
        </p>
      ) : null}
      {hasQuestions && !hasSubmitted ? (
        <div className="mt-3 rounded-lg border border-white bg-white p-3 shadow-sm">
          <p className="text-xs font-medium text-indigo-800">보완 {currentIndex + 1}/{total}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{currentQuestion}</p>
          <label className="mt-2 block">
            <span className="sr-only">답변 입력</span>
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none"
              disabled={props.loading}
              onChange={(event) => props.onChange({ ...props.value, [key]: event.target.value })}
              rows={3}
              value={props.value[key] ?? ""}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={props.loading || currentIndex === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              type="button"
            >
              이전
            </button>
            {!isLast ? (
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={props.loading}
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                type="button"
              >
                다음
              </button>
            ) : (
              <button
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={props.loading}
                onClick={() => void props.onSubmit()}
                type="button"
              >
                보완 제출 (적합도 갱신)
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FitAnalysisPanel({
  data,
  loading,
  onRunAnalysis
}: {
  data: ApplicationData | null;
  loading: boolean;
  onRunAnalysis: () => Promise<void>;
}) {
  const fit = data?.fitAnalysisJson;
  const gap = data?.gapAnalysisJson;
  if (fit == null || typeof fit.estimatedFitScore !== "number") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <button
          className={PRIMARY_ACTION_BUTTON_CLASS}
          disabled={loading}
          onClick={() => void onRunAnalysis()}
          type="button"
        >
          지원 적합도 분석 실행
        </button>
        <h2 className="text-lg font-semibold text-slate-900">지원 적합도 분석</h2>
        <p className="mt-2 text-sm text-slate-600">상단에서 「지원 적합도 분석」을 실행하면 AI 추정 적합도와 보완 포인트가 표시됩니다.</p>
      </section>
    );
  }
  const delta = fit.scoreDelta;
  const score = Math.max(0, Math.min(100, fit.estimatedFitScore ?? 0));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <button
        className="mb-3 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:bg-slate-300"
        disabled={loading}
        onClick={() => void onRunAnalysis()}
        type="button"
      >
        지원 적합도 분석 다시 실행
      </button>
      <h2 className="text-lg font-semibold text-slate-900">지원 적합도 분석</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-slate-200 bg-white">
            <div
              className="relative flex h-28 w-28 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#1d4ed8 ${score * 3.6}deg, #e2e8f0 0deg)`
              }}
            >
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white">
                <p className="text-2xl font-bold tabular-nums text-slate-900">{score}</p>
                <p className="text-[10px] text-slate-500">/ 100</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-medium text-slate-700">{fit.scoreLabel ?? "AI 추정 서류·직무 적합도"}</p>
          {typeof delta === "number" ? (
            <p
              className={`mx-auto mt-2 w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                delta > 0 ? "bg-emerald-100 text-emerald-800" : delta < 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
              }`}
            >
              이전 대비 {delta > 0 ? "+" : ""}
              {delta}점
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{fit.disclaimer}</p>
        </div>
        <div className="space-y-3">
          {gap?.missingSignals != null && gap.missingSignals.length > 0 ? (
            <InfoCard title="공고 대비 부족한 신호" tone="warn" items={gap.missingSignals.slice(0, 8).map(toKoreanSignal)} />
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard title="강점·맞는 점" tone="neutral" items={(fit.strengthsHighlight ?? []).length ? fit.strengthsHighlight! : ["요약 없음"]} />
            <InfoCard
              title="부족·약한 근거"
              tone="neutral"
              items={(fit.weakAreas ?? []).length ? fit.weakAreas!.slice(0, 6).map(toKoreanSignal) : ["특이 사항 없음"]}
            />
          </div>
          <InfoCard title="추천 보완 방향" tone="neutral" ordered items={fit.improvementPoints ?? []} />
        </div>
      </div>
      <CandidateSnapshot data={data} />
    </section>
  );
}

function InfoCard({
  title,
  items,
  ordered = false,
  tone = "neutral"
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  tone?: "neutral" | "warn";
}) {
  const boxClass =
    tone === "warn" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50";
  const textClass = tone === "warn" ? "text-amber-950" : "text-slate-800";
  const ListTag = ordered ? "ol" : "ul";
  return (
    <section className={`rounded-xl border p-3 ${boxClass}`}>
      <p className={`text-sm font-semibold ${textClass}`}>{title}</p>
      <ListTag className={`mt-2 space-y-1 pl-5 text-sm ${ordered ? "list-decimal" : "list-disc"} ${textClass}`}>
        {items.map((item, idx) => (
          <li key={`${title}-${idx}-${item.slice(0, 20)}`}>{item}</li>
        ))}
      </ListTag>
    </section>
  );
}

function LiveView({
  data,
  error,
  loading,
  onRunAnalysis,
  onGenerateDocuments,
  onGenerateInterview,
  answersByQuestionId,
  onFollowupChange,
  onFollowupSubmit
}: {
  data: ApplicationData | null;
  error: string;
  loading: boolean;
  onRunAnalysis: () => Promise<void>;
  onGenerateDocuments: () => Promise<void>;
  onGenerateInterview: () => Promise<void>;
  answersByQuestionId: Record<string, string>;
  onFollowupChange: (next: Record<string, string>) => void;
  onFollowupSubmit: () => Promise<void>;
}) {
  const [copiedKey, setCopiedKey] = useState<string>("");
  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  const latestRuns = [...(data?.workflowRuns ?? [])].sort((a, b) => b.id - a.id).slice(0, 8);
  const latestLlmRun = latestRuns.find((run) => run.inputJson?.llmExecution);
  const llmExecution = latestLlmRun?.inputJson?.llmExecution;
  const isFallbackActive = llmExecution?.fallbackUsed;
  const hasPrioritizedProject = Boolean(data?.projectDescriptions?.[0]?.trim());
  const fallbackReason = llmExecution?.fallbackReason ?? "";
  const isProviderUnavailable = /503|service unavailable|high demand/i.test(fallbackReason);
  const isRateLimited = /429|quota|rate|resource_exhausted/i.test(fallbackReason);
  const hasReadableResult =
    typeof data?.fitAnalysisJson?.estimatedFitScore === "number" ||
    Boolean(data?.generatedDraftJson?.coverLetter?.trim()) ||
    Boolean(data?.generatedDraftJson?.careerDescription?.trim()) ||
    Boolean(data?.generatedDraftJson?.projectIntro?.trim()) ||
    (data?.generatedDraftJson?.interviewReport?.length ?? 0) > 0 ||
    (data?.generatedDraftJson?.interviewQuestions?.length ?? 0) > 0;
  const showLimitNotice = isFallbackActive && isRateLimited && !hasReadableResult;

  async function handleCopy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1200);
    } catch {
      setCopiedKey("");
    }
  }
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
      reasons.push(`면접 대비 리포트는 강점(${data?.candidateProfileJson?.strengths?.slice(0, 3).join(", ")})의 실제 증빙을 검증하는 질문을 포함할 수 있습니다.`);
    }
    if (llmExecution) {
      reasons.push(`최근 실행 모델은 ${llmExecution.provider}/${llmExecution.model}이며 fallback=${String(llmExecution.fallbackUsed)} 입니다.`);
    }
    return reasons;
  }, [data, llmExecution]);
  const interviewReport = data?.generatedDraftJson?.interviewReport ?? [];
  const coreItems = interviewReport.filter((item) => item.section !== "deep").slice(0, 3);
  const deepItems = interviewReport.filter((item) => item.section === "deep");

  return (
    <section className="space-y-4">
      <FitAnalysisPanel data={data} loading={loading} onRunAnalysis={onRunAnalysis} />
      <GuidedFollowUpSection
        loading={loading}
        onChange={onFollowupChange}
        onSubmit={onFollowupSubmit}
        questions={data?.followUpQuestions ?? []}
        submittedAnswers={data?.followUpAnswersJson ?? []}
        value={answersByQuestionId}
      />
      {showLimitNotice ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">
            !! 현재는 API 한도 이슈로 fallback 결과가 표시될 수 있습니다. 일정 시간 후 다시 시도하거나, 사이트 기능 테스트가 필요하시면 이력서의 연락처로 문자 주시면 확인 즉시 API 한도 조정을 진행하도록 하겠습니다^^ !!
          </p>
          <p className="mt-2 text-xs text-amber-900/80">사유 요약: {isProviderUnavailable ? "일시적 과부하(503)" : "호출 한도/속도 제한(429 계열)"}</p>
        </section>
      ) : null}
      {!showLimitNotice && isFallbackActive && !hasReadableResult && !isProviderUnavailable ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">LLM 응답이 불안정하여 임시 결과로 표시되었습니다.</p>
          <p className="mt-1">잠시 후 다시 실행하면 정상 결과로 대체될 수 있습니다.</p>
        </section>
      ) : null}
      {data?.projectDescriptions?.[0] ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-medium">강조 프로젝트 반영됨!</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-emerald-700">입력한 내용 펼쳐보기</summary>
            <p className="mt-1 whitespace-pre-wrap">{data.projectDescriptions[0]}</p>
          </details>
        </div>
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">왜 이런 결과가 나왔나 (도출 근거 요약)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {summaryReasons.length === 0 ? <li>아직 충분한 분석 결과가 없습니다.</li> : null}
          {summaryReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>
      {isFallbackActive && !hasReadableResult && !isProviderUnavailable ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">LLM 디버그 상세 보기</summary>
          <p className="mt-2">
            provider/model: <code>{llmExecution ? `${llmExecution.provider}/${llmExecution.model}` : "미확인"}</code>
          </p>
          <p className="mt-1">
            provider key: <code>{String(llmExecution?.hasProviderApiKey ?? false)}</code>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">
            reason: <code>{llmExecution?.fallbackReason ?? "unknown"}</code>
          </p>
        </details>
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <button
          className={`mb-3 ${PRIMARY_ACTION_BUTTON_CLASS}`}
          disabled={loading}
          onClick={() => void onGenerateDocuments()}
          type="button"
        >
          문서 생성
        </button>
        <h3 className="text-lg font-semibold text-slate-900">문서 생성 결과</h3>
        {data?.generatedDraftJson?.coverLetter ? null : (
          <p className="mb-2 text-sm text-amber-700">
            아직 문서 본문이 없습니다. 먼저 분석 실행 후 문서 생성을 다시 눌러주세요.
          </p>
        )}
        <DocumentBlock
          title="자기소개 초안"
          text={toReadableDraftText(data?.generatedDraftJson?.coverLetter)}
          copyKey="cover"
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
        <DocumentBlock
          title="경력기술서 초안"
          text={toReadableDraftText(mergeCareerGuide(data?.generatedDraftJson?.careerDescription, data?.generatedDraftJson?.projectIntro))}
          copyKey="career"
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
        <DocumentBlock
          title="프로젝트 소개문구"
          text={toReadableDraftText(data?.generatedDraftJson?.projectIntro)}
          copyKey="project"
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />
        <details className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">경력기술서 작성 팁 보기</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>길게 서술하기보다 직무 연관 경험을 위쪽에 짧고 명확하게 정리하세요.</li>
            <li>기술/도구는 실제 사용한 항목만 적고, 면접에서 설명 가능한 수준으로 제한하세요.</li>
            <li>경험은 역할, 사용기술, 결과(개선/기여)를 한 묶음으로 쓰면 읽히기 쉽습니다.</li>
          </ul>
        </details>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <button
          className={`mb-3 ${PRIMARY_ACTION_BUTTON_CLASS}`}
          disabled={loading}
          onClick={() => void onGenerateInterview()}
          type="button"
        >
          면접 대비 리포트 생성
        </button>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">면접 대비 리포트</h3>
          <button
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => void handleCopy("interview", (data?.generatedDraftJson?.interviewQuestions ?? []).join("\n"))}
            type="button"
          >
            {copiedKey === "interview" ? "복사됨" : "복사"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          제출 서류·강조 프로젝트·JD를 바탕으로 한 심층 질문 목록입니다. 대화형 보완(서류용)과 목적이 다릅니다.
        </p>
        {interviewReport.length > 0 ? (
          <div className="mt-3 space-y-4">
            <InterviewSection title="핵심 질문" items={coreItems} startIndex={1} />
            <InterviewSection title="심화 질문" items={deepItems} startIndex={coreItems.length + 1} />
          </div>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
            {(data?.generatedDraftJson?.interviewQuestions ?? []).map((q, idx) => (
              <li key={`${idx}-${q}`}>{q}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function InterviewSection({
  title,
  items,
  startIndex
}: {
  title: string;
  items: Array<{
    question: string;
    whyAsked: string;
    answerPoints: string[];
    modelAnswer?: string;
    caution?: string;
  }>;
  startIndex: number;
}) {
  const [openModelAnswerByIndex, setOpenModelAnswerByIndex] = useState<Record<number, boolean>>({});
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 space-y-3">
        {items.map((item, idx) => (
          <article key={`${title}-${idx}-${item.question}`} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">Q{startIndex + idx}. {item.question}</p>
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">왜 물었나:</span> {item.whyAsked}
            </p>
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-700">답변 준비 포인트</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-700">
                {(item.answerPoints ?? []).map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
            {item.caution ? (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                주의: {item.caution}
              </p>
            ) : null}
            {title === "핵심 질문" ? (
              <div className="mt-3">
                <button
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    setOpenModelAnswerByIndex((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  type="button"
                >
                  {openModelAnswerByIndex[idx] ? "모범답안 숨기기" : "모범답안 보기"}
                </button>
                {openModelAnswerByIndex[idx] ? (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs font-semibold text-blue-900">참고용 모범답안</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-blue-950">{item.modelAnswer?.trim() || buildModelAnswer(item)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function buildModelAnswer(item: { question: string; whyAsked: string; answerPoints: string[]; caution?: string }): string {
  const points = (item.answerPoints ?? []).slice(0, 3);
  const body = points.map((p, i) => `${i + 1}) ${p}`).join("\n");
  const cautionLine = item.caution ? `주의사항: ${item.caution}` : "주의사항: 근거 없는 수치/역할 과장은 피하고, 실제 경험 중심으로 답변";
  return [
    `핵심 요약: ${item.whyAsked}`,
    "답변 구조(권장):",
    body,
    "예시 마무리:",
    "해당 경험을 통해 어떤 판단을 했고, 결과를 어떻게 검증했는지까지 연결해 설명합니다.",
    cautionLine
  ].join("\n");
}

function DocumentBlock({
  title,
  text,
  copyKey,
  copiedKey,
  onCopy
}: {
  title: string;
  text: string;
  copyKey: string;
  copiedKey: string;
  onCopy: (key: string, text: string) => Promise<void>;
}) {
  return (
    <article className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <button
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => void onCopy(copyKey, text)}
          type="button"
        >
          {copiedKey === copyKey ? "복사됨" : "복사"}
        </button>
      </div>
      <div className="max-h-[30rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-4 py-3 text-[15px] leading-8 text-slate-800 break-words">
        {text ? renderDocumentText(text) : "문서 생성 전"}
      </div>
    </article>
  );
}

function renderDocumentText(text: string) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 whitespace-pre-wrap">
      {lines.map((raw, idx) => {
        const line = raw.replace(/\*\*/g, "").trimEnd();
        if (!line.trim()) return <div key={`empty-${idx}`} className="h-1.5" />;
        if (isSectionHeading(line)) {
          const toneClass = getHeadingToneClass(line);
          return (
            <div key={`h-${idx}`} className="pt-1">
              <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
                {line.replace(/^-\s*/, "")}
              </span>
            </div>
          );
        }
        if (line.trim().startsWith("- ")) {
          return (
            <p key={`b-${idx}`} className="pl-1 text-slate-800">
              {line}
            </p>
          );
        }
        return (
          <p key={`p-${idx}`} className="text-slate-800">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function isSectionHeading(line: string): boolean {
  const normalized = line.replace(/^-\s*/, "").trim();
  if (!normalized) return false;
  if (normalized.length > 34) return false;
  if (normalized.endsWith(":")) return true;
  if (/^Q\d+/.test(normalized)) return false;
  // 문장형(종결 어미/마침표)보다 항목형 짧은 라벨을 섹션 헤더로 본다.
  if (/[.!?]$/.test(normalized)) return false;
  if (/(다|요)\.?$/.test(normalized)) return false;
  return /[가-힣A-Za-z]/.test(normalized);
}

function getHeadingToneClass(text: string): string {
  const tones = [
    "border-blue-200 bg-blue-50 text-blue-800",
    "border-emerald-200 bg-emerald-50 text-emerald-800",
    "border-violet-200 bg-violet-50 text-violet-800",
    "border-amber-200 bg-amber-50 text-amber-800",
    "border-slate-300 bg-slate-100 text-slate-800"
  ];
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return tones[hash % tones.length];
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
  const career = toReadableDraftText(careerDescription);
  const project = toReadableDraftText(projectIntro);
  if (!career && !project) {
    return "경력기술서 초안 생성 전";
  }
  if (!project) {
    return career;
  }
  if (!career) {
    return `프로젝트 근거 정리\n${project}`;
  }
  return `${career}\n\n[프로젝트 근거 정리]\n${project}`;
}

function toReadableDraftText(value?: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return toReadableUnknown(parsed);
    } catch {
      return raw;
    }
  }
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");
  const starts = [objectStart, arrayStart].filter((idx) => idx >= 0);
  if (starts.length > 0) {
    const start = Math.min(...starts);
    if (start > 0) {
      const prefix = raw.slice(0, start).trim();
      const jsonPart = raw.slice(start);
      try {
        const parsed = JSON.parse(jsonPart) as unknown;
        const parsedText = toReadableUnknown(parsed);
        return prefix ? `${prefix}\n${parsedText}` : parsedText;
      } catch {
        return raw;
      }
    }
  }
  return raw;
}

function toReadableUnknown(input: unknown, depth = 0): string {
  if (input == null) return "";
  if (typeof input === "string") return input.trim();
  if (Array.isArray(input)) {
    return input
      .map((item) => toReadableUnknown(item, depth + 1))
      .filter((line) => line.length > 0)
      .map((line) => `- ${line}`)
      .join("\n");
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const lines: string[] = [];
    const keyMap: Record<string, string> = {
      bullets: "핵심 내용",
      summary: "요약",
      experienceHighlights: "주요 경험",
      title: "제목",
      name: "이름",
      description: "설명",
      caution: "주의"
    };
    for (const [k, v] of Object.entries(obj)) {
      const child = toReadableUnknown(v, depth + 1);
      if (!child) continue;
      const koKey = keyMap[k] ?? k;
      if (depth === 0) {
        lines.push(`${koKey}`);
        lines.push(child.split("\n").map((line) => `- ${line}`).join("\n"));
      } else {
        lines.push(`${koKey}: ${child}`);
      }
    }
    return lines.join("\n");
  }
  return String(input);
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
