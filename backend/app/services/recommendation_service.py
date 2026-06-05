from typing import List, Tuple
from app.models.user import User, UserRole


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


recommendation_service = RecommendationService()
