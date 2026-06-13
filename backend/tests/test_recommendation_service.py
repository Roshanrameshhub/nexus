import uuid
from types import SimpleNamespace

from app.models.user import UserRole
from app.services.recommendation_service import NetworkGraph, recommendation_service


def _user(
    *,
    college: str | None = None,
    company: str | None = None,
    country: str | None = None,
    skills: list[str] | None = None,
    referred_by_id=None,
    role=UserRole.developer,
    role_details: dict | None = None,
):
    return SimpleNamespace(
        id=uuid.uuid4(),
        college=college,
        company=company,
        country=country,
        skills=skills or [],
        referred_by_id=referred_by_id,
        role=role,
        role_details=role_details or {},
    )


def test_mutual_connection_scoring():
    me_id = uuid.uuid4()
    friend_id = uuid.uuid4()
    candidate_id = uuid.uuid4()

    graph = NetworkGraph.build(
        me_id,
        [(me_id, friend_id), (friend_id, candidate_id)],
        [],
        [],
    )
    current = _user(role=UserRole.founder)
    current.id = me_id
    target = _user(role=UserRole.developer)
    target.id = candidate_id

    raw, display, factors = recommendation_service.score_relationship_recommendation(current, target, graph)

    assert raw >= 50
    assert display >= 50
    assert factors[0] == "1 Mutual Connection"


def test_referral_network_scoring():
    me_id = uuid.uuid4()
    referrer_id = uuid.uuid4()
    target_id = uuid.uuid4()

    graph = NetworkGraph.build(me_id, [], [], [target_id])
    current = _user(referred_by_id=referrer_id)
    current.id = me_id
    target = _user(referred_by_id=referrer_id)
    target.id = target_id

    raw, _, factors = recommendation_service.score_relationship_recommendation(current, target, graph)

    assert raw >= 30
    assert "Connected through a common referrer" in factors


def test_profile_similarity_scoring():
    me_id = uuid.uuid4()
    target_id = uuid.uuid4()
    graph = NetworkGraph.build(me_id, [], [], [])

    current = _user(college="MIT", company="Nexus Labs", country="USA", skills=["Python", "React"])
    current.id = me_id
    target = _user(college="MIT", company="Nexus Labs", country="USA", skills=["Python", "Go"])
    target.id = target_id

    raw, _, factors = recommendation_service.score_relationship_recommendation(current, target, graph)

    assert raw >= 15 + 15 + 5 + 10
    assert "Same College" in factors
    assert "Same Company" in factors
    assert "Same Location" in factors
    assert any("Shared Skill" in f for f in factors)


def test_excluded_ids_include_self_connections_and_pending():
    me_id = uuid.uuid4()
    friend_id = uuid.uuid4()
    pending_id = uuid.uuid4()

    graph = NetworkGraph.build(
        me_id,
        [(me_id, friend_id)],
        [(me_id, pending_id)],
        [],
    )

    excluded = graph.excluded_ids()
    assert me_id in excluded
    assert friend_id in excluded
    assert pending_id in excluded
