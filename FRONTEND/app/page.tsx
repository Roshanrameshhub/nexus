'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  ArrowRight, 
  Sparkles, 
  Users, 
  Rocket, 
  Zap,
  Globe,
  MessageSquare,
  TrendingUp,
  Shield,
  Code,
  Lightbulb
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { communitiesAPI, postsAPI } from '@/services/api'
import { mapPostToFeedView, type FeedPostView } from '@/lib/mappers/posts'
import type { ApiCommunity } from '@/lib/types/api'
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export default function LandingPage() {
  const [spotlightPosts, setSpotlightPosts] = useState<FeedPostView[]>([])
  const [communities, setCommunities] = useState<ApiCommunity[]>([])
  const [loadingCommunities, setLoadingCommunities] = useState(true)

  useEffect(() => {
    postsAPI
      .getFeed(1, 5)
      .then((res) => setSpotlightPosts((res.data.posts || []).map(mapPostToFeedView)))
      .catch(() => setSpotlightPosts([]))
    communitiesAPI
      .getAll()
      .then((res) => setCommunities((res.data.communities || []).slice(0, 4)))
      .catch(() => setCommunities([]))
      .finally(() => setLoadingCommunities(false))
  }, [])

  const spotlight = spotlightPosts.slice(0, 3).map((p) => ({
    name: p.author.name,
    role: p.author.role,
    content: p.content.slice(0, 140) + (p.content.length > 140 ? '…' : ''),
    tags: p.tags.length ? p.tags : ['Nexus'],
  }))

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 mesh-gradient opacity-60" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />
      
      {/* Floating Orbs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-float-delayed" />
      <div className="fixed top-1/2 right-1/3 w-64 h-64 bg-glow-lavender/10 rounded-full blur-3xl animate-pulse-slow" />
      
      {/* Navigation */}
      <nav className="relative z-50 border-b border-border/50 backdrop-blur-xl bg-background/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Nexus</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="#community" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Community
              </Link>
              <Link href="#startups" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Startups
              </Link>
              <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
            </div>
            
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="text-sm glow-primary">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
              variants={fadeInUp}
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">The Future of Startup Networking</span>
            </motion.div>
            
            <motion.h1 
              className="text-5xl md:text-7xl font-bold leading-tight mb-6 text-balance"
              variants={fadeInUp}
            >
              Build the future{' '}
              <span className="text-gradient">together</span>
            </motion.h1>
            
            <motion.p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty"
              variants={fadeInUp}
            >
              Connect with founders, developers, and visionaries in the most advanced startup ecosystem. 
              AI-powered networking for the next generation of builders.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              variants={fadeInUp}
            >
              <Link href="/signup">
                <Button size="lg" className="text-base px-8 glow-primary">
                  Start Building
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-base px-8 glass">
                  Explore Features
                </Button>
              </Link>
            </motion.div>
            
            {/* Stats */}
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-16 pt-16 border-t border-border/50"
              variants={fadeInUp}
            >
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">50K+</div>
                <div className="text-sm text-muted-foreground">Active Founders</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">2.5K+</div>
                <div className="text-sm text-muted-foreground">Startups Launched</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">$500M+</div>
                <div className="text-sm text-muted-foreground">Funding Raised</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">120+</div>
                <div className="text-sm text-muted-foreground">Countries</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      
      {/* Floating Cards Preview */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            {spotlight.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                Join Nexus to see live posts from the community.
              </p>
            )}
            {spotlight.map((card, index) => (
            <motion.div 
              key={`${card.name}-${index}`}
              className={`glass-card p-6 transition-all group ${
                index === 0 ? 'hover:border-primary/50' : index === 1 ? 'hover:border-accent/50' : 'hover:border-glow-lavender/50'
              }`}
              whileHover={{ y: -5, scale: 1.02 }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-primary/20 text-primary' : index === 1 ? 'bg-accent/20 text-accent' : 'bg-glow-lavender/20 text-glow-lavender'
                }`}>
                  {index === 0 ? <Users className="w-6 h-6" /> : index === 1 ? <Code className="w-6 h-6" /> : <Lightbulb className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{card.name}</h3>
                  <p className="text-sm text-muted-foreground">{card.role}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{card.content}</p>
              <div className="flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">{tag}</span>
                ))}
              </div>
            </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-balance">
              Everything you need to{' '}
              <span className="text-gradient">scale your vision</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              A complete ecosystem designed for ambitious builders who want to make an impact.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: 'AI-Powered Matching',
                description: 'Our intelligent algorithms connect you with the right people, opportunities, and resources.',
                color: 'primary'
              },
              {
                icon: Users,
                title: 'Founder Network',
                description: 'Access a global community of founders, investors, and industry experts.',
                color: 'accent'
              },
              {
                icon: Rocket,
                title: 'Startup Discovery',
                description: 'Find and join promising startups or showcase your venture to potential team members.',
                color: 'glow-lavender'
              },
              {
                icon: MessageSquare,
                title: 'Real-Time Collaboration',
                description: 'Built-in messaging, team channels, and workspace tools for seamless collaboration.',
                color: 'primary'
              },
              {
                icon: TrendingUp,
                title: 'Growth Analytics',
                description: 'Track your network growth, engagement metrics, and opportunity pipeline.',
                color: 'accent'
              },
              {
                icon: Shield,
                title: 'Verified Profiles',
                description: 'Trust verified credentials, work history, and community endorsements.',
                color: 'glow-lavender'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                className="glass-card p-6 group hover:border-primary/30 transition-all"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <div className={`w-12 h-12 rounded-xl bg-${feature.color}/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Community Section */}
      <section id="community" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-balance">
                Join thriving{' '}
                <span className="text-gradient-lavender">communities</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 text-pretty">
                Engage in discussions, share knowledge, and learn from the best minds in tech. 
                From AI research to growth hacking, find your tribe.
              </p>
              
              <div className="space-y-4">
                {loadingCommunities && (
                  <p className="text-sm text-muted-foreground">Loading communities…</p>
                )}
                {!loadingCommunities && communities.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No communities yet.{' '}
                    <Link href="/signup" className="text-primary">
                      Join Nexus
                    </Link>{' '}
                    to create the first one.
                  </p>
                )}
                {communities.map((community, index) => (
                  <Link key={community.id} href={`/communities/${community.id}`}>
                    <motion.div
                      className="flex items-center gap-4 p-4 glass-card hover:border-primary/30 transition-all"
                      whileHover={{ x: 10 }}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      viewport={{ once: true }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{community.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {community.member_count} member{community.member_count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>
            
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/50">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">
                      {communities[0]?.name || 'Community feed'}
                    </h4>
                    <p className="text-xs text-muted-foreground">Recent posts</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {spotlightPosts.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4">No posts yet. Be the first to share on Nexus.</p>
                  )}
                  {spotlightPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-accent/20" />
                      <span className="text-sm font-medium text-foreground">{post.author.name}</span>
                      <span className="text-xs text-muted-foreground">{post.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-muted-foreground">{post.likes} likes</span>
                      <span className="text-xs text-muted-foreground">{post.comments} replies</span>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/15 rounded-full blur-2xl" />
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            className="glass-card p-12 md:p-16 text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 mesh-gradient opacity-40" />
            
            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ duration: 0.5, type: 'spring' }}
                viewport={{ once: true }}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-6 flex items-center justify-center glow-primary">
                  <Zap className="w-8 h-8 text-primary-foreground" />
                </div>
              </motion.div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground text-balance">
                Ready to join the future?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto text-pretty">
                Start connecting with the most ambitious builders in tech. Your next co-founder, 
                investor, or breakthrough idea is waiting.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup">
                  <Button size="lg" className="text-base px-8 glow-primary">
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="text-base px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">Nexus</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                The future of startup networking is here.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Product</h4>
              <ul className="space-y-2">
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrations</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Changelog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Company</h4>
              <ul className="space-y-2">
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Careers</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              2026 Nexus. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <Link href="#" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Globe className="w-4 h-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
