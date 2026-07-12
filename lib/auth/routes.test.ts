import { describe, expect, it } from "vitest";
import {
  isAuthPath,
  isProtectedPath,
  safeRedirectPath,
} from "@/lib/auth/routes";

describe("isProtectedPath", () => {
  it("matches logged-in app routes", () => {
    expect(isProtectedPath("/stashes")).toBe(true);
    expect(isProtectedPath("/stashes/")).toBe(true);
    expect(isProtectedPath("/stash/abc")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/profile")).toBe(true);
  });

  it("allows public routes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/share/token")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
  });
});

describe("isAuthPath", () => {
  it("matches the login page", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("defaults to /stashes", () => {
    expect(safeRedirectPath(null)).toBe("/stashes");
    expect(safeRedirectPath(undefined)).toBe("/stashes");
    expect(safeRedirectPath("")).toBe("/stashes");
  });

  it("rejects open redirects", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/stashes");
    expect(safeRedirectPath("//evil.example")).toBe("/stashes");
    expect(safeRedirectPath("/\\evil")).toBe("/stashes");
  });

  it("allows internal paths", () => {
    expect(safeRedirectPath("/settings")).toBe("/settings");
    expect(safeRedirectPath("/stash/abc")).toBe("/stash/abc");
  });
});
