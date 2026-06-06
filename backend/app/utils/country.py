"""Country name normalization and matching for discovery and network filters."""

from __future__ import annotations

COUNTRY_ALIASES: dict[str, str] = {
    "usa": "United States",
    "us": "United States",
    "u.s.": "United States",
    "u.s.a.": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
    "u.k.": "United Kingdom",
    "great britain": "United Kingdom",
    "uae": "United Arab Emirates",
}


def normalize_country(country: str | None) -> str | None:
    if not country or not str(country).strip():
        return None
    raw = str(country).strip()
    return COUNTRY_ALIASES.get(raw.lower(), raw)


def countries_match(user_country: str | None, filter_value: str | None) -> bool:
    if not filter_value or not str(filter_value).strip():
        return True
    if not user_country or not str(user_country).strip():
        return False

    filter_norm = normalize_country(filter_value)
    user_norm = normalize_country(user_country)
    if not filter_norm or not user_norm:
        return False

    filter_lower = filter_norm.lower()
    user_lower = user_norm.lower()
    filter_raw = str(filter_value).strip().lower()
    user_raw = str(user_country).strip().lower()

    if user_lower == filter_lower:
        return True
    if filter_lower in user_lower or user_lower in filter_lower:
        return True
    if filter_raw in user_raw or user_raw in filter_raw:
        return True
    return False
