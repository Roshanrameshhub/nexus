'use client'

import { motion } from 'framer-motion'

interface TypingIndicatorProps {
  userName?: string
  className?: string
}

export function TypingIndicator({ userName = 'User', className = '' }: TypingIndicatorProps) {
  const dotVariants = {
    hidden: { y: 0, opacity: 0.6 },
    visible: { y: -10, opacity: 1 },
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <span>{userName} is typing</span>
      <motion.div
        className="flex gap-1"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-muted-foreground rounded-full"
            variants={dotVariants}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}
