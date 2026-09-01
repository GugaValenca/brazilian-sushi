import { apiRequest } from "@/lib/api";

export interface AddressSuggestion {
  label: string;
  line_1: string;
  city: string;
  state: string;
  postal_code: string;
}

// No token required -- a guest at checkout and someone who hasn't
// registered yet both need this to work with no account (see
// AddressAutocompleteView, which is deliberately AllowAny).
export async function fetchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const response = await apiRequest<{ results: AddressSuggestion[] }>(
    `/accounts/address-lookup/?q=${encodeURIComponent(trimmed)}`,
  );
  return response.results;
}

// A suggestion's line_1 comes back blank whenever Photon could only place
// the query down to city/state/postal code, with no matching housenumber
// or street (the common case for anything but a prominent address -- see
// address_lookup.py). Picking it still fills in city/state/zip; the street
// text the customer already typed is worth keeping rather than being wiped
// out by an empty value.
export function resolveSuggestionLine1(suggestion: AddressSuggestion, currentValue: string): string {
  return suggestion.line_1 || currentValue;
}
