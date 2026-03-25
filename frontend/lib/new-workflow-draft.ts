const STORAGE_KEY = "careerflow-new-workflow-draft-v1";

export type NewWorkflowDraft = {
  resumeText: string;
  portfolioText: string;
  projectText: string;
  targetJobPostingText: string;
  testUserId: string;
  updatedAt: string;
};

export function loadNewWorkflowDraft(): NewWorkflowDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NewWorkflowDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      resumeText: typeof parsed.resumeText === "string" ? parsed.resumeText : "",
      portfolioText: typeof parsed.portfolioText === "string" ? parsed.portfolioText : "",
      projectText: typeof parsed.projectText === "string" ? parsed.projectText : "",
      targetJobPostingText: typeof parsed.targetJobPostingText === "string" ? parsed.targetJobPostingText : "",
      testUserId: typeof parsed.testUserId === "string" ? parsed.testUserId : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
    };
  } catch {
    return null;
  }
}

export function saveNewWorkflowDraft(partial: Partial<NewWorkflowDraft>): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadNewWorkflowDraft();
    const next: NewWorkflowDraft = {
      resumeText: partial.resumeText ?? prev?.resumeText ?? "",
      portfolioText: partial.portfolioText ?? prev?.portfolioText ?? "",
      projectText: partial.projectText ?? prev?.projectText ?? "",
      targetJobPostingText: partial.targetJobPostingText ?? prev?.targetJobPostingText ?? "",
      testUserId: partial.testUserId ?? prev?.testUserId ?? "",
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}

export function clearNewWorkflowDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
