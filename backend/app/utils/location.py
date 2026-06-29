"""Location formatting and filter matching (city, state, country)."""

from __future__ import annotations

from app.models.user import User
from app.utils.country import countries_match, normalize_country


def _norm(value: str | None) -> str:
    return str(value or "").strip().lower()


def format_location(
    city: str | None,
    state: str | None,
    country: str | None,
) -> str | None:
    parts: list[str] = []
    if city and str(city).strip():
        parts.append(str(city).strip())
    if state and str(state).strip():
        parts.append(str(state).strip())
    if country and str(country).strip():
        parts.append(normalize_country(country) or str(country).strip())
    return ", ".join(parts) if parts else None


def user_location_label(user: User) -> str | None:
    return format_location(
        getattr(user, "city", None),
        getattr(user, "state", None),
        user.country,
    )


def location_field_matches(user_value: str | None, filter_value: str | None) -> bool:
    if not filter_value or not str(filter_value).strip():
        return True
    if not user_value or not str(user_value).strip():
        return False
    u = _norm(user_value)
    f = _norm(filter_value)
    return f in u or u in f or u == f


def user_matches_location_filters(
    user: User,
    *,
    city: str | None = None,
    state: str | None = None,
    country: str | None = None,
) -> bool:
    if city and not location_field_matches(getattr(user, "city", None), city):
        return False
    if state and not location_field_matches(getattr(user, "state", None), state):
        return False
    if country and not countries_match(user.country, country):
        return False
    return True


def location_similarity_score(current: User, target: User) -> tuple[int, list[str]]:
    """Bonus score for recommendation location alignment."""
    score = 0
    factors: list[str] = []

    c_city = getattr(current, "city", None)
    t_city = getattr(target, "city", None)
    c_state = getattr(current, "state", None)
    t_state = getattr(target, "state", None)

    if c_city and t_city and _norm(c_city) == _norm(t_city):
        score += 8
        factors.append(f"Same City ({t_city})")

    if c_state and t_state and _norm(c_state) == _norm(t_state):
        score += 5
        if "Same City" not in " ".join(factors):
            factors.append(f"Same State ({t_state})")

    if current.country and target.country and countries_match(current.country, target.country):
        score += 5
        country_label = normalize_country(target.country) or target.country
        if not any("City" in f or "State" in f for f in factors):
            factors.append(f"Same Country ({country_label})")
        elif "Same Country" not in " ".join(factors):
            factors.append("Same Country")

    return score, factors
