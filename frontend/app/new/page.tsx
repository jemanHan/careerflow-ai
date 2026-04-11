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

  function getTemplateRoleLabel(templateId: string): string {
    if (templateId === "template-1") return "개발자 예시";
    if (templateId === "template-2") return "마케팅/CRM 예시";
    if (templateId === "template-3") return "운영/PMO 예시";
    if (templateId === "template-4") return "디자이너 예시";
    return "입력 예시";
  }

  useEffect(() => {
    const stored = getStoredTestUserId();
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const navigationType = nav?.type;

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
    if (!template) return;
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
      <main className="min-h-screen bg-surface-container-low px-6 py-10 pt-24 md:px-10 lg:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10">
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">새 워크플로우</h1>
            <p className="mt-2 text-lg font-light text-tertiary">붙여넣은 텍스트로 분석 → 보완 → 문서 초안 → 면접 준비까지 이어집니다.</p>
            <p className="mt-3 text-xs text-on-surface-variant">
              이력서·포트폴리오·채용공고는 각 최소 20자 이상. 브라우저에 초안으로 저장됩니다.
            </p>
          </div>

          <section id="workflow-templates" className="mb-12 scroll-mt-24">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-headline text-xl font-bold text-on-surface">예시 템플릿</h2>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">선택</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {demoTemplates.map((template) => {
                const selected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={[
                      "rounded-xl p-6 text-left transition-all duration-300",
                      "bg-surface-container-lowest shadow-ambient-soft",
                      selected ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low" : "hover:bg-surface-bright"
                    ].join(" ")}
                  >
                    <span className="inline-flex rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-secondary">
                      {getTemplateRoleLabel(template.id)}
                    </span>
                    <p className="mt-3 font-bold text-on-surface">{template.title}</p>
                    <p className="mt-2 text-sm text-tertiary">{template.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {errorMessage ? (
            <pre className="mb-8 whitespace-pre-wrap rounded-xl bg-error-container/40 p-4 text-sm text-error">{errorMessage}</pre>
          ) : null}

          <form className="space-y-10" onSubmit={handleSubmit} id="workflow-input">
            <section className="space-y-3">
              <h2 className="font-headline text-xl font-bold text-on-surface">워크플로 이름 (선택)</h2>
              <div className="ghost-field">
                <input
                  className="relative z-10 w-full rounded-xl border-0 bg-transparent px-5 py-3 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-0"
                  placeholder="예: 2026 @@ 기업 상반기 프론트엔드 지원"
                  value={workflowTitle}
                  onChange={(e) => setWorkflowTitle(e.target.value)}
                  maxLength={60}
                />
                <div className="ghost-field-border" aria-hidden />
              </div>
            </section>

            {[
              {
                key: "resume",
                title: "이력서 텍스트",
                hint: "경력, 역할, 기술, 성과 중심으로 입력해 주세요.",
                value: resumeText,
                onChange: setResumeText,
                required: true,
                rows: 10,
                minLength: 20
              },
              {
                key: "portfolio",
                title: "포트폴리오 텍스트",
                hint: "프로젝트 설명, 문제 해결, 결과 중심으로 입력해 주세요.",
                value: portfolioText,
                onChange: setPortfolioText,
                required: true,
                rows: 10,
                minLength: 20
              },
              {
                key: "project",
                title: "강조 프로젝트 (선택)",
                hint: "이번 지원에서 특히 강조하고 싶은 사례.",
                value: projectText,
                onChange: setProjectText,
                required: false,
                rows: 7
              },
              {
                key: "jd",
                title: "타겟 채용공고 텍스트",
                hint: "주요업무, 자격요건, 우대사항을 포함해 붙여넣어 주세요.",
                value: targetJobPostingText,
                onChange: setTargetJobPostingText,
                required: true,
                rows: 10,
                minLength: 20
              }
            ].map((field) => (
              <section key={field.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-xl">description</span>
                  <label className="text-sm font-semibold text-on-surface-variant">{field.title}</label>
                </div>
                <p className="text-xs text-tertiary">{field.hint}</p>
                <div className="ghost-field">
                  <textarea
                    className="relative z-10 min-h-[12rem] w-full resize-y rounded-xl border-0 bg-transparent p-6 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-0"
                    rows={field.rows}
                    minLength={field.minLength}
                    required={field.required}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                  <div className="ghost-field-border" aria-hidden />
                </div>
              </section>
            ))}

            <section className="flex flex-col items-center gap-4 pb-16 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group inline-flex items-center gap-3 rounded-xl editorial-gradient px-12 py-5 text-lg font-bold text-on-primary shadow-ambient transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "시작 중…" : "분석 시작하기"}
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-0.5">arrow_forward</span>
              </button>
              <p className="max-w-sm text-center text-xs text-tertiary">
                결과 페이지에서 장·단점 분석, 보완 질문, 문서 초안, 면접 리포트를 순서대로 진행할 수 있습니다.
              </p>
            </section>
          </form>
        </div>
      </main>
  );
}
