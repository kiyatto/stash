/** Paths that require an authenticated session. */
export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/stashes" ||
    pathname.startsWith("/stashes/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname.startsWith("/stash/")
  );
}

/** Auth entry pages (logged-in users are redirected away). */
export function isAuthPath(pathname: string): boolean {
  return pathname === "/login";
}

/** Safe internal redirect target after login. */
export function safeRedirectPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return "/stashes";
  }
  return next;
}
