const TEST_USER_STORAGE_KEY = "careerflow-test-user-id";
const TEST_USER_CHANGED_EVENT = "careerflow:test-user-changed";

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
  window.localStorage.setItem(TEST_USER_STORAGE_KEY, testUserId);
  try {
    window.dispatchEvent(new CustomEvent(TEST_USER_CHANGED_EVENT, { detail: { testUserId } }));
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
