import { describe, expect, it } from "vitest";

import { getFriendlySignupError } from "./registrationErrors";

describe("getFriendlySignupError", () => {
  it("rewrites a duplicate email error as an already-registered message", () => {
    const error = new Error("Email: An account with this email already exists. Try signing in instead.");
    expect(getFriendlySignupError(error)).toContain("already registered");
  });

  it("rewrites a duplicate phone error as an already-registered message", () => {
    const error = new Error("Phone Number: An account with this phone number already exists. Try signing in instead.");
    expect(getFriendlySignupError(error)).toContain("already registered");
  });

  it("rewrites a duplicate username error", () => {
    const error = new Error("Username: A user with that username already exists.");
    expect(getFriendlySignupError(error)).toContain("already in use");
  });

  // Regression guard: any backend validation message that doesn't match one
  // of the specific rewrites above must still reach the customer as-is,
  // instead of being replaced by an unhelpful generic string that hides
  // which field actually needs fixing.
  it("passes through an unrecognized field validation message instead of hiding it", () => {
    const error = new Error("Address State: Ensure this field has no more than 2 characters.");
    expect(getFriendlySignupError(error)).toBe("Address State: Ensure this field has no more than 2 characters.");
  });

  it("passes through a password strength message", () => {
    const error = new Error("Password: This password is too common.");
    expect(getFriendlySignupError(error)).toBe("Password: This password is too common.");
  });

  it("falls back to a generic message for a non-Error value", () => {
    expect(getFriendlySignupError("not an error")).toBe(
      "We couldn't create your account right now. Please review your details and try again.",
    );
  });

  it("falls back to a generic message for an Error with no text", () => {
    expect(getFriendlySignupError(new Error(""))).toBe(
      "We couldn't create your account right now. Please review your details and try again.",
    );
  });
});
