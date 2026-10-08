function hasUnsafeCharacters(value: string) {
  return [...value].some((character) => character === "\\" || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
}

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (hasUnsafeCharacters(value)) return "/";
  let pathname = value.split(/[?#]/, 1)[0];
  try {
    // 인코딩된 구분자와 상위 경로도 검사해 API·외부 주소 우회를 막습니다.
    for (let depth = 0; depth < 5; depth++) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
      if (depth === 4) return "/";
    }
    if (!pathname.startsWith("/") || pathname.startsWith("//") || hasUnsafeCharacters(pathname) || /[?#]/.test(pathname)) return "/";
    const url = new URL(pathname, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid" || /^\/(api|login)(\/|$)/i.test(url.pathname)) return "/";
    return value;
  } catch {
    return "/";
  }
}
