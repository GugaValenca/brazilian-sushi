import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTokens, setTokens, subscribeToTokens } from "./tokenStore";

describe("tokenStore", () => {
  beforeEach(() => {
    setTokens(null);
    window.localStorage.clear();
  });

  it("starts with no tokens", () => {
    expect(getTokens()).toBeNull();
  });

  it("persists tokens to localStorage and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTokens(listener);

    setTokens({ access: "access-1", refresh: "refresh-1" });

    expect(getTokens()).toEqual({ access: "access-1", refresh: "refresh-1" });
    expect(JSON.parse(window.localStorage.getItem("brazilian-sushi-auth")!)).toEqual({
      access: "access-1",
      refresh: "refresh-1",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("clears storage and notifies subscribers when set to null", () => {
    setTokens({ access: "access-1", refresh: "refresh-1" });
    const listener = vi.fn();
    subscribeToTokens(listener);

    setTokens(null);

    expect(getTokens()).toBeNull();
    expect(window.localStorage.getItem("brazilian-sushi-auth")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTokens(listener);
    unsubscribe();

    setTokens({ access: "a", refresh: "r" });

    expect(listener).not.toHaveBeenCalled();
  });
});
