import { describe, expect, it } from "vitest";

import { resolveSuggestionLine1, type AddressSuggestion } from "./address";

const suggestion = (line_1: string): AddressSuggestion => ({
  label: "test",
  line_1,
  city: "Boston",
  state: "MA",
  postal_code: "02130",
});

describe("resolveSuggestionLine1", () => {
  it("uses the suggestion's own line_1 when Photon matched a street", () => {
    expect(resolveSuggestionLine1(suggestion("123 Main St"), "123 Main")).toBe("123 Main St");
  });

  // Regression guard: Photon often can only place a query down to
  // city/state/postal code with no housenumber/street match at all (the
  // common case for most real addresses) -- picking that suggestion must
  // keep whatever street text the customer already typed instead of
  // wiping it out with an empty value.
  it("falls back to what the customer already typed when Photon has no street match", () => {
    expect(resolveSuggestionLine1(suggestion(""), "27 Maple Ave")).toBe("27 Maple Ave");
  });
});
