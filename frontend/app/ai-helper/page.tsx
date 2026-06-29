'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'

export default function AIHelperPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const token = useAuthStore((s) => s.token)
  const baseUrl = 'http://localhost:8000/api/v1'

  const askAI = async () => {
    if (!question.trim()) return
    
    setLoading(true)
    setAnswer('')
    
    try {
      const res = await fetch(`${baseUrl}/ai/homework-help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: question.trim() })
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAnswer(data.answer)
        } else {
          setAnswer('Error: ' + (data.error || 'Could not get response'))
        }
      } else {
        setAnswer('Error: Server returned ' + res.status)
      }
    } catch (error) {
      console.error('Error:', error)
      setAnswer('Error: Could not connect to AI service')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">AI Homework Helper</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <textarea
          className="w-full p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 min-h-[120px] text-gray-900 dark:text-white"
          placeholder="Ask me anything about your homework..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              askAI()
            }
          }}
        />
        <button 
          onClick={askAI}
          disabled={loading || !question.trim()}
          className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Thinking...' : 'Ask AI'}
        </button>
        
        {answer && (
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Answer:</h3>
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{answer}</p>
          </div>
        )}
      </div>
    </div>
  )
}