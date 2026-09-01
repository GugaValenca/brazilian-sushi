"""Address autocomplete: turns a few typed characters into a short list of
real street addresses (line 1, city, state, postal code), so a customer
picks a suggestion instead of typing every field by hand -- and, just as
important, instead of typing a state name that fails Address.state's
2-character limit (the exact bug this was built to route around; see
RegisterSerializer.address_state).

Uses Photon (https://photon.komoot.io), a free, keyless, OpenStreetMap-based
geocoder built specifically for address typeahead (unlike Nominatim's own
search endpoint, which is meant for one-shot geocoding and asks callers not
to use it for autocomplete-as-you-type). Called server-side, never from the
browser directly, so no API key or CORS configuration is needed on the
frontend, and so the required custom User-Agent header (Photon's only usage
requirement) lives in one place.
"""

import json
import logging
from urllib import error, parse, request

logger = logging.getLogger(__name__)

PHOTON_API_URL = "https://photon.komoot.io/api/"
USER_AGENT = "BrazilianSushi/1.0 (address-autocomplete; portfolio project)"
REQUEST_TIMEOUT_SECONDS = 5

# Photon returns the full state name for US results (e.g. "Florida"), but
# Address.state is a 2-character code -- this is the one lookup that keeps
# autocomplete from reproducing the very bug it exists to prevent.
US_STATE_ABBREVIATIONS = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
    "puerto rico": "PR", "guam": "GU", "american samoa": "AS",
    "u.s. virgin islands": "VI", "northern mariana islands": "MP",
}


def _state_to_code(state_name):
    if not state_name:
        return ""
    if len(state_name) <= 2:
        return state_name.upper()
    return US_STATE_ABBREVIATIONS.get(state_name.strip().lower(), "")


def _feature_to_suggestion(feature):
    properties = feature.get("properties", {})

    # US-only: the rest of the app already assumes a 2-letter state and a
    # US-style postal code (checkout, the admin, Address.state's max_length),
    # so a non-US result would just fail that same validation downstream.
    if properties.get("countrycode", "").upper() != "US":
        return None

    line_1 = " ".join(part for part in (properties.get("housenumber"), properties.get("street")) if part).strip()
    city = properties.get("city") or properties.get("town") or properties.get("village") or ""
    state = _state_to_code(properties.get("state", ""))
    postal_code = properties.get("postcode", "")

    # A result missing a piece this app actually needs (a park, a bare city,
    # a state Photon didn't give us a code for) isn't a usable suggestion.
    if not (line_1 and city and state and postal_code):
        return None

    return {
        "label": f"{line_1}, {city}, {state} {postal_code}",
        "line_1": line_1,
        "city": city,
        "state": state,
        "postal_code": postal_code,
    }


def fetch_address_suggestions(query, limit=5):
    params = parse.urlencode({"q": query, "limit": limit, "lang": "en"})
    lookup_request = request.Request(
        url=f"{PHOTON_API_URL}?{params}",
        headers={"User-Agent": USER_AGENT},
    )

    try:
        with request.urlopen(lookup_request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, ValueError, UnicodeDecodeError):
        # Address autocomplete is a convenience, not a requirement -- every
        # field it would have filled in can still be typed by hand, so a
        # flaky third-party lookup should never break the form around it.
        logger.warning("Address autocomplete lookup failed for query %r", query, exc_info=True)
        return []

    suggestions = []
    seen_labels = set()
    for feature in payload.get("features", []):
        suggestion = _feature_to_suggestion(feature)
        if suggestion and suggestion["label"] not in seen_labels:
            seen_labels.add(suggestion["label"])
            suggestions.append(suggestion)
    return suggestions
