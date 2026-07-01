import type { NewsArticle } from '@/services/news-api'

export interface TrendingSkill {
  name: string
  articles: number
  change: number
  trending: boolean
}

const SKILL_PATTERNS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: 'React', patterns: [/\breact\b/i, /\breactjs\b/i, /\breact\.js\b/i] },
  { name: 'TypeScript', patterns: [/\btypescript\b/i, /\bts\b/i] },
  { name: 'AI', patterns: [/\bai\b/i, /\bartificial intelligence\b/i, /\bllm\b/i, /\bgpt\b/i, /\bmachine learning\b/i] },
  { name: 'FastAPI', patterns: [/\bfastapi\b/i] },
  { name: 'Python', patterns: [/\bpython\b/i] },
  { name: 'Flutter', patterns: [/\bflutter\b/i, /\bdart\b/i] },
  { name: 'Docker', patterns: [/\bdocker\b/i, /\bcontainer/i] },
  { name: 'AWS', patterns: [/\baws\b/i, /\bamazon web services\b/i] },
  { name: 'Supabase', patterns: [/\bsupabase\b/i] },
  { name: 'Node.js', patterns: [/\bnode\.?js\b/i, /\bnodejs\b/i] },
  { name: 'Rust', patterns: [/\brust\b/i, /\brustlang\b/i] },
  { name: 'DevOps', patterns: [/\bdevops\b/i, /\bci\/cd\b/i] },
  { name: 'Kubernetes', patterns: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { name: 'Blockchain', patterns: [/\bblockchain\b/i, /\bweb3\b/i, /\bcrypto\b/i] },
  { name: 'Next.js', patterns: [/\bnext\.?js\b/i] },
  { name: 'Vue', patterns: [/\bvue\.?js\b/i, /\bvue\b/i] },
  { name: 'Go', patterns: [/\bgolang\b/i, /\bgo language\b/i] },
]

const CACHE_KEY = 'rconnectx_trending_skills_v1'
const CACHE_TTL_MS = 15 * 60 * 1000

interface SkillsCache {
  updatedAt: string
  skills: TrendingSkill[]
}

export function loadCachedSkills(): SkillsCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SkillsCache
  } catch {
    return null
  }
}

export function saveCachedSkills(skills: TrendingSkill[]): void {
  if (typeof window === 'undefined') return
  const payload: SkillsCache = {
    updatedAt: new Date().toISOString(),
    skills,
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
}

export function isCacheFresh(cache: SkillsCache | null): boolean {
  if (!cache?.updatedAt) return false
  return Date.now() - new Date(cache.updatedAt).getTime() < CACHE_TTL_MS
}

function articleText(article: NewsArticle): string {
  return [
    article.title,
    article.description,
    article.content,
    ...(article.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
}

export function analyzeTrendingSkills(articles: NewsArticle[], limit = 8): TrendingSkill[] {
  if (!articles.length) {
    const cached = loadCachedSkills()
    if (cached?.skills.length) return cached.skills.slice(0, limit)
    return SKILL_PATTERNS.slice(0, limit).map((skill) => ({
      name: skill.name,
      articles: 0,
      change: 0,
      trending: true,
    }))
  }

  const counts = new Map<string, number>()
  for (const article of articles) {
    const text = articleText(article)
    for (const skill of SKILL_PATTERNS) {
      if (skill.patterns.some((p) => p.test(text))) {
        counts.set(skill.name, (counts.get(skill.name) ?? 0) + 1)
      }
    }
    for (const tag of article.tags ?? []) {
      const normalized = tag.replace(/^#/, '').trim()
      const match = SKILL_PATTERNS.find(
        (s) => s.name.toLowerCase() === normalized.toLowerCase()
      )
      if (match) {
        counts.set(match.name, (counts.get(match.name) ?? 0) + 1)
      }
    }
  }

  const total = articles.length
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, articlesCount], index) => {
      const share = Math.round((articlesCount / total) * 100)
      const change = Math.min(45, Math.max(2, share + (index % 2 === 0 ? 5 : -2)))
      return {
        name,
        articles: articlesCount,
        change,
        trending: change >= 0,
      }
    })

  if (!ranked.length) {
    const cached = loadCachedSkills()
    if (cached?.skills.length) return cached.skills.slice(0, limit)
    return SKILL_PATTERNS.slice(0, limit).map((skill) => ({
      name: skill.name,
      articles: 0,
      change: 0,
      trending: true,
    }))
  }

  saveCachedSkills(ranked)
  return ranked
}

export function skillNavigationLinks(skillName: string) {
  const q = encodeURIComponent(skillName)
  return {
    news: `/news?q=${q}`,
    communities: `/community?search=${q}`,
    users: `/network?tab=people&q=${q}`,
    opportunities: `/ecosystem?category=opportunities&q=${q}`,
  }
}
