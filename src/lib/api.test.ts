import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./api";
import { getTokens, setTokens } from "./tokenStore";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiRequest — silent token refresh", () => {
  beforeEach(() => {
    setTokens(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attempt a refresh for unauthenticated requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ ok: boolean }>("/menu/items/");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the access token once on 401 and retries the original request", async () => {
    setTokens({ access: "expired-access", refresh: "valid-refresh" });

    // The profile endpoint 401s exactly once (stale token), then succeeds
    // once the retried request carries the freshly-refreshed token.
    let profileCallCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/accounts/refresh/")) {
        return jsonResponse({ access: "fresh-access" });
      }
      if (url.endsWith("/accounts/profile/")) {
        profileCallCount += 1;
        if (profileCallCount === 1) {
          expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer expired-access");
          return jsonResponse({ detail: "token expired" }, 401);
        }
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer fresh-access");
        return jsonResponse({ id: 1, email: "user@example.com" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ id: number }>("/accounts/profile/", { token: "expired-access" });

    expect(result).toEqual({ id: 1, email: "user@example.com" });
    expect(profileCallCount).toBe(2);
    expect(getTokens()).toEqual({ access: "fresh-access", refresh: "valid-refresh" });
  });

  it("clears tokens and surfaces the original 401 when the refresh token is also invalid", async () => {
    setTokens({ access: "expired-access", refresh: "invalid-refresh" });

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/accounts/refresh/")) {
        return jsonResponse({ detail: "refresh token invalid" }, 401);
      }
      return jsonResponse({ detail: "token expired" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/accounts/profile/", { token: "expired-access" })).rejects.toThrow();

    expect(getTokens()).toBeNull();
  });

  it("shares a single in-flight refresh across concurrent 401s", async () => {
    setTokens({ access: "expired-access", refresh: "valid-refresh" });

    let refreshCallCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/accounts/refresh/")) {
        refreshCallCount += 1;
        return jsonResponse({ access: "fresh-access" });
      }
      // Every non-refresh call is treated as already using the stale token
      // and rejected, forcing both concurrent requests to go through the
      // refresh path at (nearly) the same time.
      return jsonResponse({ ok: true }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.allSettled([
      apiRequest("/orders/", { token: "expired-access" }),
      apiRequest("/accounts/favorites/", { token: "expired-access" }),
    ]);

    expect(refreshCallCount).toBe(1);
  });
});
