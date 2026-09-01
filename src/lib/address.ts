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
