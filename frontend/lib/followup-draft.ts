function key(applicationId: number): string {
  return `careerflow-followup-draft-${applicationId}`;
}

export function loadFollowupDraft(applicationId: number): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(key(applicationId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveFollowupDraft(applicationId: number, value: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key(applicationId), JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function clearFollowupDraft(applicationId: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key(applicationId));
  } catch {
    /* ignore */
  }
}
