const TEST_USER_STORAGE_KEY = "careerflow-test-user-id";
const TEST_USER_CHANGED_EVENT = "careerflow:test-user-changed";
const TEST_USER_HISTORY_STORAGE_KEY = "careerflow-test-user-id-history";
const MAX_HISTORY = 10;

function isValidTestUserId(id: string) {
  return /^\d{3}$/.test(id.trim());
}

function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(TEST_USER_HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v)).filter((v) => isValidTestUserId(v));
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEST_USER_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export function getStoredTestUserIdHistory(): string[] {
  return readHistory();
}

export function getStoredTestUserId() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(TEST_USER_STORAGE_KEY) ?? "";
}

export function storeTestUserId(testUserId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const cleaned = testUserId.trim();
  window.localStorage.setItem(TEST_USER_STORAGE_KEY, cleaned);

  // 최근 사용 이력(중복 제거 + 최신이 위로 오게)을 기록한다.
  if (isValidTestUserId(cleaned)) {
    const history = readHistory().filter((id) => id !== cleaned);
    history.unshift(cleaned);
    writeHistory(history.slice(0, MAX_HISTORY));
  }

  try {
    window.dispatchEvent(new CustomEvent(TEST_USER_CHANGED_EVENT, { detail: { testUserId: cleaned } }));
  } catch {
    // ignore
  }
}

export function clearStoredTestUserId() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(TEST_USER_STORAGE_KEY);
  try {
    window.dispatchEvent(new CustomEvent(TEST_USER_CHANGED_EVENT, { detail: { testUserId: "" } }));
  } catch {
    // ignore
  }
}

export function getTestUserChangedEventName() {
  return TEST_USER_CHANGED_EVENT;
}
