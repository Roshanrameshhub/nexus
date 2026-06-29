'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function MeetingRoom() {
  const searchParams = useSearchParams()
  const link = searchParams.get('link')

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">🎥 Meeting: </span>
          <span className="text-green-400 font-mono text-sm">{link}</span>
        </div>
        <button
          className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition"
          onClick={() => window.close()}
        >
          Leave Meeting
        </button>
      </div>

      {/* Jitsi - real video meeting! */}
      <iframe
        src={`https://meet.jit.si/${link}`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        allowFullScreen
      />
    </div>
  )
}

export default function MeetingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading meeting...
      </div>
    }>
      <MeetingRoom />
    </Suspense>
  )
}