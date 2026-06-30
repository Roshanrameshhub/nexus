'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { getApiBaseUrl } from '@/lib/config/api'

export default function DictionaryPage() {
  const [word, setWord] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const token = useAuthStore((s) => s.token)

  const searchWord = async () => {
    if (!word.trim()) return
    
    setLoading(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/ai/dictionary/define`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ word })
      })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error('Error:', error)
      alert('Error searching word')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dictionary</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Enter a word..." 
            className="flex-1 px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchWord()}
          />
          <button 
            onClick={searchWord}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {result && result.success && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold text-blue-600">{result.word}</h2>
            {result.definitions?.map((def: any, idx: number) => (
              <div key={idx} className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500">{def.part_of_speech}</p>
                <p className="mt-1">{def.definition}</p>
                {def.example && (
                  <p className="mt-2 text-sm italic text-gray-600 dark:text-gray-400">
                    "{def.example}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {result && !result.success && (
          <p className="mt-4 text-red-500">Word not found. Please try another word.</p>
        )}
      </div>
    </div>
  )
}