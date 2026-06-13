from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, List, Set, Tuple
from uuid import UUID

from app.models.user import User, UserRole


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _skill_overlap(a: list[str] | None, b: list[str] | None) -> set[str]:
    s1 = {_norm(x) for x in (a or []) if _norm(x)}
    s2 = {_norm(x) for x in (b or []) if _norm(x)}
    return s1 & s2


def _interest_overlap(details_a: dict | None, details_b: dict | None) -> set[str]:
    def extract(details: dict | None) -> set[str]:
        if not details:
            return set()
        raw = details.get("interests") or details.get("focus_areas") or []
        if isinstance(raw, str):
            return {_norm(x) for x in raw.split(",") if _norm(x)}
        return {_norm(x) for x in raw if _norm(x)}

    return extract(details_a) & extract(details_b)


@dataclass(frozen=True)
class NetworkGraph:
    """In-memory view of a user's professional graph for recommendation scoring."""

    current_user_id: UUID
    adjacency: dict[UUID, Set[UUID]]
    connected_ids: frozenset[UUID]
    pending_ids: frozenset[UUID]
    second_degree_ids: frozenset[UUID]
    referral_peer_ids: frozenset[UUID]

    @classmethod
    def build(
        cls,
        current_user_id: UUID,
        accepted_pairs: Iterable[Tuple[UUID, UUID]],
        pending_pairs: Iterable[Tuple[UUID, UUID]],
        referral_peer_ids: Iterable[UUID],
    ) -> "NetworkGraph":
        adjacency: dict[UUID, Set[UUID]] = defaultdict(set)
        for sender_id, receiver_id in accepted_pairs:
            adjacency[sender_id].add(receiver_id)
            adjacency[receiver_id].add(sender_id)

        connected_ids = frozenset(adjacency.get(current_user_id, set()))
        pending: Set[UUID] = set()
        for sender_id, receiver_id in pending_pairs:
            if sender_id == current_user_id:
                pending.add(receiver_id)
            elif receiver_id == current_user_id:
                pending.add(sender_id)

        second_degree: Set[UUID] = set()
        for friend_id in connected_ids:
            for peer_id in adjacency.get(friend_id, set()):
                if peer_id != current_user_id and peer_id not in connected_ids:
                    second_degree.add(peer_id)

        return cls(
            current_user_id=current_user_id,
            adjacency={k: set(v) for k, v in adjacency.items()},
            connected_ids=connected_ids,
            pending_ids=frozenset(pending),
            second_degree_ids=frozenset(second_degree),
            referral_peer_ids=frozenset(referral_peer_ids),
        )

    def excluded_ids(self) -> Set[UUID]:
        return {self.current_user_id, *self.connected_ids, *self.pending_ids}

    def mutual_count(self, other_user_id: UUID) -> int:
        mine = self.adjacency.get(self.current_user_id, set())
        theirs = self.adjacency.get(other_user_id, set())
        return len(mine & theirs)


class RecommendationService:
    def calculate_match_score(self, current_user: User, target_user: User) -> int:
        score, _ = self.calculate_match_score_and_factors(current_user, target_user)
        return score

    def calculate_match_score_and_factors(self, current_user: User, target_user: User) -> Tuple[int, List[str]]:
        r1 = current_user.role
        r2 = target_user.role
        
        base_score = 60
        factors = []
        
        # 1. Role-based matching and priorities
        if r1 == UserRole.student:
            if r2 == UserRole.mentor:
                base_score = 80
                factors.append("✓ Mentor Match")
            elif r2 == UserRole.founder:
                base_score = 75
                factors.append("✓ Startup Participation Match")
            elif r2 == UserRole.student:
                base_score = 65
                factors.append("✓ Peer Student Network")
            else:
                base_score = 70
                factors.append("✓ Career Guidance Connection")
                
        elif r1 == UserRole.developer:
            if r2 == UserRole.founder:
                base_score = 82
                factors.append("✓ Startup Opportunity Match")
            elif r2 == UserRole.developer:
                base_score = 72
                factors.append("✓ Similar Technical Stack")
            elif r2 == UserRole.mentor:
                base_score = 68
                factors.append("✓ Career Guidance Connection")
            else:
                base_score = 60
                factors.append("✓ Professional Network Match")
                
        elif r1 == UserRole.founder:
            if r2 == UserRole.investor:
                base_score = 85
                factors.append("✓ Investor Match")
            elif r2 == UserRole.mentor:
                base_score = 80
                factors.append("✓ Strategic Guidance")
            elif r2 == UserRole.developer:
                base_score = 78
                factors.append("✓ Technical Co-Builder Match")
            elif r2 == UserRole.founder:
                base_score = 70
                factors.append("✓ Founder Networking")
            else:
                base_score = 65
                factors.append("✓ Professional Network Match")
                
        elif r1 == UserRole.investor:
            if r2 == UserRole.founder:
                base_score = 85
                factors.append("✓ Founder Discovery")
            elif r2 == UserRole.investor:
                base_score = 70
                factors.append("✓ Co-Investor Network")
            elif r2 == UserRole.executive:
                base_score = 72
                factors.append("✓ Market Insights Match")
            else:
                base_score = 60
                factors.append("✓ Startup Ecosystem Match")
                
        elif r1 == UserRole.executive:
            if r2 == UserRole.founder:
                base_score = 80
                factors.append("✓ Startup Support Match")
            elif r2 == UserRole.investor:
                base_score = 75
                factors.append("✓ Investor Network")
            elif r2 == UserRole.mentor:
                base_score = 70
                factors.append("✓ Advisor Match")
            else:
                base_score = 65
                factors.append("✓ Executive Networking")
                
        elif r1 == UserRole.mentor:
            if r2 == UserRole.student:
                base_score = 82
                factors.append("✓ Mentorship Guidance")
            elif r2 == UserRole.founder:
                base_score = 82
                factors.append("✓ Founder Guidance Match")
            else:
                base_score = 65
                factors.append("✓ Professional Network Match")
                
        score = base_score
        
        # 2. Detailed role attribute/matching logic
        c1_details = current_user.role_details or {}
        c2_details = target_user.role_details or {}
        
        # ADVANCED INVESTOR MATCHING
        if r1 == UserRole.founder and r2 == UserRole.investor:
            # Founder industry vs Investor preferred industries
            f_industry = c1_details.get("industry")
            i_pref_industries = c2_details.get("preferred_industries") or c2_details.get("investment_focus") or []
            if isinstance(i_pref_industries, str):
                i_pref_industries = [x.strip() for x in i_pref_industries.split(",") if x.strip()]
            
            if f_industry and i_pref_industries:
                f_ind_lower = str(f_industry).lower().strip()
                matched = any(f_ind_lower in str(ind).lower() or str(ind).lower() in f_ind_lower for ind in i_pref_industries)
                if matched:
                    score += 15
                    factors.append(f"✓ {f_industry} Focus")
                    factors.append(f"✓ Investor Interested in {f_industry}")
            
            # Stage match
            f_stage = c1_details.get("stage") or c1_details.get("startup_stage")
            i_pref_stages = c2_details.get("preferred_stages") or c2_details.get("preferred_stage") or []
            if isinstance(i_pref_stages, str):
                i_pref_stages = [x.strip() for x in i_pref_stages.split(",") if x.strip()]
            
            if f_stage and i_pref_stages:
                f_stage_lower = str(f_stage).lower().strip()
                matched_stage = any(f_stage_lower in str(st).lower() or str(st).lower() in f_stage_lower for st in i_pref_stages)
                if matched_stage:
                    score += 15
                    factors.append(f"✓ {f_stage.title()} Stage Preference")
            
            # Funding need
            f_funding = c1_details.get("funding_need") or c1_details.get("primary_goal")
            if f_funding:
                score += 10
                factors.append("✓ Looking for Funding")
                
            # Geographic alignment
            if current_user.country and target_user.country and current_user.country.lower() == target_user.country.lower():
                score += 5
                factors.append("✓ Geographic Alignment")
                
            # Similar market interest
            if f_industry:
                factors.append("✓ Similar Market Interest")
                score += 5

        # ADVANCED FOUNDER MATCHING
        elif r1 == UserRole.founder and r2 in [UserRole.developer, UserRole.founder, UserRole.mentor]:
            f_needs = c1_details.get("needs") or c1_details.get("skill_gaps") or []
            if isinstance(f_needs, str):
                f_needs = [x.strip() for x in f_needs.split(",") if x.strip()]
                
            t_skills = target_user.skills or []
            
            if f_needs and t_skills:
                matched_skills = [s for s in t_skills if any(need.lower() in s.lower() or s.lower() in need.lower() for need in f_needs)]
                if matched_skills:
                    score += 15
                    factors.append(f"✓ Skill Gap Alignment: {matched_skills[0]}")
            
            f_ind = c1_details.get("industry")
            t_ind = c2_details.get("industry")
            if f_ind and t_ind and str(f_ind).lower().strip() == str(t_ind).lower().strip():
                score += 10
                factors.append(f"✓ Shared {f_ind} Industry")
                
            if r2 == UserRole.mentor:
                factors.append("✓ Strategic Advisory Match")
                score += 5

        # MENTOR MATCHING
        elif r1 in [UserRole.student, UserRole.founder] and r2 == UserRole.mentor:
            m_expertise = c2_details.get("expertise") or target_user.skills or []
            if isinstance(m_expertise, str):
                m_expertise = [x.strip() for x in m_expertise.split(",") if x.strip()]
                
            c_skills = current_user.skills or []
            
            if m_expertise and c_skills:
                matched_exp = [e for e in m_expertise if any(s.lower() in e.lower() or e.lower() in s.lower() for s in c_skills)]
                if matched_exp:
                    score += 12
                    factors.append(f"✓ Expertise in {matched_exp[0]}")
                    
            m_exp_years = c2_details.get("years_experience") or c2_details.get("years_of_experience")
            if m_exp_years:
                factors.append(f"✓ Veteran Industry Expert ({m_exp_years}+ yrs)")
                score += 8
                
            factors.append("✓ Available For Mentorship")
            score += 5

        # 3. General Profile matching fallback
        s1 = set(current_user.skills or [])
        s2 = set(target_user.skills or [])
        if s1 and s2:
            intersection = s1.intersection(s2)
            if intersection:
                score += min(20, len(intersection) * 5)
                factors.append("✓ Similar Technical Stack")
                
        if current_user.country and target_user.country:
            if current_user.country.lower().strip() == target_user.country.lower().strip():
                score += 10
                if "✓ Geographic Alignment" not in factors:
                    factors.append("✓ Same Country")
                    
        if current_user.college and target_user.college:
            if current_user.college.lower().strip() == target_user.college.lower().strip():
                score += 10
                factors.append("✓ Same College / Alumni")
                
        if current_user.company and target_user.company:
            if current_user.company.lower().strip() == target_user.company.lower().strip():
                score += 8
                factors.append("✓ Same Work Ecosystem")
                
        g1 = c1_details.get("goals") or c1_details.get("primary_goal") or c1_details.get("ask")
        g2 = c2_details.get("goals") or c2_details.get("primary_goal") or c2_details.get("ask")
        if g1 and g2 and str(g1).lower().strip() == str(g2).lower().strip():
            score += 10
            factors.append("✓ Shared Startup Goals")

        # Deduplicate factors
        unique_factors = []
        for f in factors:
            if f not in unique_factors:
                unique_factors.append(f)
                
        if not unique_factors:
            unique_factors.append("✓ Ecosystem Fit")
            
        final_score = min(99, max(50, score))
        return final_score, unique_factors

    def score_relationship_recommendation(
        self,
        current_user: User,
        target_user: User,
        graph: NetworkGraph,
    ) -> Tuple[int, int, List[str]]:
        """Score a candidate using network relationships and profile similarity.

        Returns (raw_score, display_match_pct, match_factors).
        """
        score = 0
        factors: List[str] = []

        mutual = graph.mutual_count(target_user.id)
        if mutual > 0:
            score += mutual * 50
            label = "Connection" if mutual == 1 else "Connections"
            factors.append(f"{mutual} Mutual {label}")
        elif target_user.id in graph.second_degree_ids:
            score += 25
            factors.append("Second-degree connection")

        same_referrer = (
            current_user.referred_by_id is not None
            and target_user.referred_by_id is not None
            and current_user.referred_by_id == target_user.referred_by_id
        )
        referred_by_current = target_user.referred_by_id == current_user.id
        referred_by_target = current_user.referred_by_id == target_user.id

        if same_referrer:
            score += 30
            factors.append("Connected through a common referrer")
        elif referred_by_current or referred_by_target or target_user.id in graph.referral_peer_ids:
            score += 30
            factors.append("Part of your referral network")

        if current_user.college and target_user.college:
            if _norm(current_user.college) == _norm(target_user.college):
                score += 15
                factors.append("Same College")

        if current_user.company and target_user.company:
            if _norm(current_user.company) == _norm(target_user.company):
                score += 15
                factors.append("Same Company")

        overlap = _skill_overlap(current_user.skills, target_user.skills)
        if overlap:
            score += len(overlap) * 10
            factors.append(f"{len(overlap)} Shared Skill{'s' if len(overlap) != 1 else ''}")

        if current_user.country and target_user.country:
            if _norm(current_user.country) == _norm(target_user.country):
                score += 5
                factors.append("Same Location")

        if current_user.role == target_user.role:
            score += 5
            role_label = target_user.role.value if hasattr(target_user.role, "value") else str(target_user.role)
            factors.append(f"Same Role ({role_label.replace('_', ' ').title()})")

        c1_details = current_user.role_details or {}
        c2_details = target_user.role_details or {}
        c1_industry = c1_details.get("industry")
        c2_industry = c2_details.get("industry")
        if c1_industry and c2_industry and _norm(str(c1_industry)) == _norm(str(c2_industry)):
            score += 10
            factors.append(f"Works in {c2_industry}")

        interest_overlap = _interest_overlap(c1_details, c2_details)
        if interest_overlap:
            score += min(len(interest_overlap) * 5, 15)
            factors.append("Shared Interests")

        match_pct = min(99, max(50, score)) if score > 0 else 0
        return score, match_pct, factors


recommendation_service = RecommendationService()
