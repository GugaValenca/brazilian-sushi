import { useEffect, useRef, useState } from "react";

import { fetchAddressSuggestions, type AddressSuggestion } from "@/lib/address";

interface AddressAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Fires when a suggestion is picked -- the caller fills in city/state/
  // postal code from it. line_1 is passed separately (rather than always
  // overwriting the input's own value) so a caller can decide whether to
  // replace what was typed or leave it untouched.
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
  // For forms that label inputs via aria-label instead of a visible
  // <label for=...> (e.g. AccountPage's compact add-address grid).
  ariaLabel?: string;
}

// A street-address input that suggests real addresses as the customer
// types (debounced, backed by /accounts/address-lookup/) and fills in
// city/state/postal code the moment one is picked. Used wherever this app
// collects a delivery address -- registration, checkout, and the account
// page -- so all three learn the fix at once instead of drifting apart.
const AddressAutocomplete = ({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  className,
  autoFocus,
  ariaLabel,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guards against a slower, earlier request overwriting the results of a
  // faster, later one when the two race back out of order.
  const latestQueryRef = useRef("");

  useEffect(() => {
    const query = value.trim();
    latestQueryRef.current = query;

    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      fetchAddressSuggestions(query)
        .then((results) => {
          if (latestQueryRef.current !== query) return;
          setSuggestions(results);
          setIsOpen(results.length > 0);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (latestQueryRef.current !== query) return;
          setSuggestions([]);
          setIsOpen(false);
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onSelect(suggestion);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(suggestions.length > 0)}
        onKeyDown={(e) => {
          if (!isOpen || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        autoComplete="off"
        className={className}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={`${id}-suggestions`}
      />
      {isOpen && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.label} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className={`block w-full px-4 py-2.5 text-left text-sm ${
                  index === activeIndex ? "bg-primary/10" : "hover:bg-primary/5"
                }`}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
