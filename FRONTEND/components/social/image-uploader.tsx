'use client'

import React, { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { uploadAPI } from '@/services/api'

interface ImageUploaderProps {
  onUpload?: (urls: string[]) => void
  maxFiles?: number
  maxSizeMB?: number
}

export function ImageUploader({ onUpload, maxFiles = 5, maxSizeMB = 5 }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE = maxSizeMB * 1024 * 1024

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type not allowed. Allowed: JPG, PNG, WEBP`
    }
    if (file.size > MAX_SIZE) {
      return `File size exceeds ${maxSizeMB}MB limit`
    }
    return null
  }

  const handleFiles = async (files: File[]) => {
    const validatedFiles: File[] = []

    for (const file of files) {
      const error = validateFile(file)
      if (error) {
        setError(error)
        return
      }
      validatedFiles.push(file)
    }

    if (preview.length + validatedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Create previews
    const newPreviews = await Promise.all(
      validatedFiles.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
      )
    )

    setPreview([...preview, ...newPreviews])
    setError(null)

    // Upload files
    setIsLoading(true)
    try {
      const response = await uploadAPI.uploadImages(validatedFiles)
      onUpload?.(response.data.urls)
    } catch (err) {
      setError('Upload failed. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []))
  }

  const removePreview = (index: number) => {
    setPreview(preview.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="w-full flex flex-col items-center gap-2"
        >
          <Upload size={32} className="text-gray-600 dark:text-gray-400" />
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {isLoading ? 'Uploading...' : 'Drag & drop images here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              or click to browse (Max {maxFiles} files, {maxSizeMB}MB each)
            </p>
          </div>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {preview.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removePreview(index)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
