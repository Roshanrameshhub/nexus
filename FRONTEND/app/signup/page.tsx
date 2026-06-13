'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  User,
  Briefcase,
  Code,
  Lightbulb,
  GraduationCap,
  Users,
  Check,
  Globe,
  Camera,
  Layers,
  Building,
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { authAPI, uploadAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

const roles = [
  { id: 'student', label: 'Student', icon: GraduationCap, description: 'Learning, coding & exploring' },
  { id: 'developer', label: 'Developer', icon: Code, description: 'Building projects & shipping code' },
  { id: 'founder', label: 'Founder', icon: Briefcase, description: 'Starting & growing startups' },
  { id: 'mentor', label: 'Mentor', icon: Lightbulb, description: 'Guiding startup teams & builders' },
  { id: 'executive', label: 'Executive', icon: Users, description: 'Advising & industry leadership' },
  { id: 'investor', label: 'Investor', icon: DollarSign, description: 'Funding & scaling startups' },
]

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    country: '',
    avatar: '',
    role: '',
    // Role-specific structures
    student: { college_name: '', degree: '', department: '', graduation_year: '', skills: '', looking_for: 'Find a Mentor' },
    developer: { company_name: '', job_title: '', skills: '', github: '', linkedin: '', portfolio_website: '', looking_for: 'Collaborate on Projects' },
    founder: { startup_name: '', website: '', industry: '', vision: '', mission: '', products_services: '', startup_stage: 'Seed', team_size: '', looking_for: 'Connect with Investors' },
    mentor: { domain_expertise: '', years_of_experience: '', organization: '', linkedin: '', website: '', looking_for: 'Guide Students' },
    executive: { company_name: '', designation: '', industry: '', company_website: '', linkedin: '', looking_for: 'Industry Networking' },
    investor: { organization_name: '', investor_type: 'Venture Capital', investment_focus: '', preferred_industries: '', website: '', linkedin: '', looking_for: 'Early Stage Startups' }
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const res = await uploadAPI.uploadImages([file])
      const url = res.data.urls?.[0]
      if (url) {
        setFormData(prev => ({ ...prev, avatar: url }))
        toast.success('Avatar uploaded successfully')
      }
    } catch {
      toast.error('Avatar upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRoleDetailsChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [prev.role]: {
        ...(prev[prev.role as keyof typeof prev] as object),
        [key]: value
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) {
      setStep(step + 1)
      return
    }
    
    setIsLoading(true)
    setError('')
    try {
      const roleDetails: any = formData[formData.role as keyof typeof formData] || {}
      
      // Extract skills as a list of strings
      let skillsList: string[] = []
      if (roleDetails.skills) {
        skillsList = roleDetails.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      } else if (roleDetails.domain_expertise) {
        skillsList = roleDetails.domain_expertise.split(',').map((s: string) => s.trim()).filter(Boolean)
      } else if (roleDetails.investment_focus) {
        skillsList = roleDetails.investment_focus.split(',').map((s: string) => s.trim()).filter(Boolean)
      }

      const college = roleDetails.college_name || ''
      const company = roleDetails.company_name || roleDetails.organization || roleDetails.organization_name || ''

      const { data } = await authAPI.signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        skills: skillsList,
        country: formData.country,
        college: college,
        company: company,
        role_details: roleDetails,
      } as any)

      const u = data.user
      setAuth(
        {
          id: String(u.id),
          name: u.name,
          email: u.email,
          avatar: u.avatar || formData.avatar,
          role: u.role,
          platform_role: u.platform_role ?? 'USER',
          skills: u.skills || [],
          bio: u.bio,
        },
        data.access_token,
        data.refresh_token
      )
      toast.success('Registration successful!')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not create account. Email may already be in use.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 overflow-y-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 mesh-gradient opacity-60 pointer-events-none" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />
      
      {/* Floating Orbs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-float-delayed pointer-events-none" />
      
      <motion.div 
        className="w-full max-w-xl relative z-10 my-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">Nexus</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {step === 1 && 'Create your account'}
            {step === 2 && 'What describes you best?'}
            {step === 3 && 'Onboarding details'}
          </h1>
          <p className="text-muted-foreground">
            {step === 1 && 'Join the future of startup networking'}
            {step === 2 && 'Select your role in the startup ecosystem'}
            {step === 3 && 'Tell us more about your background'}
          </p>
        </motion.div>
        
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-8 bg-primary' : s < step ? 'w-4 bg-primary/50' : 'w-4 bg-border'
              }`}
            />
          ))}
        </div>
        
        {/* Form */}
        <motion.div 
          className="glass-card p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <form onSubmit={handleSubmit}>
            {error && step === 3 && (
              <p className="text-sm text-destructive text-center mb-4">{error}</p>
            )}
            <AnimatePresence mode="wait">
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Profile Picture Upload */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-24 h-24 rounded-full border border-border bg-secondary/50 flex items-center justify-center overflow-hidden group">
                      {formData.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                        <span className="text-white text-xs font-medium">Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={isUploading} />
                      </label>
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Upload a profile picture</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 h-12"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-foreground">Country</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="country"
                        type="text"
                        placeholder="e.g. United States, India, Canada"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 h-12"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary/50 h-12"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                  </div>
                </motion.div>
              )}
              
              {/* Step 2: Role Selection */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                >
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: role.id })}
                      className={`p-4 rounded-xl border transition-all flex flex-col gap-3 text-left ${
                        formData.role === role.id
                          ? 'bg-primary/10 border-primary/50'
                          : 'bg-secondary/30 border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          formData.role === role.id ? 'bg-primary/20' : 'bg-secondary'
                        }`}>
                          <role.icon className={`w-5 h-5 ${
                            formData.role === role.id ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                        </div>
                        {formData.role === role.id && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{role.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
              
              {/* Step 3: Role-Specific Details */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* STUDENT DETAILS */}
                  {formData.role === 'student' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>College Name</Label>
                          <Input 
                            placeholder="e.g. Stanford University"
                            value={formData.student.college_name}
                            onChange={(e) => handleRoleDetailsChange('college_name', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Degree</Label>
                          <Input 
                            placeholder="e.g. B.S. / M.S."
                            value={formData.student.degree}
                            onChange={(e) => handleRoleDetailsChange('degree', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Department</Label>
                          <Input 
                            placeholder="e.g. Computer Science"
                            value={formData.student.department}
                            onChange={(e) => handleRoleDetailsChange('department', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Graduation Year</Label>
                          <Input 
                            placeholder="e.g. 2027"
                            value={formData.student.graduation_year}
                            onChange={(e) => handleRoleDetailsChange('graduation_year', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Skills (Comma-separated)</Label>
                        <Input 
                          placeholder="e.g. Python, React, Data Structures"
                          value={formData.student.skills}
                          onChange={(e) => handleRoleDetailsChange('skills', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>What are you looking for on Nexus?</Label>
                        <select 
                          value={formData.student.looking_for}
                          onChange={(e) => handleRoleDetailsChange('looking_for', e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          <option>Find a Mentor</option>
                          <option>Build a Startup</option>
                          <option>Networking</option>
                          <option>Learn & Explore</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* DEVELOPER DETAILS */}
                  {formData.role === 'developer' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Company Name</Label>
                          <Input 
                            placeholder="e.g. Google / Stripe"
                            value={formData.developer.company_name}
                            onChange={(e) => handleRoleDetailsChange('company_name', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Job Title</Label>
                          <Input 
                            placeholder="e.g. Senior Software Engineer"
                            value={formData.developer.job_title}
                            onChange={(e) => handleRoleDetailsChange('job_title', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Skills (Comma-separated)</Label>
                        <Input 
                          placeholder="e.g. TypeScript, Next.js, Rust, Docker"
                          value={formData.developer.skills}
                          onChange={(e) => handleRoleDetailsChange('skills', e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>GitHub Profile URL</Label>
                          <Input 
                            placeholder="https://github.com/username"
                            value={formData.developer.github}
                            onChange={(e) => handleRoleDetailsChange('github', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>LinkedIn Profile URL</Label>
                          <Input 
                            placeholder="https://linkedin.com/in/username"
                            value={formData.developer.linkedin}
                            onChange={(e) => handleRoleDetailsChange('linkedin', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Portfolio Website</Label>
                        <Input 
                          placeholder="https://myportfolio.com"
                          value={formData.developer.portfolio_website}
                          onChange={(e) => handleRoleDetailsChange('portfolio_website', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>What are you looking for?</Label>
                        <select 
                          value={formData.developer.looking_for}
                          onChange={(e) => handleRoleDetailsChange('looking_for', e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          <option>Collaborate on Projects</option>
                          <option>Join Startup Teams</option>
                          <option>Networking</option>
                          <option>Learn & Share Knowledge</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* FOUNDER DETAILS */}
                  {formData.role === 'founder' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Startup Name</Label>
                          <Input 
                            placeholder="e.g. Acme AI"
                            value={formData.founder.startup_name}
                            onChange={(e) => handleRoleDetailsChange('startup_name', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Website</Label>
                          <Input 
                            placeholder="e.g. acme.ai"
                            value={formData.founder.website}
                            onChange={(e) => handleRoleDetailsChange('website', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Industry</Label>
                          <Input 
                            placeholder="e.g. SaaS / Healthcare AI"
                            value={formData.founder.industry}
                            onChange={(e) => handleRoleDetailsChange('industry', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Team Size</Label>
                          <Input 
                            placeholder="e.g. 5"
                            type="number"
                            value={formData.founder.team_size}
                            onChange={(e) => handleRoleDetailsChange('team_size', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Vision</Label>
                        <Input 
                          placeholder="e.g. To democratize access to AI tools"
                          value={formData.founder.vision}
                          onChange={(e) => handleRoleDetailsChange('vision', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mission</Label>
                        <Textarea 
                          placeholder="Explain what your startup does and its mission..."
                          value={formData.founder.mission}
                          onChange={(e) => handleRoleDetailsChange('mission', e.target.value)}
                          className="min-h-[60px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Products/Services</Label>
                        <Input 
                          placeholder="e.g. Developer APIs, Enterprise Search Dashboard"
                          value={formData.founder.products_services}
                          onChange={(e) => handleRoleDetailsChange('products_services', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Startup Stage</Label>
                          <select 
                            value={formData.founder.startup_stage}
                            onChange={(e) => handleRoleDetailsChange('startup_stage', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                          >
                            <option>Ideation</option>
                            <option>Pre-Seed</option>
                            <option>Seed</option>
                            <option>Series A</option>
                            <option>Series B+</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>What is your primary goal?</Label>
                          <select 
                            value={formData.founder.looking_for}
                            onChange={(e) => handleRoleDetailsChange('looking_for', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                          >
                            <option>Connect with Investors</option>
                            <option>Grow My Startup</option>
                            <option>Find Team Members</option>
                            <option>Networking</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* MENTOR DETAILS */}
                  {formData.role === 'mentor' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Domain Expertise</Label>
                          <Input 
                            placeholder="e.g. Product Management, AI Architect"
                            value={formData.mentor.domain_expertise}
                            onChange={(e) => handleRoleDetailsChange('domain_expertise', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Years of Experience</Label>
                          <Input 
                            placeholder="e.g. 10"
                            type="number"
                            value={formData.mentor.years_of_experience}
                            onChange={(e) => handleRoleDetailsChange('years_of_experience', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Organization</Label>
                        <Input 
                          placeholder="e.g. Y Combinator / Techstars"
                          value={formData.mentor.organization}
                          onChange={(e) => handleRoleDetailsChange('organization', e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>LinkedIn URL</Label>
                          <Input 
                            placeholder="https://linkedin.com/in/username"
                            value={formData.mentor.linkedin}
                            onChange={(e) => handleRoleDetailsChange('linkedin', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Website URL</Label>
                          <Input 
                            placeholder="https://mentorwebsite.com"
                            value={formData.mentor.website}
                            onChange={(e) => handleRoleDetailsChange('website', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>What is your goal?</Label>
                        <select 
                          value={formData.mentor.looking_for}
                          onChange={(e) => handleRoleDetailsChange('looking_for', e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          <option>Guide Students</option>
                          <option>Mentor Founders</option>
                          <option>Professional Networking</option>
                          <option>Community Contribution</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* EXECUTIVE DETAILS */}
                  {formData.role === 'executive' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Company Name</Label>
                          <Input 
                            placeholder="e.g. Microsoft / Salesforce"
                            value={formData.executive.company_name}
                            onChange={(e) => handleRoleDetailsChange('company_name', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Designation</Label>
                          <Input 
                            placeholder="e.g. VP of Product / CTO"
                            value={formData.executive.designation}
                            onChange={(e) => handleRoleDetailsChange('designation', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Industry</Label>
                          <Input 
                            placeholder="e.g. Enterprise Software"
                            value={formData.executive.industry}
                            onChange={(e) => handleRoleDetailsChange('industry', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Company Website</Label>
                          <Input 
                            placeholder="https://company.com"
                            value={formData.executive.company_website}
                            onChange={(e) => handleRoleDetailsChange('company_website', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>LinkedIn URL</Label>
                        <Input 
                          placeholder="https://linkedin.com/in/username"
                          value={formData.executive.linkedin}
                          onChange={(e) => handleRoleDetailsChange('linkedin', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>What is your goal?</Label>
                        <select 
                          value={formData.executive.looking_for}
                          onChange={(e) => handleRoleDetailsChange('looking_for', e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          <option>Industry Networking</option>
                          <option>Mentorship</option>
                          <option>Startup Advisory</option>
                          <option>Knowledge Sharing</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* INVESTOR DETAILS */}
                  {formData.role === 'investor' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Organization Name</Label>
                          <Input 
                            placeholder="e.g. Sequoia Capital"
                            value={formData.investor.organization_name}
                            onChange={(e) => handleRoleDetailsChange('organization_name', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Investor Type</Label>
                          <select 
                            value={formData.investor.investor_type}
                            onChange={(e) => handleRoleDetailsChange('investor_type', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                          >
                            <option>Angel Investor</option>
                            <option>Venture Capital</option>
                            <option>Corporate VC</option>
                            <option>Private Equity</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Investment Focus (Comma-separated)</Label>
                        <Input 
                          placeholder="e.g. Seed, B2B SaaS, Generative AI"
                          value={formData.investor.investment_focus}
                          onChange={(e) => handleRoleDetailsChange('investment_focus', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preferred Industries (Comma-separated)</Label>
                        <Input 
                          placeholder="e.g. FinTech, HealthTech, DevTools"
                          value={formData.investor.preferred_industries}
                          onChange={(e) => handleRoleDetailsChange('preferred_industries', e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Website URL</Label>
                          <Input 
                            placeholder="https://sequoiacap.com"
                            value={formData.investor.website}
                            onChange={(e) => handleRoleDetailsChange('website', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>LinkedIn URL</Label>
                          <Input 
                            placeholder="https://linkedin.com/in/username"
                            value={formData.investor.linkedin}
                            onChange={(e) => handleRoleDetailsChange('linkedin', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>What are you interested in?</Label>
                        <select 
                          value={formData.investor.looking_for}
                          onChange={(e) => handleRoleDetailsChange('looking_for', e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                        >
                          <option>Early Stage Startups</option>
                          <option>Growth Stage Startups</option>
                          <option>Founder Networking</option>
                          <option>Industry Insights</option>
                        </select>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Navigation Buttons */}
            <div className="flex items-center gap-3 mt-8">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="h-12"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Button 
                type="submit" 
                className="flex-1 h-12 text-base glow-primary"
                disabled={
                  isLoading || 
                  (step === 2 && !formData.role)
                }
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Creating account...
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    {step === 3 ? 'Create Account' : 'Continue'}
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </div>
          </form>
          
          {step === 1 && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <GoogleSignInButton label="Continue with Google" />
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:text-primary/80 transition-colors font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </motion.div>
        
        {/* Terms */}
        <motion.p 
          className="text-center text-xs text-muted-foreground mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          By signing up, you agree to our{' '}
          <Link href="#" className="text-primary hover:underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
