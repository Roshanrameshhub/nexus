'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react'
import { Button } from './button'

interface MediaViewerProps {
  isOpen: boolean
  onClose: () => void
  src: string
  alt?: string
  fileName?: string
  images?: string[] // For carousel support
}

export function MediaViewer({
  isOpen,
  onClose,
  src,
  alt = 'Media',
  fileName,
  images = [],
}: MediaViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const currentSrc = images.length > 0 ? images[currentImageIndex] : src

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          setZoom((z) => Math.min(z + 0.1, 3))
          break
        case '-':
          setZoom((z) => Math.max(z - 0.1, 1))
          break
        case 'ArrowLeft':
          if (images.length > 1) {
            setCurrentImageIndex((i) => (i > 0 ? i - 1 : images.length - 1))
          }
          break
        case 'ArrowRight':
          if (images.length > 1) {
            setCurrentImageIndex((i) => (i < images.length - 1 ? i + 1 : 0))
          }
          break
        case 'f':
          setIsFullScreen(!isFullScreen)
          break
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, images.length, isFullScreen])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 1))
  const handleFitScreen = () => setZoom(1)

  const handleDownload = async () => {
    try {
      const response = await fetch(currentSrc)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'image.jpg'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Image container */}
          <motion.div
            className="relative max-h-screen max-w-screen-xl flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            {/* Image */}
            <div
              className="flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
            >
              <img
                src={currentSrc}
                alt={alt}
                className="max-h-[85vh] max-w-[90vw] object-contain"
              />
            </div>

            {/* Toolbar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="text-white hover:bg-white/20 disabled:opacity-50"
                title="Zoom Out (- key)"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>

              <div className="flex items-center gap-2 px-2 border-l border-r border-white/10 text-white text-sm">
                <span>{Math.round(zoom * 100)}%</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="text-white hover:bg-white/20 disabled:opacity-50"
                title="Zoom In (+ key)"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleFitScreen}
                className="text-white hover:bg-white/20"
                title="Fit Screen (F key)"
              >
                <Maximize className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white hover:bg-white/20"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </Button>

              {/* Image counter for carousel */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 px-2 border-l border-white/10 text-white text-sm">
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) =>
                        i > 0 ? i - 1 : images.length - 1
                      )
                    }
                    className="hover:text-primary transition-colors"
                    title="Previous (← key)"
                  >
                    ←
                  </button>
                  <span>
                    {currentImageIndex + 1} / {images.length}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) =>
                        i < images.length - 1 ? i + 1 : 0
                      )
                    }
                    className="hover:text-primary transition-colors"
                    title="Next (→ key)"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {/* Keyboard hints */}
            <div className="absolute top-20 left-4 text-white/40 text-sm space-y-1 font-mono pointer-events-none">
              <div>ESC - Close</div>
              <div>+/- - Zoom</div>
              <div>F - Fit</div>
              {images.length > 1 && <div>← → - Navigate</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
