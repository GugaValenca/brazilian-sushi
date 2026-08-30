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

describe("AuthContext.logout", () => {
  beforeEach(() => {
    setTokens(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears the session immediately and blacklists the refresh token in the background", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });

    let logoutCallBody: unknown;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/accounts/logout/")) {
        logoutCallBody = init?.body ? JSON.parse(init.body as string) : undefined;
        return jsonResponse(undefined, 205);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.logout();
    });

    // The session clears synchronously -- it does not wait on the network call.
    expect(getTokens()).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(logoutCallBody).toEqual({ refresh: "refresh-1" });
  });

  it("does not throw when the logout request fails (e.g. offline)", async () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(() => {
      act(() => {
        result.current.logout();
      });
    }).not.toThrow();
    expect(getTokens()).toBeNull();
  });
});
