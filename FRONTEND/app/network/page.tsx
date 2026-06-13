'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConnectButton } from '@/components/social/connect-button'
import { usersAPI, messagesAPI, meetingsAPI, communitiesAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { getInitials } from '@/lib/utils/format'
import { countriesMatch, getCountryFromSearchParams } from '@/lib/utils/country'
import { 
  Users, 
  Search, 
  Globe, 
  GraduationCap, 
  Briefcase, 
  Calendar, 
  Linkedin, 
  Github, 
  Mail, 
  ExternalLink, 
  Flame, 
  X,
  MessageSquare,
  Compass,
  Filter,
  UserCheck,
  Building,
  Sparkles,
  ChevronDown,
  SlidersHorizontal,
  Bookmark,
  Users2,
} from 'lucide-react'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import type { ApiUserRecommendation, ApiCommunity } from '@/lib/types/api'
import { motion, AnimatePresence } from 'framer-motion'
import { openGmailCompose } from './email-actions'
import { toast } from 'sonner'

export default function NetworkPage() {
  useProtectedRoute()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  // Navigation & Tabs state
  const [activeTab, setActiveTab] = useState<'people' | 'communities'>('people')
  
  // Core Data States
  const [recommendations, setRecommendations] = useState<ApiUserRecommendation[]>([])
  const [communities, setCommunities] = useState<ApiCommunity[]>([])
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({})
  
  // Loading states
  const [loadingRecs, setLoadingRecs] = useState(true)
  const [loadingCommunities, setLoadingCommunities] = useState(false)
  
  // Search & Filters State
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [skillSearch, setSkillSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [collegeFilter, setCollegeFilter] = useState('')
  const [minExperience, setMinExperience] = useState<number | ''>('')
  const [investmentFocus, setInvestmentFocus] = useState('')
  
  const [communitySearch, setCommunitySearch] = useState('')

  // Schedule Meeting Modal
  const [schedulingUser, setSchedulingUser] = useState<ApiUserRecommendation | null>(null)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDesc, setMeetingDesc] = useState('')
  const [meetingType, setMeetingType] = useState('Mentorship Session')
  const [meetingTime, setMeetingTime] = useState('')
  const [submittingMeeting, setSubmittingMeeting] = useState(false)

  // Load Data
  const loadRecommendations = useCallback(async (countryParam?: string) => {
    setLoadingRecs(true)
    try {
      const queryCountry =
        countryParam ??
        getCountryFromSearchParams(typeof window !== 'undefined' ? window.location.search : '') ??
        undefined
      const { data } = await usersAPI.getRecommendations(
        undefined,
        queryCountry || undefined
      )
      const list = data.recommendations || []
      setRecommendations(list)
    } catch {
      setRecommendations([])
      toast.error('Failed to load networking recommendations')
    } finally {
      setLoadingRecs(false)
    }
  }, [])

  const loadCommunities = useCallback(async () => {
    setLoadingCommunities(true)
    try {
      const { data } = await communitiesAPI.getAll()
      const list = data.communities || []
      setCommunities(list)
    } catch {
      setCommunities([])
      toast.error('Failed to load communities')
    } finally {
      setLoadingCommunities(false)
    }
  }, [])

  useEffect(() => {
    const country = getCountryFromSearchParams(window.location.search)
    if (country) {
      setCountryFilter(country)
    }
    loadRecommendations(country ?? undefined)
    loadCommunities()
  }, [loadRecommendations, loadCommunities])

  // Handlers
  const handleStartChat = async (userId: string) => {
    try {
      const { data } = await messagesAPI.createConversation([userId])
      const convId = data.conversation?.id
      if (convId) {
        router.push(`/messages?conversation=${convId}`)
      } else {
        router.push('/messages')
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not start conversation')
    }
  }

  const handleJoinToggle = async (communityId: string) => {
    const isJoined = joinedCommunities[communityId]
    try {
      if (isJoined) {
        await communitiesAPI.leave(communityId)
        setJoinedCommunities(prev => ({ ...prev, [communityId]: false }))
        toast.success('Successfully left community')
      } else {
        await communitiesAPI.join(communityId)
        setJoinedCommunities(prev => ({ ...prev, [communityId]: true }))
        toast.success('Successfully joined community!')
      }
      loadCommunities()
    } catch {
      toast.error('Failed to update community status')
    }
  }

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schedulingUser || !meetingTitle.trim() || !meetingTime) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmittingMeeting(true)
    try {
      await meetingsAPI.create({
        invitee_id: schedulingUser.id,
        title: meetingTitle,
        description: meetingDesc,
        scheduled_at: new Date(meetingTime).toISOString(),
        meeting_type: meetingType
      })
      toast.success(`Meeting successfully scheduled with ${schedulingUser.name}`)
      setSchedulingUser(null)
      setMeetingTitle('')
      setMeetingDesc('')
      setMeetingTime('')
    } catch {
      toast.error('Failed to schedule meeting. Please try again.')
    } finally {
      setSubmittingMeeting(false)
    }
  }

  // Format dynamic Role display label
  const formatRoleLabel = (rec: ApiUserRecommendation) => {
    const role = rec.role?.toLowerCase()
    if (role === 'founder') {
      return `Founder of ${rec.role_details?.startup_name || rec.company || 'Startup'}`
    }
    if (role === 'developer') {
      return `Developer at ${rec.company || 'Tech Company'}`
    }
    if (role === 'investor') {
      return `Investor at ${rec.role_details?.organization || 'VC Fund'}`
    }
    if (role === 'mentor') {
      return `Mentor in ${rec.role_details?.expertise || 'Ecosystem'}`
    }
    if (role === 'student') {
      return `Student at ${rec.college || 'University'}`
    }
    if (role === 'executive') {
      return `Executive at ${rec.company || 'Corporate'}`
    }
    return rec.role || 'Member'
  }

  // Dynamic label for Org field in Profile Card
  const getOrgLabel = (rec: ApiUserRecommendation) => {
    const role = rec.role?.toLowerCase()
    if (role === 'student') {
      return rec.college || 'N/A'
    }
    if (role === 'founder') {
      return rec.role_details?.startup_name || rec.company || 'N/A'
    }
    if (role === 'investor' || role === 'mentor') {
      return rec.role_details?.organization || rec.company || 'N/A'
    }
    return rec.company || 'N/A'
  }

  // Clear all filters
  const resetFilters = () => {
    setUserSearch('')
    setRoleFilter('all')
    setSkillSearch('')
    setCountryFilter('')
    setIndustryFilter('')
    setCompanyFilter('')
    setCollegeFilter('')
    setMinExperience('')
    setInvestmentFocus('')
    toast.success('Filters reset successfully')
  }

  // Client-side filtering logic for People
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((rec) => {
      // 1. Search (Name, Bio, Skills)
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase()
        const matchesName = rec.name?.toLowerCase().includes(q)
        const matchesBio = rec.bio?.toLowerCase().includes(q)
        const matchesSkills = rec.skills?.some(s => s.toLowerCase().includes(q))
        if (!matchesName && !matchesBio && !matchesSkills) return false
      }

      // 2. Role Filter
      if (roleFilter !== 'all') {
        if (rec.role?.toLowerCase() !== roleFilter.toLowerCase()) return false
      }

      // 3. Skills Filter
      if (skillSearch.trim()) {
        const q = skillSearch.toLowerCase()
        const matchesSkills = rec.skills?.some(s => s.toLowerCase().includes(q))
        if (!matchesSkills) return false
      }

      // 4. Country Filter
      if (countryFilter.trim()) {
        if (!countriesMatch(rec.country, countryFilter)) return false
      }

      // 5. Industry Filter
      if (industryFilter.trim()) {
        const ind = industryFilter.toLowerCase()
        const recIndustry = rec.role_details?.industry?.toLowerCase() || ''
        const recPrefIndustries = Array.isArray(rec.role_details?.preferred_industries)
          ? rec.role_details.preferred_industries.map((i: string) => i.toLowerCase())
          : typeof rec.role_details?.preferred_industries === 'string'
          ? [rec.role_details.preferred_industries.toLowerCase()]
          : []
        const matchesIndustry = recIndustry.includes(ind) || recPrefIndustries.some((i: string) => i.includes(ind))
        if (!matchesIndustry) return false
      }

      // 6. Company Filter
      if (companyFilter.trim()) {
        if (!rec.company?.toLowerCase().includes(companyFilter.toLowerCase())) return false
      }

      // 7. College Filter
      if (collegeFilter.trim()) {
        if (!rec.college?.toLowerCase().includes(collegeFilter.toLowerCase())) return false
      }

      // 8. Experience Filter
      if (minExperience !== '') {
        const exp = Number(rec.role_details?.years_experience || 0)
        if (exp < minExperience) return false
      }

      // 9. Investment Focus Filter
      if (investmentFocus.trim()) {
        const focus = investmentFocus.toLowerCase()
        const recFocus = rec.role_details?.investment_focus?.toLowerCase() || ''
        if (!recFocus.includes(focus)) return false
      }

      return true
    })
  }, [recommendations, userSearch, roleFilter, skillSearch, countryFilter, industryFilter, companyFilter, collegeFilter, minExperience, investmentFocus])

  // Client-side filtering logic for Communities
  const filteredCommunities = useMemo(() => {
    if (!communitySearch.trim()) return communities
    const q = communitySearch.toLowerCase()
    return communities.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.description?.toLowerCase().includes(q)
    )
  }, [communities, communitySearch])

  return (
    <AppShell title="People Discovery Layer">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">
        
        {/* Banner header */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-sidebar/30 p-8 md:p-12 mesh-gradient">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" /> People Discovery Layer
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Discover Global <span className="text-gradient">Talent & Communities</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Intelligent matchmaker. Connect with verified builders, founders, mentors, investors, and active communities based on skills, experience, and interests.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-15 hidden md:block select-none pointer-events-none">
            <Users className="w-80 h-80 text-primary" />
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-between items-center border-b border-border/40 pb-2">
          <div className="flex gap-2 bg-sidebar/60 p-1.5 rounded-xl border border-border/40">
            <button
              onClick={() => setActiveTab('people')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'people'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Users className="w-4 h-4" />
              People
            </button>
            <button
              onClick={() => setActiveTab('communities')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'communities'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Users2 className="w-4 h-4" />
              Communities
            </button>
          </div>
          
          {/* Quick Counter */}
          <div className="text-xs text-muted-foreground font-medium">
            {activeTab === 'people' 
              ? `Showing ${filteredRecommendations.length} candidates` 
              : `Showing ${filteredCommunities.length} communities`
            }
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar / Filters Panel */}
          {activeTab === 'people' && (
            <div className="lg:col-span-3 space-y-6 glass-card p-6 border-border/50 sticky top-24">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2 uppercase tracking-wide">
                  <SlidersHorizontal className="w-4 h-4 text-primary" /> Advanced Filters
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetFilters} 
                  className="h-8 text-xs text-muted-foreground hover:text-primary hover:bg-transparent px-2"
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-4">
                {/* Search */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">General Search</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Name, bio, keyword..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>

                {/* Role Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full h-9 bg-secondary/40 border border-border/40 rounded-md px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Roles</option>
                    <option value="founder">Founder</option>
                    <option value="developer">Developer</option>
                    <option value="mentor">Mentor</option>
                    <option value="investor">Investor</option>
                    <option value="student">Student</option>
                    <option value="executive">Executive</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
                </div>

                {/* Skills Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Skill Search</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. React, Python, Rust"
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>

                {/* Country Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Country</label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. India, USA"
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>

                {/* Industry Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Industry</label>
                  <div className="relative">
                    <Building className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. AI, FinTech, SaaS"
                      value={industryFilter}
                      onChange={(e) => setIndustryFilter(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>

                {/* Company Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Company</label>
                  <div className="relative">
                    <Briefcase className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. Google, Stripe"
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>

                {/* College Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">College / University</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. IIT, Stanford"
                      value={collegeFilter}
                      onChange={(e) => setCollegeFilter(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>

                {/* Experience (Years) Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Min Experience (Years)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 3"
                    value={minExperience}
                    onChange={(e) => setMinExperience(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-secondary/30 border-border/40 text-xs h-9"
                  />
                </div>

                {/* Investment Focus Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Investment Focus</label>
                  <div className="relative">
                    <Compass className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. Pre-Seed, Series A"
                      value={investmentFocus}
                      onChange={(e) => setInvestmentFocus(e.target.value)}
                      className="pl-8 bg-secondary/30 border-border/40 text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Area */}
          <div className={`${activeTab === 'people' ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-6`}>
            
            {/* SEARCH BAR FOR COMMUNITIES */}
            {activeTab === 'communities' && (
              <div className="glass-card p-4 border-border/40 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search communities by name or description..."
                    value={communitySearch}
                    onChange={(e) => setCommunitySearch(e.target.value)}
                    className="pl-9 bg-secondary/30 border-border/40 text-sm h-10"
                  />
                </div>
                <Button 
                  onClick={() => router.push('/communities/new')}
                  className="glow-primary h-10"
                >
                  Create Community
                </Button>
              </div>
            )}

            {/* PEOPLE DISCOVERY GRID */}
            {activeTab === 'people' && (
              loadingRecs ? (
                <CardSkeleton count={6} />
              ) : filteredRecommendations.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No matches found"
                  description="Adjust your filters or query to explore other talent in the ecosystem."
                />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRecommendations.map((rec) => {
                    const isStudent = rec.role?.toLowerCase() === 'student'
                    const isDeveloper = rec.role?.toLowerCase() === 'developer'
                    const isFounder = rec.role?.toLowerCase() === 'founder'
                    const isMentor = rec.role?.toLowerCase() === 'mentor'
                    const isInvestor = rec.role?.toLowerCase() === 'investor'
                    const isExecutive = rec.role?.toLowerCase() === 'executive'

                    return (
                      <motion.div
                        key={rec.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-5 flex flex-col justify-between hover:border-primary/40 transition-all duration-300 relative overflow-hidden group border-border/50 bg-sidebar/10"
                      >
                        {/* Glowing Match Badge */}
                        <div className="absolute top-4 right-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full glow-primary">
                            <Sparkles className="w-3 h-3" /> {rec.match || '92%'} Match
                          </span>
                        </div>

                        <div className="space-y-4 flex-1">
                          {/* Header Details */}
                          <div className="flex items-start gap-3">
                            <Avatar className="w-12 h-12 border border-border/40 shrink-0">
                              <AvatarImage src={rec.avatar || ''} />
                              <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                                {getInitials(rec.name)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="min-w-0 pr-16">
                              <Link
                                href={`/users/${rec.id}`}
                                className="hover:text-primary transition-colors block"
                              >
                                <UserNameWithBadge
                                  name={rec.name}
                                  verified={rec.is_verified}
                                  layout="stacked"
                                  badgeLabel="Verified Member"
                                  nameClassName="font-bold text-base text-foreground"
                                />
                              </Link>
                              
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-secondary/80 text-secondary-foreground mt-0.5 border border-border/40">
                                {formatRoleLabel(rec)}
                              </span>
                              {rec.match_factors?.[0] && (
                                <p className="text-[11px] text-primary mt-1.5 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{rec.match_factors[0]}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Profile Onboarding Details */}
                          <div className="text-xs border-t border-border/30 pt-3 space-y-2">
                            {/* Org Field */}
                            <p className="text-muted-foreground flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-semibold text-foreground">Org:</span>
                              <span className="truncate">{getOrgLabel(rec)}</span>
                            </p>

                            {/* Dynamic details */}
                            {isStudent && (
                              <div className="space-y-1">
                                {rec.role_details?.degree && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Degree:</span> {rec.role_details.degree}
                                  </p>
                                )}
                                {rec.role_details?.graduation_year && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Graduation:</span> {rec.role_details.graduation_year}
                                  </p>
                                )}
                              </div>
                            )}

                            {isDeveloper && (
                              <div className="space-y-1">
                                {rec.role_details?.job_title && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Title:</span> {rec.role_details.job_title}
                                  </p>
                                )}
                              </div>
                            )}

                            {isFounder && (
                              <div className="space-y-1">
                                {rec.role_details?.industry && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Industry:</span> {rec.role_details.industry}
                                  </p>
                                )}
                                {rec.role_details?.stage && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Stage:</span>{' '}
                                    <span className="text-orange-400 font-semibold">{rec.role_details.stage}</span>
                                  </p>
                                )}
                                {rec.role_details?.team_size && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Team Size:</span> {rec.role_details.team_size} members
                                  </p>
                                )}
                              </div>
                            )}

                            {isMentor && (
                              <div className="space-y-1">
                                {rec.role_details?.expertise && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Expertise:</span> {rec.role_details.expertise}
                                  </p>
                                )}
                                {rec.role_details?.years_experience && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Experience:</span> {rec.role_details.years_experience} Years
                                  </p>
                                )}
                              </div>
                            )}

                            {isInvestor && (
                              <div className="space-y-1">
                                {rec.role_details?.investment_focus && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Focus:</span> {rec.role_details.investment_focus}
                                  </p>
                                )}
                                {rec.role_details?.preferred_industries && (
                                  <p className="text-muted-foreground flex gap-1">
                                    <span className="font-semibold text-foreground shrink-0">Industries:</span>
                                    <span className="truncate block">
                                      {Array.isArray(rec.role_details.preferred_industries)
                                        ? rec.role_details.preferred_industries.join(', ')
                                        : rec.role_details.preferred_industries}
                                    </span>
                                  </p>
                                )}
                              </div>
                            )}

                            {isExecutive && (
                              <div className="space-y-1">
                                {rec.role_details?.designation && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Title:</span> {rec.role_details.designation}
                                  </p>
                                )}
                                {rec.role_details?.industry && (
                                  <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">Industry:</span> {rec.role_details.industry}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Bio */}
                            {rec.bio && (
                              <p className="text-muted-foreground line-clamp-2 italic text-[11px] pt-1">
                                &ldquo;{rec.bio}&rdquo;
                              </p>
                            )}

                            {/* Skills cloud */}
                            {rec.skills && rec.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {rec.skills.slice(0, 4).map((skill) => (
                                  <span
                                    key={skill}
                                    className="text-[9px] bg-secondary/80 text-secondary-foreground border border-border/40 px-2 py-0.5 rounded font-medium"
                                  >
                                    {skill}
                                  </span>
                                ))}
                                {rec.skills.length > 4 && (
                                  <span className="text-[9px] text-muted-foreground px-1 py-0.5">
                                    +{rec.skills.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quick contact panel */}
                          <div className="flex items-center gap-3 pt-3 border-t border-border/30 text-muted-foreground">
                            <button
                              type="button"
                              title={rec.email ? 'Send email' : 'Email not available'}
                              disabled={!rec.email}
                              onClick={() => rec.email && openGmailCompose(rec.email)}
                              className={`transition-colors ${
                                rec.email
                                  ? 'hover:text-primary'
                                  : 'opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                            {rec.role_details?.website && (
                              <a href={rec.role_details.website} target="_blank" rel="noopener noreferrer" title="Website" className="hover:text-primary transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {rec.role_details?.linkedin && (
                              <a href={rec.role_details.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="hover:text-primary transition-colors">
                                <Linkedin className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {(rec.role_details?.github || rec.github_username) && (
                              <a href={`https://github.com/${rec.role_details?.github || rec.github_username}`} target="_blank" rel="noopener noreferrer" title="GitHub" className="hover:text-primary transition-colors">
                                <Github className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {rec.country && (
                              <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                <Globe className="w-3 h-3 text-muted-foreground" /> {rec.country}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions block */}
                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/30">
                          <ConnectButton userId={rec.id} size="sm" />

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartChat(rec.id)}
                            className="w-full h-8 text-xs font-semibold"
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                            Message
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/sessions?action=schedule&targetId=${rec.id}`)}
                            className="w-full text-xs h-8 text-primary hover:bg-primary/5 border border-primary/10 col-span-2 mt-1 justify-center"
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1" />
                            Schedule Meeting
                          </Button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )
            )}

            {/* COMMUNITIES GRID */}
            {activeTab === 'communities' && (
              loadingCommunities ? (
                <CardSkeleton count={3} />
              ) : filteredCommunities.length === 0 ? (
                <EmptyState
                  icon={Users2}
                  title="No communities found"
                  description="No communities match your current search criteria. Try another search or create a new community."
                />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCommunities.map((community) => {
                    const isJoined = joinedCommunities[community.id]
                    return (
                      <div
                        key={community.id}
                        className="glass-card p-5 flex flex-col justify-between hover:border-primary/40 transition-all border-border/50 bg-sidebar/10"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
                              {community.name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-foreground text-sm truncate">{community.name}</h3>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" /> {community.member_count} members
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-3 min-h-[3rem]">
                            {community.description || 'Welcome to this community! Connect, discuss, and build together.'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-5 pt-3 border-t border-border/30">
                          <Button
                            variant={isJoined ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleJoinToggle(community.id)}
                            className="text-xs h-8 font-semibold w-full"
                          >
                            {isJoined ? 'Leave' : 'Join'}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-xs h-8 border border-border/40 w-full"
                          >
                            <Link href={`/communities/${community.id}`}>
                              View discussions
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

          </div>

        </div>

      </div>

      {/* SCHEDULE MEETING MODAL */}
      <AnimatePresence>
        {schedulingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="glass-card w-full max-w-md p-6 border-border/50 relative"
            >
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary animate-pulse" /> Schedule Meet with {schedulingUser.name}
              </h3>
              
              <form onSubmit={handleScheduleMeeting} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-semibold">Meeting Type</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    className="w-full h-10 bg-secondary/50 border border-border/50 rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Mentorship Session">Mentorship Session</option>
                    <option value="Startup Pitch">Startup Pitch</option>
                    <option value="Technical Review">Technical Review</option>
                    <option value="General Coffee Chat">General Coffee Chat</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-semibold">Title</label>
                  <Input
                    placeholder="e.g. Discuss Co-founder Equity or Review Architecture"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    required
                    className="bg-secondary/50 border-border/50 text-sm"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-semibold">Description (Optional)</label>
                  <Textarea
                    placeholder="Briefly describe what you would like to discuss..."
                    value={meetingDesc}
                    onChange={(e) => setMeetingDesc(e.target.value)}
                    className="min-h-[80px] bg-secondary/50 border-border/50 text-sm"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-semibold">Time & Date</label>
                  <Input
                    type="datetime-local"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    required
                    className="bg-secondary/50 border-border/50 text-sm"
                  />
                </div>
                
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" type="button" onClick={() => setSchedulingUser(null)} className="h-9">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingMeeting} className="h-9 glow-primary">
                    {submittingMeeting ? 'Scheduling...' : 'Schedule Meeting'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
