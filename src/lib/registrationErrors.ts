// Turns a raw registration API error into what the signup form's toast
// shows. Only a handful of cases get a friendlier rewrite (duplicate
// email/phone/username) -- everything else already comes back from the
// backend formatted as "Field Label: reason" (see flattenErrorMessage in
// src/lib/api.ts) and specific about what's actually wrong (a state code
// that's too long, a password that's too common, a partial address...).
// This used to fall back to one generic "please review your details"
// string for every case it didn't explicitly recognize, which silently
// discarded that detail and left no way to tell what field needed fixing.
export function getFriendlySignupError(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return "We couldn't create your account right now. Please review your details and try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("email") && message.includes("already exists")) {
    return "This customer is already registered -- an account with this email already exists. Please sign in or use a different email address.";
  }

  if (message.includes("phone") && message.includes("already exists")) {
    return "This customer is already registered -- an account with this phone number already exists. Please sign in or use a different number.";
  }

  if (message.includes("username") && message.includes("already exists")) {
    return "That username is already in use. Please choose another one and try again.";
  }

  return error.message;
}
