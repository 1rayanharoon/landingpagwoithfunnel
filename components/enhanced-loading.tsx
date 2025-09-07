"use client"

import { useState, useEffect } from "react"

const LOADING_WORDS = [
  "Listening",
  "Understanding",
  "Clarifying",
  "Exploring",
  "Mapping",
  "Discovering",
  "Uncovering",
  "Connecting",
  "Defining",
  "Framing",
  "Shaping",
  "Organizing",
  "Refining",
  "Prioritizing",
  "Aligning",
  "Designing",
  "Envisioning",
  "Strategizing",
  "Guiding",
  "Planning",
  "Summarizing"
]


interface EnhancedLoadingProps {
  className?: string
}

export function EnhancedLoading({ className = "" }: EnhancedLoadingProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [displayWord, setDisplayWord] = useState(LOADING_WORDS[0])

  useEffect(() => {
    // Start with a random word
    const initialIndex = Math.floor(Math.random() * LOADING_WORDS.length)
    setCurrentWordIndex(initialIndex)
    setDisplayWord(LOADING_WORDS[initialIndex])

    const interval = setInterval(() => {
      setCurrentWordIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % LOADING_WORDS.length
        setDisplayWord(LOADING_WORDS[nextIndex])
        return nextIndex
      })
    }, 1500) // Change word every 1500ms

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      {/* Enhanced loading animation */}
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 border-2 border-muted rounded-full"></div>
        {/* Animated ring */}
        <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Dynamic text */}
      <div className="text-center space-y-2">
        <div className="text-lg text-muted-foreground">
          <span key={currentWordIndex} className="animate-in fade-in-50 slide-in-from-bottom-2">
            {displayWord}...
          </span>
        </div>
      </div>
    </div>
  )
}
