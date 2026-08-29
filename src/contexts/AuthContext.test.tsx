import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { getTokens, setTokens } from "@/lib/tokenStore";

import { AuthProvider } from "./AuthContext";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const PROFILE = { id: 1, email: "customer@example.com", first_name: "Ava", is_staff: false };

describe("AuthContext.login — regression: no duplicate/racing profile fetch", () => {
  beforeEach(() => {
    setTokens(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the profile exactly once per login, not twice", async () => {
    let profileCallCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/accounts/login/")) {
        return jsonResponse({ access: "access-1", refresh: "refresh-1" });
      }
      if (url.endsWith("/accounts/profile/")) {
        profileCallCount += 1;
        return jsonResponse(PROFILE);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.login({ email: PROFILE.email, password: "StrongPass123!" });
    });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    // Before the fix, login() fetched the profile itself *and* the
    // token-change effect fetched it again — a redundant second request
    // that could abort mid-flight (e.g. on immediate navigation) and wipe
    // the session login() had just established.
    expect(profileCallCount).toBe(1);
    expect(getTokens()).toEqual({ access: "access-1", refresh: "refresh-1" });
    expect(result.current.isAuthenticated).toBe(true);
  });
});
