"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createSource } from "../../lib/api";
import { demoTemplates } from "../../lib/demo-sample-input";
import { clearNewWorkflowDraft, loadNewWorkflowDraft, saveNewWorkflowDraft } from "../../lib/new-workflow-draft";
import { getStoredTestUserId, storeTestUserId } from "../../lib/test-user";

const TEST_USER_ID_REGEX = /^\d{3}$/;

export default function NewWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [portfolioText, setPortfolioText] = useState("");
  const [projectText, setProjectText] = useState("");
  const [targetJobPostingText, setTargetJobPostingText] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [workflowTitle, setWorkflowTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const hasStoredTestUser = Boolean(testUserId.trim());

  useEffect(() => {
    const stored = getStoredTestUserId();
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const navigationType = nav?.type;

    // /new 첫 진입은 빈 화면이 기본값.
    // 결과 화면에서 "뒤로가기"로 돌아온 경우(back_forward)만 초안을 복원합니다.
    if (navigationType === "back_forward") {
      const draft = loadNewWorkflowDraft();
      if (draft) {
        setResumeText(draft.resumeText);
        setPortfolioText(draft.portfolioText);
        setProjectText(draft.projectText);
        setTargetJobPostingText(draft.targetJobPostingText);
        setTestUserId(draft.testUserId || stored);
        setWorkflowTitle((draft as unknown as { workflowTitle?: string }).workflowTitle ?? "");
      } else {
        setTestUserId(stored);
      }
    } else {
      clearNewWorkflowDraft();
      setResumeText("");
      setPortfolioText("");
      setProjectText("");
      setTargetJobPostingText("");
      setWorkflowTitle("");
      setTestUserId(stored);
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const t = window.setTimeout(() => {
      saveNewWorkflowDraft({
        resumeText,
        portfolioText,
        projectText,
        targetJobPostingText,
        testUserId,
        workflowTitle
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    draftHydrated,
    resumeText,
    portfolioText,
    projectText,
    targetJobPostingText,
    testUserId,
    workflowTitle
  ]);

  function applyTemplate(templateId: string) {
    const template = demoTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    setSelectedTemplateId(templateId);
    setResumeText(template.resumeText);
    setPortfolioText(template.portfolioText);
    setProjectText(template.projectText);
    setTargetJobPostingText(template.targetJobPostingText);
    setErrorMessage("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      const normalizedTestUserId = testUserId.trim();
      if (normalizedTestUserId && !TEST_USER_ID_REGEX.test(normalizedTestUserId)) {
        setErrorMessage("테스트 ID는 숫자 3자리여야 합니다. (예: 027)");
        return;
      }
      const result = await createSource({
        title: workflowTitle.trim() ? workflowTitle.trim() : undefined,
        resumeText,
        portfolioText,
        projectDescriptions: projectText ? [projectText] : [],
        targetJobPostingText,
        testUserId: normalizedTestUserId || undefined
      });
      if (normalizedTestUserId) {
        storeTestUserId(normalizedTestUserId);
      }
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
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-3 break-keep">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">새 워크플로우 시작</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          붙여넣은 텍스트는 <span className="font-semibold text-slate-900">장·단점 분석</span> →{" "}
          <span className="font-semibold text-slate-900">대화형 보완</span> →{" "}
          <span className="font-semibold text-slate-900">문서 생성</span> →{" "}
          <span className="font-semibold text-slate-900">면접 준비</span>까지 이어지는 흐름에 사용됩니다.
        </p>
        <p className="text-xs text-slate-500">
          `이력서 텍스트`, `포트폴리오 텍스트`, `타겟 채용공고 텍스트`는 각각 최소 20자 이상이 필요합니다. 입력 내용은 이 브라우저에 초안으로 저장됩니다.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">예시 템플릿</h2>
            <p className="text-sm leading-relaxed text-slate-600">빠르게 기능을 체험해보고 싶다면 클릭하여 예시로 채워보세요.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={() => applyTemplate(selectedTemplateId ?? demoTemplates[0]?.id ?? "template-1")}
          >
            템플릿 불러오기
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {demoTemplates.map((template) => {
            const selected = selectedTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id)}
                className={[
                  "rounded-2xl border bg-white p-5 text-left shadow-sm transition-all",
                  selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"
                ].join(" ")}
              >
                <p className="text-base font-semibold text-slate-900">{template.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{template.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {errorMessage ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {errorMessage}
        </pre>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">저장/표시 옵션</h2>
            <p className="text-sm leading-relaxed text-slate-600">워크플로우 이름은 목록에서 찾기 쉽게 해줍니다. 테스트 ID를 넣으면 /my에서 저장·조회가 가능합니다.</p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm font-semibold text-slate-900">워크플로우 이름 (선택)</span>
              <span className="text-xs text-slate-500">/my에서 목록으로 볼 때 표시되는 이름입니다. (예: 2026 상반기 지원 #1)</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="예: 2026 @@ 기업 상반기 프론트엔드 지원"
                value={workflowTitle}
                onChange={(e) => setWorkflowTitle(e.target.value)}
                maxLength={60}
              />
            </label>

            {hasStoredTestUser ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">현재 로그인 정보</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  연결된 테스트 ID: <span className="font-mono font-semibold text-slate-900">{testUserId.trim()}</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">테스트 ID 변경/발급은 홈에서 할 수 있습니다.</p>
              </div>
            ) : (
              <label className="block space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-900">테스트 ID (선택)</span>
                <span className="text-xs text-slate-500">저장한 결과를 /my에서 다시 보려면 입력하거나(또는 홈에서 발급) 사용하세요.</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="예: 027"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                />
              </label>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 space-y-1">
            <h2 className="text-base font-semibold text-slate-900">이력서 텍스트</h2>
            <p className="text-sm text-slate-600">경력, 역할, 기술, 성과 중심으로 입력해 주세요.</p>
          </div>
          <textarea
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            rows={10}
            minLength={20}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            required
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 space-y-1">
            <h2 className="text-base font-semibold text-slate-900">포트폴리오 텍스트</h2>
            <p className="text-sm text-slate-600">프로젝트 설명, 문제 해결, 결과 중심으로 입력해 주세요.</p>
          </div>
          <textarea
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            rows={10}
            minLength={20}
            value={portfolioText}
            onChange={(e) => setPortfolioText(e.target.value)}
            required
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 space-y-1">
            <h2 className="text-base font-semibold text-slate-900">강조 프로젝트 (선택)</h2>
            <p className="text-sm text-slate-600">이번 지원에서 특히 강조하고 싶은 사례를 적어 주세요.</p>
          </div>
          <textarea
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            rows={7}
            value={projectText}
            onChange={(e) => setProjectText(e.target.value)}
          />
          <p className="mt-2 text-xs leading-relaxed text-slate-500">입력 시 문서 생성/면접 질문에서 우선 근거로 반영됩니다.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 space-y-1">
            <h2 className="text-base font-semibold text-slate-900">타겟 채용공고 텍스트</h2>
            <p className="text-sm text-slate-600">주요업무, 자격요건, 우대사항을 포함해 붙여넣어 주세요.</p>
          </div>
          <textarea
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            rows={10}
            minLength={20}
            value={targetJobPostingText}
            onChange={(e) => setTargetJobPostingText(e.target.value)}
            required
          />
        </section>

        <section className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-slate-500">
              입력이 완료되면 분석을 시작합니다. 결과 페이지에서 단계별로 진행할 수 있습니다.
            </p>
            <button
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={loading}
              type="submit"
            >
              {loading ? "분석 시작 중..." : "분석 시작하기"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
