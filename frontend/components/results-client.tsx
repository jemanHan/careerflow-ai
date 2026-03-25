"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  createTestUser,
  fetchApplication,
  generateDocuments,
  generateInterview,
  linkMyWorkflow,
  listMyWorkflows,
  runAnalysis,
  submitFollowup,
  updateWorkflowMeta,
  updateApplicationSources
} from "../lib/api";
import { clearFollowupDraft, loadFollowupDraft, saveFollowupDraft } from "../lib/followup-draft";
import { getStoredTestUserId, storeTestUserId } from "../lib/test-user";

type Props = { applicationId: number };
type ActionKind = "analysis" | "followup" | "documents" | "interview" | null;
type FitAnalysisJson = {
  analysisPanelTitle?: string;
  disclaimer?: string;
  strengthsHighlight?: string[];
  weakAreas?: string[];
  missingSignalsHighlight?: string[];
  improvementPoints?: string[];
  computedAt?: string;
  analysisQuality?: string;
  qualityReason?: string;
};

/** 구버전에 남은 내부 메타 문장을 부족 신호에서 제외 */
function isMissingSignalMetaLine(s: string): boolean {
  const t = s.trim();
  return /키워드\s*일치\s*여부\s*검토|공고에\s*명시된\s*요건\(서류/.test(t);
}

/** 구 스냅샷(점수 필드) 또는 신규(`computedAt`) 기준으로 패널 표시 여부 */
function hasJobPostingFitAnalysis(fit: FitAnalysisJson | null | undefined): boolean {
  if (!fit || typeof fit !== "object") return false;
  const legacy = (fit as { estimatedFitScore?: unknown }).estimatedFitScore;
  if (typeof legacy === "number") return true;
  return typeof fit.computedAt === "string";
}

type ApplicationData = {
  id?: number;
  status: string;
  testUserId?: string | null;
  title?: string | null;
  interviewNotesJson?: Record<string, string> | null;
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
  };
};

const PRIMARY_ACTION_BUTTON_CLASS =
  "w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300";

const SECONDARY_BUTTON_CLASS =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const CARD_CLASS = "rounded-xl border border-slate-200 bg-white shadow-sm";
const CARD_HEADER_CLASS = "flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-3";
const CARD_BODY_CLASS = "px-5 py-4";

const WORKFLOW_SAVE_BUTTON_CLASS =
  "w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300";

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-wide text-slate-500">{`STEP ${step}`}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[28px]">{title}</h2>
    </div>
  );
}

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
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

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
        const incomingTitle = (result as ApplicationData)?.title ?? "";
        setDraftTitle(typeof incomingTitle === "string" ? incomingTitle : "");
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "load failed");
      });
  }, [applicationId, refreshKey]);

  async function handleSaveTitle() {
    setError("");
    setActionMessage("");
    try {
      await updateWorkflowMeta(applicationId, { title: draftTitle });
      await refetch();
      setEditingTitle(false);
      setActionMessage("워크플로우 이름이 저장되었습니다.");
    } catch (err) {
      setApiError(err);
    }
  }

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
      setActionMessage(
        "보완 답변이 프로필·갭·장·단점 요약에 반영되었습니다. 별도 「분석 다시 실행」 없이 아래 「문서 생성」으로 이어가면 됩니다."
      );
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleGenerateDocuments(options?: { regenerate?: boolean }) {
    setLoading(true);
    setLoadingAction("documents");
    setError("");
    setActionMessage("");
    try {
      await generateDocuments(applicationId, true, true);
      await refetch();
      setActionMessage(
        options?.regenerate
          ? "문서 초안을 다시 저장했습니다. 원문·분석을 크게 바꾼 뒤에만 반복하는 것을 권장합니다."
          : "문서 초안이 저장되었습니다. 다음 단계는 아래 「면접 대비 리포트 생성」입니다."
      );
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleGenerateInterview(options?: { regenerate?: boolean }) {
    setLoading(true);
    setLoadingAction("interview");
    setError("");
    setActionMessage("");
    try {
      await generateInterview(applicationId, true);
      await refetch();
      setActionMessage(
        options?.regenerate
          ? "면접 대비 리포트를 다시 저장했습니다. 입력이 크게 바뀐 경우에만 반복하는 것을 권장합니다."
          : "면접 대비 리포트가 저장되었습니다. 하단 「워크플로우 저장하기」로 나의 CareerFlow에 연결해 두면 /my에서 다시 열 수 있습니다."
      );
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleSaveWorkflowToMyList() {
    setSavingWorkflow(true);
    setError("");
    setActionMessage("");
    try {
      let tid = getStoredTestUserId().trim();
      if (!tid) {
        const created = await createTestUser();
        tid = created.id;
        storeTestUserId(tid);
      }
      await linkMyWorkflow(applicationId);
      await refetch();
      setActionMessage(
        `워크플로우가 테스트 ID ${tid}에 연결되었습니다. 상단 메뉴의 「나의 CareerFlow」(/my)에서 진행 중·결과 목록으로 확인하세요.`
      );
    } catch (err) {
      setApiError(err);
    } finally {
      setSavingWorkflow(false);
    }
  }

  const headingText =
    (data?.title && data.title.trim().length > 0 ? data.title.trim() : null) ??
    workflowTitle ??
    `워크플로우 #${applicationId}`;

  return (
    <>
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[240px] flex-1">
            <div className="mb-1">
              <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                결과 대시보드
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{headingText}</h1>
            {editingTitle ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="w-full min-w-72 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  maxLength={60}
                  placeholder="워크플로우 이름 (예: 프론트엔드 지원 #1)"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                />
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  type="button"
                  onClick={() => void handleSaveTitle()}
                  disabled={loading}
                >
                  저장
                </button>
                <button
                  className={SECONDARY_BUTTON_CLASS}
                  type="button"
                  onClick={() => {
                    setDraftTitle(data?.title ?? "");
                    setEditingTitle(false);
                  }}
                  disabled={loading}
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                className="mt-2 text-xs font-semibold text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
                type="button"
                onClick={() => setEditingTitle(true)}
              >
                워크플로우 이름 변경
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          공고 대상 장·단점 분석 → 대화형 보완 → 문서 생성 → 면접 리포트 순으로 진행해 보세요.
        </p>
      </header>
      <div className="space-y-10">
      {/* 진행 상태 요약은 상단 복잡도를 높여 숨김 처리 */}
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[1px]">
          <div className="w-[min(420px,92vw)] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
            <p className="mt-4 text-center text-sm font-semibold text-slate-900">결과 생성 중입니다.</p>
            <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
              {loadingAction === "analysis"
                ? "분석은 보통 1~2분 정도 소요됩니다. 잠시만 기다려 주세요."
                : loadingAction === "followup"
                  ? "보완 답변을 반영해 결과를 갱신하고 있습니다. 잠시만 기다려 주세요."
                  : loadingAction === "documents"
                    ? "문서 초안을 생성하고 있습니다. 잠시만 기다려 주세요."
                    : loadingAction === "interview"
                      ? "면접 대비 리포트를 생성하고 있습니다. 잠시만 기다려 주세요."
                      : "잠시만 기다려 주세요."}
            </p>
            {loadingAction ? (
              <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                {loadingAction === "analysis"
                  ? "진행 중: 장·단점 분석"
                  : loadingAction === "followup"
                    ? "진행 중: 대화형 보완 반영"
                    : loadingAction === "documents"
                      ? "진행 중: 문서 생성"
                      : "진행 중: 면접 리포트 생성"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {actionMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          {actionMessage}
        </p>
      ) : null}
      {error ? (
        <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </p>
      ) : null}
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
      <footer className={`${CARD_CLASS} p-5`}>
        <h2 className="text-lg font-semibold text-slate-900">워크플로우 저장하기</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          결과는 <span className="font-medium text-slate-900">내 워크플로</span>에서 언제든 조회·수정할 수 있습니다.
        </p>
        {data?.testUserId ? (
          <p className="mt-2 text-xs text-slate-500">
            연결된 ID: <span className="font-mono font-semibold text-slate-700">{data.testUserId}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">아직 연결되지 않았습니다. 아래 버튼을 누르면 ID가 없을 때 자동으로 발급·저장합니다.</p>
        )}
        <button
          className={`mt-4 ${WORKFLOW_SAVE_BUTTON_CLASS}`}
          disabled={loading || savingWorkflow}
          onClick={() => void handleSaveWorkflowToMyList()}
          type="button"
        >
          {savingWorkflow ? "저장 중…" : "워크플로우 저장하기"}
        </button>
      </footer>
      </div>
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
    <section className="space-y-3">
      <StepHeading step={2} title="대화형 보완" />
      <p className="text-sm text-slate-600">분석에서 근거가 약했던 항목을 짧게 보강합니다.</p>
      {hasQuestions && !hasSubmitted ? (
        <p className="text-sm leading-relaxed text-slate-600">
          작성한 항목만 제출해도 됩니다. (최대 15개)
        </p>
      ) : null}
      {hasSubmitted ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          보완 제출이 완료되었습니다. 답변은 이미 <span className="font-medium text-slate-800">지원자 프로필·갭·장·단점 요약</span>에 반영되었으니, 아래{" "}
          <span className="font-medium text-slate-800">「문서 생성」</span>으로 이어가면 됩니다. 이력서·포트폴리오·공고{" "}
          <span className="font-medium text-slate-800">원문</span>을 고친 경우에만, 위 패널에서 원문 저장 후「원문 저장 후 전체 분석 다시 실행」을 이용하세요.
        </p>
      ) : null}
      {!hasQuestions ? (
        <p className="mt-2 text-sm text-slate-600">
          공고 대상 장·단점 분석 실행 후 보완 질문이 표시됩니다. 보완을 건너뛰어도 아래 「문서 생성」으로 초안을 만들 수 있습니다.
        </p>
      ) : !hasSubmitted ? (
        <p className="mt-2 text-xs text-slate-600">제출 시 프로필·장·단점 분석이 갱신됩니다.</p>
      ) : null}
      {hasQuestions && !hasSubmitted ? (
        <div className={`${CARD_CLASS}`}>
          <div className={CARD_HEADER_CLASS}>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Question {currentIndex + 1} of {total}</p>
              <p className="text-sm font-semibold text-slate-900">보완 질문</p>
            </div>
            <div className="text-xs text-slate-500">
              입력 {answeredCount}/{total}
              {submittedCount > 0 ? <span className="ml-2 text-emerald-700">제출 {submittedCount}회</span> : null}
            </div>
          </div>
          <div className={CARD_BODY_CLASS}>
            <p className="text-sm leading-relaxed text-slate-900">{currentQuestion}</p>
            <div className="mt-4">
              <p className="mb-2 text-xs text-slate-500">답변</p>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none"
                disabled={props.loading}
                onChange={(event) => props.onChange({ ...props.value, [key]: event.target.value })}
                rows={6}
                value={props.value[key] ?? ""}
                placeholder="역할 / 무엇을 했는지 / 결과 또는 검증을 중심으로 짧게 적어 주세요."
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
            {currentIndex === 0 ? <span /> : (
              <button
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={props.loading}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                type="button"
              >
                이전
              </button>
            )}
            {!isLast ? (
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={props.loading}
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                type="button"
              >
                다음
              </button>
            ) : (
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={props.loading}
                onClick={() => void props.onSubmit()}
                type="button"
              >
                제출
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
  followUpSubmitted = false,
  onRunAnalysis,
  onSourcesUpdated,
  onSourceSaveMessage,
  onSourceSaveError
}: {
  applicationId: number;
  data: ApplicationData | null;
  loading: boolean;
  followUpSubmitted?: boolean;
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
  const missingRaw =
    (fit?.missingSignalsHighlight && fit.missingSignalsHighlight.length > 0
      ? fit.missingSignalsHighlight
      : missingGap) ?? [];
  const missingDisplay = missingRaw.filter((s) => !isMissingSignalMetaLine(s));

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
      onSourceSaveMessage(
        followUpSubmitted
          ? "입력 원문이 저장되었습니다. 원문을 바꾼 경우에만 아래 「원문 저장 후 전체 분석 다시 실행」으로 반영하세요."
          : "입력 원문이 저장되었습니다. 아래 「공고 대상 장·단점 분석 다시 실행」으로 반영하세요."
      );
    } catch (err) {
      onSourceSaveError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSavingSources(false);
    }
  }

  if (!hasJobPostingFitAnalysis(fit) || !fit) {
    return (
      <section className="space-y-4">
        <StepHeading step={1} title="공고 대상 장·단점 분석" />
        <p className="text-sm leading-relaxed text-slate-600">
          입력 서류와 채용공고를 비교한 강점·부족 신호가 표시됩니다. 대화형 보완으로 세부를 채운 뒤 다시 실행하면 갱신됩니다.
        </p>
        <div className={CARD_CLASS}>
          <div className={CARD_BODY_CLASS}>
            <button
              className={PRIMARY_ACTION_BUTTON_CLASS}
              disabled={loading}
              onClick={() => void onRunAnalysis()}
              type="button"
            >
              공고 대상 장·단점 분석 실행
            </button>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <StepHeading step={1} title={fit.analysisPanelTitle ?? "공고 대상 장·단점 분석"} />
      <p className="text-sm text-slate-600">공고 요구에 맞춘 강점/부족 신호를 서면 평가처럼 정리합니다.</p>
      <div className="flex flex-wrap items-center gap-2">
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
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {fit.disclaimer}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
        <InfoCard
          title="강점"
          tone="neutral"
          clampLines
          items={(fit.strengthsHighlight ?? []).length ? fit.strengthsHighlight! : ["요약 없음"]}
        />
        {missingDisplay.length > 0 ? (
          <InfoCard title="부족 신호" tone="warn" clampLines items={missingDisplay.slice(0, 10)} />
        ) : (
          <InfoCard
            title="부족 신호"
            tone="neutral"
            clampLines
            items={["공고 문맥에서 아직 근거가 거의 없는 요건으로 분류된 항목이 없습니다."]}
          />
        )}
      </div>
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
  const lineClamp = clampLines ? "line-clamp-4 [overflow-wrap:anywhere]" : "whitespace-pre-wrap break-words [overflow-wrap:anywhere]";
  return (
    <section className={`h-full rounded-xl border p-3 ${boxClass}`}>
      <p className={`text-sm font-semibold ${textClass}`}>{title}</p>
      <ul className={`mt-3 space-y-2 text-sm ${textClass}`}>
        {items.map((item, idx) => (
          <li className={`flex items-start gap-2 ${lineClamp}`} key={`${title}-${idx}-${item.slice(0, 24)}`} title={item}>
            <span className="mt-0.5 text-sm text-slate-400" aria-hidden>
              {ordered ? `${idx + 1})` : "−"}
            </span>
            <span className="[overflow-wrap:anywhere]">{item}</span>
          </li>
        ))}
      </ul>
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
  onGenerateDocuments: (options?: { regenerate?: boolean }) => Promise<void>;
  onGenerateInterview: (options?: { regenerate?: boolean }) => Promise<void>;
  answersByQuestionId: Record<string, string>;
  onFollowupChange: (next: Record<string, string>) => void;
  onFollowupSubmit: () => Promise<void>;
  onSourcesUpdated: () => void;
  onSourceSaveMessage: (msg: string) => void;
  onSourceSaveError: (msg: string) => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string>("");
  const [interviewNotesByQuestion, setInterviewNotesByQuestion] = useState<Record<string, string>>({});
  const saveNotesTimer = useRef<number | null>(null);

  useEffect(() => {
    const incoming = data?.interviewNotesJson ?? null;
    if (incoming && typeof incoming === "object") {
      setInterviewNotesByQuestion(incoming);
    } else {
      setInterviewNotesByQuestion({});
    }
  }, [data?.interviewNotesJson]);

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
  const followUpSubmitted = (data?.followUpAnswersJson?.length ?? 0) > 0;
  const interviewStepComplete = hasInterviewResult(data);

  function handleNoteChange(question: string, note: string) {
    setInterviewNotesByQuestion((prev) => {
      const next = { ...prev, [question]: note };
      if (saveNotesTimer.current) {
        window.clearTimeout(saveNotesTimer.current);
      }
      saveNotesTimer.current = window.setTimeout(() => {
        void updateWorkflowMeta(applicationId, { interviewNotesJson: next }).catch(() => {
          // silent: 메모 저장 실패는 UI를 막지 않는다.
        });
      }, 500);
      return next;
    });
  }
  return (
    <section className="space-y-4">
      <FitAnalysisPanel
        applicationId={applicationId}
        data={data}
        followUpSubmitted={followUpSubmitted}
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
            disabled={loading || followUpSubmitted}
            onClick={() => void onRunAnalysis()}
            type="button"
          >
            공고 대상 장·단점 분석 다시 실행
          </button>
          {followUpSubmitted ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                대화형 보완 답변은 이미 <span className="font-medium text-slate-900">프로필·갭·장·단점 요약</span>에 반영된 상태입니다. 다음 단계는{" "}
                <span className="font-medium text-slate-900">문서 생성</span>입니다. 문서 초안은 저장된 지원자 프로필(보완 반영분 포함)을 사용합니다.
              </p>
              <p className="text-xs text-slate-600">
                「다시 실행」은 이력서·포트폴리오·공고 <span className="font-medium">원문만</span>으로 프로필을 처음부터 다시 뽑습니다. 보완으로 채운 내용이 덮어쓰일 수 있어, 원문을 수정·저장한 경우에만 사용하세요.
              </p>
              <button
                className="text-xs font-semibold text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
                onClick={() => void onRunAnalysis()}
                type="button"
              >
                원문 저장 후 전체 분석 다시 실행
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600">
              대화형 보완을 제출했거나 이력서·공고를 수정했다면, 여기서 다시 실행해 강점·부족 목록을 갱신할 수 있습니다.
            </p>
          )}
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
      <section className="space-y-4">
        <StepHeading step={3} title="문서 생성 결과" />
        <p className="text-sm text-slate-600">지원 공고에 맞춘 초안 문서입니다. 복사해 제출용으로 다듬어 사용하세요.</p>

        {!analysisStepComplete ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <span className="font-medium">2단계 잠금:</span> 위에서 공고 대상 장·단점 분석(1단계)을 먼저 완료하면 문서 생성을 사용할 수 있습니다.
          </div>
        ) : null}

        {analysisStepComplete && !documentsStepComplete ? (
          <p className="text-sm text-slate-600">아래에 초안이 표시됩니다. 문서 생성을 실행해 주세요.</p>
        ) : null}

        {documentsStepComplete ? (
          <div className="space-y-3">
            <DocumentBlock
              title="자기소개 초안"
              text={toReadableDraftText(data?.generatedDraftJson?.coverLetter)}
              copyKey="cover"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
            <DocumentBlock
              title="경력기술서 초안"
              text={toReadableDraftText(toReadableDraftText(data?.generatedDraftJson?.careerDescription))}
              copyKey="career"
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            className={PRIMARY_ACTION_BUTTON_CLASS}
            disabled={loading || !analysisStepComplete}
            onClick={() => void onGenerateDocuments()}
            type="button"
          >
            문서 생성
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-2">
            <StepHeading step={4} title="면접 대비 리포트" />
            <p className="text-sm text-slate-600">질문별 준비 포인트와 내 메모를 함께 정리해 두세요.</p>
          </div>
          {hasInterviewResult(data) ? (
            <button
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() => void handleCopy("interview", (data?.generatedDraftJson?.interviewQuestions ?? []).join("\n"))}
              type="button"
            >
              {copiedKey === "interview" ? "복사됨" : "질문 목록 복사"}
            </button>
          ) : null}
        </div>

        {!documentsStepComplete ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <span className="font-medium">3단계 안내:</span> 2단계에서 문서 생성을 완료한 뒤 면접 대비 리포트를 생성할 수 있습니다.
          </div>
        ) : null}

        {documentsStepComplete && !hasInterviewResult(data) ? (
          <p className="text-sm text-slate-600">생성 후 질문과 답변 준비 포인트가 여기에 표시됩니다.</p>
        ) : null}

        {hasInterviewResult(data) ? (
          <>
            {interviewReport.length > 0 ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">핵심 질문</p>
                  <div className="space-y-3">
                    {coreItems.map((item, idx) => (
                      <InterviewSection
                        key={`core-${idx}-${item.question}`}
                        title=""
                        items={[item]}
                        startIndex={1 + idx}
                        notesByQuestion={interviewNotesByQuestion}
                        onNoteChange={handleNoteChange}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">심화 질문</p>
                  <div className="space-y-3">
                    {deepItems.map((item, idx) => (
                      <InterviewSection
                        key={`deep-${idx}-${item.question}`}
                        title=""
                        items={[item]}
                        startIndex={coreItems.length + 1 + idx}
                        notesByQuestion={interviewNotesByQuestion}
                        onNoteChange={handleNoteChange}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.generatedDraftJson?.interviewQuestions ?? []).map((q, idx) => (
                  <div key={`${idx}-${q}`} className={`${CARD_CLASS} ${CARD_BODY_CLASS}`}>
                    <p className="text-sm font-semibold text-slate-900">Q{idx + 1}. {q}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            className={PRIMARY_ACTION_BUTTON_CLASS}
            disabled={loading || !documentsStepComplete || interviewStepComplete}
            onClick={() => void onGenerateInterview()}
            type="button"
          >
            면접 대비 리포트 생성
          </button>
          {interviewStepComplete ? <span className="text-xs font-semibold text-slate-500">이미 저장됨</span> : null}
        </div>
      </section>
    </section>
  );
}

function InterviewSection({
  title,
  items,
  startIndex,
  notesByQuestion,
  onNoteChange
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
  notesByQuestion: Record<string, string>;
  onNoteChange: (question: string, note: string) => void;
}) {
  const [openModelAnswerByIndex, setOpenModelAnswerByIndex] = useState<Record<number, boolean>>({});
  if (items.length === 0) return null;
  return (
    <section className={title ? `${CARD_CLASS}` : "space-y-3"}>
      {title ? (
        <div className={CARD_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
      ) : null}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <article key={`${title}-${idx}-${item.question}`} className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">Q{startIndex + idx}. {item.question}</p>
            </div>
            <div className={`${CARD_BODY_CLASS} space-y-4`}>
              <div>
                <p className="mb-2 text-xs text-slate-500">답변 준비 포인트</p>
                <ul className="space-y-2">
                  {(item.answerPoints ?? []).slice(0, 3).map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm text-slate-400" aria-hidden>−</span>
                      <span className="text-sm leading-relaxed text-slate-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-xs text-slate-500">내 메모</label>
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none"
                  rows={4}
                  value={notesByQuestion[item.question] ?? ""}
                  onChange={(e) => onNoteChange(item.question, e.target.value)}
                  placeholder="이 질문에서 말할 핵심 경험/수치/스토리를 적어 두세요."
                />
                <p className="mt-1 text-[11px] text-slate-500">자동 저장됩니다.</p>
              </div>
              {item.caution ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-900">주의</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/90">{item.caution}</p>
                </div>
              ) : null}
            {title === "핵심 질문" ? (
              <div className="mt-3">
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    setOpenModelAnswerByIndex((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  type="button"
                >
                  {openModelAnswerByIndex[idx] ? "모범답안 숨기기" : "모범답안 보기"}
                </button>
                {openModelAnswerByIndex[idx] ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-800">참고용 모범답안</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">{item.modelAnswer?.trim() || buildModelAnswer(item)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            </div>
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
    <article className={`${CARD_CLASS}`}>
      <div className={CARD_HEADER_CLASS}>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <button
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!body}
          onClick={() => void onCopy(copyKey, text)}
          type="button"
        >
          {copiedKey === copyKey ? "초안 복사됨" : "초안 복사"}
        </button>
      </div>
      <div className={CARD_BODY_CLASS}>
        <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{body}</p>
        </div>
      </div>
    </article>
  );
}

function CandidateSnapshot({ data }: { data: ApplicationData | null }) {
  const strengths = (data?.candidateProfileJson?.strengths ?? []).slice(0, 6);
  const fit = data?.fitAnalysisJson;
  const missingHighlightRaw =
    (fit?.missingSignalsHighlight && fit.missingSignalsHighlight.length > 0
      ? fit.missingSignalsHighlight
      : data?.gapAnalysisJson?.missingSignals) ?? [];
  const missingHighlight = missingHighlightRaw.filter((s) => !isMissingSignalMetaLine(s));

  return (
    <section className={`${CARD_CLASS} mt-4`}>
      <div className={CARD_HEADER_CLASS}>
        <p className="text-sm font-semibold text-slate-900">특화 포인트</p>
      </div>
      <div className={CARD_BODY_CLASS}>
        {strengths.length > 0 ? (
          <ul className="space-y-2">
            {strengths.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span className="mt-0.5 text-sm text-slate-400" aria-hidden>
                  −
                </span>
                <span className="text-sm leading-relaxed text-slate-700">{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">분석 데이터 대기 중</p>
        )}
        {missingHighlight.length > 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            참고: 부족 신호 중 일부는 상단 카드에서 확인할 수 있습니다.
          </p>
        ) : null}
      </div>
    </section>
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
    reasons.push(`공고와 맞는 신호(${(gap?.matchedSignals ?? []).slice(0, 3).join(", ")})가 강점 요약에 반영되었습니다.`);
  }
  if ((gap?.missingSignals ?? []).length > 0) {
    reasons.push(
      `근거가 아직 충분히 드러나지 않은 요건(${(gap?.missingSignals ?? []).slice(0, 2).join(", ")})이 부족 신호로 정리되었습니다.`
    );
  }
  return reasons;
}

// (도출 근거 UI는 제품성 관점에서 숨김 처리함)

function hasGeneratedDocument(data: ApplicationData | null): boolean {
  return Boolean(
    data?.generatedDraftJson?.coverLetter?.trim() ||
      data?.generatedDraftJson?.careerDescription?.trim()
  );
}

function hasInterviewResult(data: ApplicationData | null): boolean {
  return Boolean((data?.generatedDraftJson?.interviewReport?.length ?? 0) > 0 || (data?.generatedDraftJson?.interviewQuestions?.length ?? 0) > 0);
}

function StatusCard({ label, status, statusText }: { label: string; status: "complete" | "in-progress" | "pending"; statusText: string }) {
  const dot =
    status === "complete"
      ? "bg-slate-900"
      : status === "in-progress"
        ? "bg-blue-600"
        : "bg-slate-300";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <div className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900">{statusText}</p>
    </div>
  );
}

function WorkflowStatusCard({ data }: { data: ApplicationData | null }) {
  const analysisDone = hasJobPostingFitAnalysis(data?.fitAnalysisJson);
  const questionsTotal = (data?.followUpQuestions?.length ?? 0) || 0;
  const answered = data?.followUpAnswersJson?.length ?? 0;
  const followupText =
    questionsTotal > 0 ? `${Math.min(answered, questionsTotal)}/${questionsTotal} 답변` : answered > 0 ? `${answered}개 답변` : "0개";
  const documentsDone = hasGeneratedDocument(data);
  const interviewDone = hasInterviewResult(data);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">진행 상태 요약</h2>
          <p className="mt-1 text-sm text-slate-600">각 단계 진행 상황을 한눈에 확인하세요.</p>
        </div>
        <div className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {interviewDone ? "결과 보기" : "진행 중"}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatusCard label="분석" status={analysisDone ? "complete" : "pending"} statusText={analysisDone ? "완료" : "미완료"} />
        <StatusCard
          label="대화형 보완"
          status={answered > 0 && answered < questionsTotal ? "in-progress" : answered > 0 ? "complete" : "pending"}
          statusText={followupText}
        />
        <StatusCard label="문서 초안" status={documentsDone ? "complete" : "pending"} statusText={documentsDone ? "완료" : "미완료"} />
        <StatusCard label="면접 리포트" status={interviewDone ? "complete" : "pending"} statusText={interviewDone ? "완료" : "미완료"} />
      </div>
    </section>
  );
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
      .map((line) => {
        const normalized = line.replace(/^\s*-\s+/, "").trim();
        return `- ${normalized}`;
      })
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
        if (k === "name" || k === "title") {
          lines.push(child);
          continue;
        }
        if (k === "bullets" || k === "experienceHighlights") {
          lines.push(child);
          continue;
        }
        if (k === "summary" || k === "description") {
          lines.push(child);
          continue;
        }
        lines.push(`${koKey}: ${child}`);
      } else {
        lines.push(`${koKey}: ${child}`);
      }
    }
    return lines.join("\n");
  }
  return String(input);
}

