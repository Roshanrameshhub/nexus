'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  ArrowRight, 
  Sparkles, 
  Users, 
  Rocket, 
  Zap,
  MessageSquare,
  TrendingUp,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
          <div className="flex flex-col md:flex-row items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Nexus</span>
            </Link>
            
            <p className="text-sm text-muted-foreground mt-4 md:mt-0">
              2026 Nexus. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
