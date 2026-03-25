"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  fetchApplication,
  generateDocuments,
  generateInterview,
  listMyWorkflows,
  runAnalysis,
  submitFollowup,
  updateApplicationSources
} from "../lib/api";
import { clearFollowupDraft, loadFollowupDraft, saveFollowupDraft } from "../lib/followup-draft";

type Props = { applicationId: number };
type ActionKind = "analysis" | "followup" | "documents" | "interview" | null;
type FitAnalysisJson = {
  analysisPanelTitle?: string;
  disclaimer?: string;
  strengthsHighlight?: string[];
  weakAreas?: string[];
  improvementPoints?: string[];
  computedAt?: string;
  analysisQuality?: string;
  qualityReason?: string;
};

/** 구 스냅샷(점수 필드) 또는 신규(`computedAt`) 기준으로 패널 표시 여부 */
function hasJobPostingFitAnalysis(fit: FitAnalysisJson | null | undefined): boolean {
  if (!fit || typeof fit !== "object") return false;
  const legacy = (fit as { estimatedFitScore?: unknown }).estimatedFitScore;
  if (typeof legacy === "number") return true;
  return typeof fit.computedAt === "string";
}

/** 레거시 저장값·섹션 제목과 중복되는 약한근거 꼬리 문구 제거 */
function stripWeakEvidenceDisplayTail(value: string): string {
  let v = value.trim();
  v = v.replace(/\s*\(언급은 있으나 증빙·구체성이 부족\)\s*$/, "");
  v = v.replace(/\s*\(증빙 보강 권장\)\s*$/, "");
  v = v.replace(/\s*—\s*언급 대비 증빙이 약함\s*$/, "");
  v = v.replace(/\s*—\s*.+$/, "").trim();
  return v || value.trim();
}

type ApplicationData = {
  id?: number;
  status: string;
  testUserId?: string | null;
  resumeText?: string;
  portfolioText?: string;
  targetJobPostingText?: string;
  projectDescriptions?: string[];
  jobPostingJson?: unknown;
  candidateProfileJson?: {
    summary?: string;
    strengths?: string[];
    experiences?: Array<{ title?: string; impact?: string; techStack?: string[] }>;
  };
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>({});
  const skipNextFollowupPersist = useRef(true);
  const [data, setData] = useState<ApplicationData | null>(null);
  const [error, setError] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");
  const [workflowTitle, setWorkflowTitle] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tid = window.localStorage.getItem("careerflow-test-user-id")?.trim() ?? "";
    if (!tid) {
      setWorkflowTitle(`워크플로우 저장 번호 #${applicationId}`);
      return;
    }
    void listMyWorkflows(tid)
      .then(({ applications }) => {
        const sorted = [...applications].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const idx = sorted.findIndex((a) => a.id === applicationId);
        if (idx >= 0) {
          setWorkflowTitle(`${tid}님의 워크플로우 결과 #${idx + 1}`);
        } else {
          setWorkflowTitle(`${tid}님 · 워크플로우 저장 #${applicationId}`);
        }
      })
      .catch(() => setWorkflowTitle(`워크플로우 저장 번호 #${applicationId}`));
  }, [applicationId, refreshKey]);

  useEffect(() => {
    skipNextFollowupPersist.current = true;
    setAnswersByQuestionId(loadFollowupDraft(applicationId));
  }, [applicationId]);

  useEffect(() => {
    if (skipNextFollowupPersist.current) {
      skipNextFollowupPersist.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      saveFollowupDraft(applicationId, answersByQuestionId);
    }, 400);
    return () => window.clearTimeout(t);
  }, [applicationId, answersByQuestionId]);

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
      setActionMessage("공고 대상 장·단점 분석이 완료되었습니다.");
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
      clearFollowupDraft(applicationId);
      setAnswersByQuestionId({});
      await refetch();
      setActionMessage("보완 내용이 반영되었고 장·단점 분석이 갱신되었습니다.");
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

  const headingText = workflowTitle ?? `워크플로우 #${applicationId}`;

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{headingText}</h1>
        <p className="text-sm text-slate-600">
          공고 대상 장·단점 분석 → 대화형 보완 → 문서 생성 → 면접 리포트 순으로 진행해 보세요.
        </p>
      </header>
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[1px]">
          <div className="w-[min(420px,92vw)] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
            <p className="mt-4 text-center text-sm font-semibold text-slate-900">결과 생성 중입니다.</p>
          </div>
        </div>
      ) : null}
      {actionMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMessage}</p> : null}
      {error ? <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <LiveView
        applicationId={applicationId}
        answersByQuestionId={answersByQuestionId}
        data={data}
        error={error}
        loading={loading}
        onRunAnalysis={handleRunAnalysis}
        onGenerateDocuments={handleGenerateDocuments}
        onGenerateInterview={handleGenerateInterview}
        onFollowupChange={setAnswersByQuestionId}
        onFollowupSubmit={handleSubmitFollowup}
        onSourceSaveError={setError}
        onSourceSaveMessage={setActionMessage}
        onSourcesUpdated={() => void refetch()}
      />
      </section>
    </>
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
      {hasQuestions && !hasSubmitted ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          각 질문은 위 분석의 <span className="font-medium text-slate-900">공고 대비 부족한 신호</span>와{" "}
          <span className="font-medium text-slate-900">증빙·구체성이 약한 항목</span>을 짚어 드리는 형태입니다. 신호
          개수에 맞춰 질문 수가 늘어날 수 있습니다(최대 15개). 작성한 항목만 제출되어도 됩니다.
        </p>
      ) : null}
      {hasSubmitted ? (
        <p className="mt-2 text-sm text-slate-600">보완 제출이 완료되었습니다. 필요하면 공고 대상 장·단점 분석을 다시 실행해 최신 질문을 받아볼 수 있습니다.</p>
      ) : null}
      {!hasQuestions ? (
        <p className="mt-2 text-sm text-slate-600">
          공고 대상 장·단점 분석 실행 후 보완 질문이 표시됩니다. 보완을 건너뛰어도 아래 「문서 생성」으로 초안을 만들 수 있습니다.
        </p>
      ) : !hasSubmitted ? (
        <p className="mt-2 text-xs text-slate-600">제출 시 프로필·장·단점 분석이 갱신됩니다.</p>
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
                보완 제출 (분석 갱신)
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FitAnalysisPanel({
  applicationId,
  data,
  loading,
  onRunAnalysis,
  onSourcesUpdated,
  onSourceSaveMessage,
  onSourceSaveError
}: {
  applicationId: number;
  data: ApplicationData | null;
  loading: boolean;
  onRunAnalysis: () => Promise<void>;
  onSourcesUpdated: () => void;
  onSourceSaveMessage: (msg: string) => void;
  onSourceSaveError: (msg: string) => void;
}) {
  const [showSourceInputs, setShowSourceInputs] = useState(false);
  const [editingSources, setEditingSources] = useState(false);
  const [savingSources, setSavingSources] = useState(false);
  const [draftResume, setDraftResume] = useState("");
  const [draftPortfolio, setDraftPortfolio] = useState("");
  const [draftProject, setDraftProject] = useState("");
  const [draftJob, setDraftJob] = useState("");
  const fit = data?.fitAnalysisJson;
  const gap = data?.gapAnalysisJson;
  const fitReasons = useMemo(() => buildFitReasons(data), [data]);
  const missingGap = gap?.missingSignals ?? [];
  const weakGap = gap?.weakEvidence ?? [];

  async function handleSaveSources() {
    const r = draftResume.trim();
    const p = draftPortfolio.trim();
    const j = draftJob.trim();
    if (r.length < 20 || p.length < 20 || j.length < 20) {
      onSourceSaveError("이력서·포트폴리오·채용공고는 각각 20자 이상이어야 합니다.");
      return;
    }
    setSavingSources(true);
    onSourceSaveError("");
    try {
      await updateApplicationSources(applicationId, {
        resumeText: r,
        portfolioText: p,
        projectDescriptions: draftProject.trim() ? [draftProject.trim()] : [],
        targetJobPostingText: j
      });
      setEditingSources(false);
      onSourcesUpdated();
      onSourceSaveMessage("입력 원문이 저장되었습니다. 아래 「공고 대상 장·단점 분석 다시 실행」으로 반영하세요.");
    } catch (err) {
      onSourceSaveError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSavingSources(false);
    }
  }

  if (!hasJobPostingFitAnalysis(fit) || !fit) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">공고 대상 장·단점 분석</h2>
        <p className="mt-2 text-sm text-slate-600">
          입력 서류와 채용공고를 비교한 강점·부족·약한 근거 요약이 표시됩니다. 대화형 보완으로 세부를 채운 뒤 다시 실행하면 갱신됩니다.
        </p>
        <button
          className={`mt-4 ${PRIMARY_ACTION_BUTTON_CLASS}`}
          disabled={loading}
          onClick={() => void onRunAnalysis()}
          type="button"
        >
          공고 대상 장·단점 분석 실행
        </button>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">
        {fit.analysisPanelTitle ?? "공고 대상 장·단점 분석"}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowSourceInputs((prev) => !prev);
            if (showSourceInputs) {
              setEditingSources(false);
            }
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showSourceInputs ? "내가 작성한 내용 숨기기" : "내가 작성한 내용 보기"}
        </button>
        {showSourceInputs && !editingSources ? (
          <button
            type="button"
            disabled={loading || savingSources}
            onClick={() => {
              setDraftResume(data?.resumeText ?? "");
              setDraftPortfolio(data?.portfolioText ?? "");
              setDraftProject(data?.projectDescriptions?.[0] ?? "");
              setDraftJob(data?.targetJobPostingText ?? "");
              setEditingSources(true);
            }}
            className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-50"
          >
            원문 수정
          </button>
        ) : null}
      </div>
      {showSourceInputs ? (
        <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">입력 원문 {editingSources ? "수정" : "확인"}</p>
          {editingSources ? (
            <div className="mt-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                이력서 텍스트
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                  disabled={savingSources}
                  onChange={(e) => setDraftResume(e.target.value)}
                  rows={8}
                  value={draftResume}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                포트폴리오 텍스트
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                  disabled={savingSources}
                  onChange={(e) => setDraftPortfolio(e.target.value)}
                  rows={6}
                  value={draftPortfolio}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                강조 프로젝트 (없으면 비워 두세요)
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                  disabled={savingSources}
                  onChange={(e) => setDraftProject(e.target.value)}
                  rows={4}
                  value={draftProject}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                타겟 채용공고 텍스트
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                  disabled={savingSources}
                  onChange={(e) => setDraftJob(e.target.value)}
                  rows={6}
                  value={draftJob}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingSources}
                  onClick={() => void handleSaveSources()}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
                >
                  {savingSources ? "저장 중…" : "저장"}
                </button>
                <button
                  type="button"
                  disabled={savingSources}
                  onClick={() => setEditingSources(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-xs text-slate-700">
              <InputPreview title="이력서 텍스트" text={data?.resumeText} />
              <InputPreview title="포트폴리오 텍스트" text={data?.portfolioText} />
              <InputPreview title="강조 프로젝트" text={data?.projectDescriptions?.[0]} />
              <InputPreview title="타겟 채용공고 텍스트" text={data?.targetJobPostingText} />
            </div>
          )}
        </section>
      ) : null}
      {fit.disclaimer ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {fit.disclaimer}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 md:items-start">
        <InfoCard
          title="강점·맞는 점"
          tone="neutral"
          items={(fit.strengthsHighlight ?? []).length ? fit.strengthsHighlight! : ["요약 없음"]}
        />
        {missingGap.length > 0 ? (
          <InfoCard title="공고 대비 부족한 신호" tone="warn" items={missingGap.slice(0, 10)} />
        ) : (
          <InfoCard
            title="공고 대비 부족한 신호"
            tone="neutral"
            items={["필수·우대·업무 문맥에서 현재 ‘누락’으로 분류된 신호가 없습니다."]}
          />
        )}
      </div>
      {weakGap.length > 0 ? (
        <div className="mt-3">
          <InfoCard
            title="언급은 있으나 증빙·구체성이 약한 항목"
            tone="neutral"
            items={weakGap.slice(0, 10).map(stripWeakEvidenceDisplayTail)}
          />
        </div>
      ) : null}
      <CandidateSnapshot data={data} />
      <ReasonSummary title="장·단점 분석 근거" items={fitReasons} />
    </section>
  );
}

function InfoCard({
  title,
  items,
  ordered = false,
  tone = "neutral",
  clampLines = false
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  tone?: "neutral" | "warn";
  /** true일 때만 항목당 최대 4줄 말줄임(기본은 전체 표시). */
  clampLines?: boolean;
}) {
  const boxClass =
    tone === "warn" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50";
  const textClass = tone === "warn" ? "text-amber-950" : "text-slate-800";
  const ListTag = ordered ? "ol" : "ul";
  const lineClamp = clampLines ? "line-clamp-4 [overflow-wrap:anywhere]" : "whitespace-pre-wrap break-words [overflow-wrap:anywhere]";
  return (
    <section className={`rounded-xl border p-3 ${boxClass}`}>
      <p className={`text-sm font-semibold ${textClass}`}>{title}</p>
      <ListTag className={`mt-2 space-y-1 pl-5 text-sm ${ordered ? "list-decimal" : "list-disc"} ${textClass}`}>
        {items.map((item, idx) => (
          <li className={lineClamp} key={`${title}-${idx}-${item.slice(0, 24)}`} title={item}>
            {item}
          </li>
        ))}
      </ListTag>
    </section>
  );
}

function LiveView({
  applicationId,
  data,
  error,
  loading,
  onRunAnalysis,
  onGenerateDocuments,
  onGenerateInterview,
  answersByQuestionId,
  onFollowupChange,
  onFollowupSubmit,
  onSourcesUpdated,
  onSourceSaveMessage,
  onSourceSaveError
}: {
  applicationId: number;
  data: ApplicationData | null;
  error: string;
  loading: boolean;
  onRunAnalysis: () => Promise<void>;
  onGenerateDocuments: () => Promise<void>;
  onGenerateInterview: () => Promise<void>;
  answersByQuestionId: Record<string, string>;
  onFollowupChange: (next: Record<string, string>) => void;
  onFollowupSubmit: () => Promise<void>;
  onSourcesUpdated: () => void;
  onSourceSaveMessage: (msg: string) => void;
  onSourceSaveError: (msg: string) => void;
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
    hasJobPostingFitAnalysis(data?.fitAnalysisJson) ||
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
  const interviewReport = data?.generatedDraftJson?.interviewReport ?? [];
  const coreItems = interviewReport.filter((item) => item.section !== "deep").slice(0, 3);
  const deepItems = interviewReport.filter((item) => item.section === "deep");
  const analysisStepComplete = hasJobPostingFitAnalysis(data?.fitAnalysisJson);
  const documentsStepComplete = hasGeneratedDocument(data);
  return (
    <section className="space-y-4">
      <FitAnalysisPanel
        applicationId={applicationId}
        data={data}
        loading={loading}
        onRunAnalysis={onRunAnalysis}
        onSourceSaveError={onSourceSaveError}
        onSourceSaveMessage={onSourceSaveMessage}
        onSourcesUpdated={onSourcesUpdated}
      />
      <GuidedFollowUpSection
        loading={loading}
        onChange={onFollowupChange}
        onSubmit={onFollowupSubmit}
        questions={data?.followUpQuestions ?? []}
        submittedAnswers={data?.followUpAnswersJson ?? []}
        value={answersByQuestionId}
      />
      {analysisStepComplete ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <button
            className={PRIMARY_ACTION_BUTTON_CLASS}
            disabled={loading}
            onClick={() => void onRunAnalysis()}
            type="button"
          >
            공고 대상 장·단점 분석 다시 실행
          </button>
          <p className="mt-2 text-xs text-slate-600">
            대화형 보완을 제출했거나 이력서·공고를 수정했다면, 여기서 다시 실행해 강점·부족 목록을 갱신할 수 있습니다.
          </p>
        </div>
      ) : null}
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
        {!analysisStepComplete ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">2단계 잠금:</span> 위에서 공고 대상 장·단점 분석(1단계)을 먼저 완료하면 문서 생성을 사용할 수 있습니다. 앞 단계 결과가 반영된 초안 품질이 좋아집니다.
          </p>
        ) : (
          <p className="mb-3 text-sm leading-relaxed text-slate-600">
            <span className="font-medium text-slate-800">참고하는 자료:</span> 저장된 이력서·포트폴리오·강조 프로젝트·채용공고 원문과, 1단계에서 만든 지원자 프로필·공고 구조화·갭(부족/약한 점) 분석 결과입니다.
            <br />
            <span className="font-medium text-slate-800">만들어지는 문서:</span> 지원 공고에 맞춘 자기소개서 톤의 초안, 경력기술서 톤의 초안, 프로젝트/성과 소개 문단입니다. (실제 제출 형식에 맞게 다듬어 사용하세요.)
          </p>
        )}
        <h3 className="text-lg font-semibold text-slate-900">문서 생성 결과</h3>
        {analysisStepComplete && !documentsStepComplete ? (
          <p className="mt-2 text-sm text-slate-600">아래에 초안이 표시됩니다. 문서 생성을 실행해 주세요.</p>
        ) : null}
        {documentsStepComplete ? (
          <>
            <DocumentBlock
              title="자기소개 초안"
              text={toReadableDraftText(data?.generatedDraftJson?.coverLetter)}
              copyKey="cover"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <DocumentBlock
              title="경력기술서 초안"
              text={toReadableDraftText(
                mergeCareerGuide(data?.generatedDraftJson?.careerDescription, data?.generatedDraftJson?.projectIntro)
              )}
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
            <ReasonSummary title="문서 생성 도출 근거" items={buildDocumentReasons(data)} />
          </>
        ) : null}
        <button
          className={`mt-4 ${PRIMARY_ACTION_BUTTON_CLASS}`}
          disabled={loading || !analysisStepComplete}
          onClick={() => void onGenerateDocuments()}
          type="button"
        >
          문서 생성
        </button>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        {!documentsStepComplete ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">3단계 안내:</span> 2단계에서 문서 생성을 완료한 뒤 면접 대비 리포트를 생성할 수 있습니다.
          </p>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">면접 대비 리포트</h3>
            <p className="mt-1 text-xs text-slate-500">
              제출 서류·강조 프로젝트·채용공고(JD)를 바탕으로 한 예상 질문과 답변 준비 포인트입니다.
            </p>
          </div>
          {hasInterviewResult(data) ? (
            <button
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => void handleCopy("interview", (data?.generatedDraftJson?.interviewQuestions ?? []).join("\n"))}
              type="button"
            >
              {copiedKey === "interview" ? "복사됨" : "복사"}
            </button>
          ) : null}
        </div>
        {documentsStepComplete && !hasInterviewResult(data) ? (
          <p className="mt-3 text-sm text-slate-600">생성 후 핵심·심화 질문과 답변 준비 포인트가 여기에 표시됩니다.</p>
        ) : null}
        {hasInterviewResult(data) ? (
          <>
            {interviewReport.length > 0 ? (
              <div className="mt-3 space-y-4">
                <InterviewSection title="핵심 질문" items={coreItems} startIndex={1} />
                <InterviewSection title="심화 질문" items={deepItems} startIndex={coreItems.length + 1} />
              </div>
            ) : (
              <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-700">
                {(data?.generatedDraftJson?.interviewQuestions ?? []).map((q, idx) => (
                  <li key={`${idx}-${q}`}>{q}</li>
                ))}
              </ul>
            )}
            <ReasonSummary title="면접 리포트 도출 근거" items={buildInterviewReasons(data)} />
          </>
        ) : null}
        <button
          className={`mt-4 ${PRIMARY_ACTION_BUTTON_CLASS}`}
          disabled={loading || !documentsStepComplete}
          onClick={() => void onGenerateInterview()}
          type="button"
        >
          면접 대비 리포트 생성
        </button>
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
  const body = text.trim();
  return (
    <article className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <button
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          disabled={!body}
          onClick={() => void onCopy(copyKey, text)}
          type="button"
        >
          {copiedKey === copyKey ? "복사됨" : "복사"}
        </button>
      </div>
      <div className="max-h-[30rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-4 py-3 text-[15px] leading-8 text-slate-800 break-words">
        <p className="whitespace-pre-wrap">{body}</p>
      </div>
    </article>
  );
}

function CandidateSnapshot({ data }: { data: ApplicationData | null }) {
  const strengths = data?.candidateProfileJson?.strengths ?? [];
  const missing = data?.gapAnalysisJson?.missingSignals ?? [];
  const weak = (data?.gapAnalysisJson?.weakEvidence ?? []).map(stripWeakEvidenceDisplayTail);

  return (
    <div className="mt-2 space-y-2 text-sm text-slate-800">
      <p className="line-clamp-3 [overflow-wrap:anywhere]" title={strengths.length > 0 ? strengths.join(", ") : undefined}>
        <span className="font-medium">특화 포인트:</span> {strengths.length > 0 ? strengths.join(", ") : "분석 데이터 대기 중"}
      </p>
      <p
        className="line-clamp-3 [overflow-wrap:anywhere]"
        title={[...missing, ...weak].slice(0, 3).join(" · ") || undefined}
      >
        <span className="font-medium">주요 보완점:</span>{" "}
        {[...missing, ...weak].slice(0, 3).join(", ") || "현재 보완점 데이터 없음"}
      </p>
    </div>
  );
}

function InputPreview({ title, text }: { title: string; text?: string }) {
  const normalized = (text ?? "").trim();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-[11px] font-semibold text-slate-700">{title}</p>
      <div
        className="mt-1 max-h-64 overflow-y-auto rounded border border-slate-100 bg-slate-50/60 px-2 py-1.5"
        tabIndex={0}
        aria-label={`${title} 전체 내용`}
      >
        <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-600">
          {normalized.length > 0 ? normalized : "—"}
        </p>
      </div>
    </section>
  );
}

function ReasonSummary({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-xs font-semibold text-slate-800">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function buildFitReasons(data: ApplicationData | null): string[] {
  if (!data) return [];
  const reasons: string[] = [];
  const gap = data.gapAnalysisJson;
  if ((gap?.matchedSignals ?? []).length > 0) {
    reasons.push(`공고와 맞는 신호(${(gap?.matchedSignals ?? []).slice(0, 3).join(", ")})가 강점·맞는 점 요약에 반영되었습니다.`);
  }
  if ((gap?.missingSignals ?? []).length > 0) {
    reasons.push(`누락 신호(${(gap?.missingSignals ?? []).slice(0, 2).join(", ")})가 감점 요인으로 반영되었습니다.`);
  }
  if ((gap?.weakEvidence ?? []).length > 0) {
    const w = (gap?.weakEvidence ?? []).slice(0, 2).map(stripWeakEvidenceDisplayTail);
    reasons.push(`약한 근거(${w.join(", ")})는 보강 필요 항목으로 분류되었습니다.`);
  }
  return reasons;
}

function buildDocumentReasons(data: ApplicationData | null): string[] {
  if (!data?.generatedDraftJson) return [];
  const reasons: string[] = [];
  const gap = data.gapAnalysisJson;
  if ((gap?.weakEvidence ?? []).length > 0) {
    const w = (gap?.weakEvidence ?? []).slice(0, 2).map(stripWeakEvidenceDisplayTail);
    reasons.push(`문서 초안은 약한 근거(${w.join(", ")})를 보완하는 방향으로 생성되었습니다.`);
  }
  if (data.projectDescriptions?.[0]?.trim()) {
    reasons.push("강조 프로젝트 입력이 문서 생성 우선 근거로 반영되었습니다.");
  }
  return reasons;
}

function buildInterviewReasons(data: ApplicationData | null): string[] {
  if (!data) return [];
  const reasons: string[] = [];
  const strengths = data.candidateProfileJson?.strengths ?? [];
  const gap = data.gapAnalysisJson;
  if (strengths.length > 0) {
    reasons.push(`면접 리포트는 강점(${strengths.slice(0, 2).join(", ")})의 실제 경험 검증 관점으로 구성되었습니다.`);
  }
  if ((gap?.missingSignals ?? []).length > 0) {
    reasons.push(`부족 신호(${(gap?.missingSignals ?? []).slice(0, 2).join(", ")})가 질문 테마로 반영되었습니다.`);
  }
  return reasons;
}

function hasGeneratedDocument(data: ApplicationData | null): boolean {
  return Boolean(
    data?.generatedDraftJson?.coverLetter?.trim() ||
      data?.generatedDraftJson?.careerDescription?.trim() ||
      data?.generatedDraftJson?.projectIntro?.trim()
  );
}

function hasInterviewResult(data: ApplicationData | null): boolean {
  return Boolean((data?.generatedDraftJson?.interviewReport?.length ?? 0) > 0 || (data?.generatedDraftJson?.interviewQuestions?.length ?? 0) > 0);
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

