const TEST_USER_STORAGE_KEY = "careerflow-test-user-id";

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
}
