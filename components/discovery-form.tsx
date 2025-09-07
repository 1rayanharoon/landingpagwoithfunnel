"use client"

import { useCallback } from "react"
import { useEffect } from "react"
import { useState } from "react"
import type React from "react"
import { EnhancedLoading } from "./enhanced-loading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Key,
  XIcon,
  ChevronDown,
  ChevronUp,
  Copy,
  Zap,
  Palette,
  Code,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react"

interface Question {
  id: string
  title?: string // Added title field for short question titles
  description?: string // Added description field for detailed explanations
  question: string // Keep for backward compatibility
  inputType:
    | "text"
    | "long_text"
    | "yes_no"
    | "dropdown"
    | "multiselect"
    | "date"
    | "number"
    | "rating"
    | "email"
    | "url"
    | "contact" // New input type for combined fields
  options?: string[]
  suggestedAnswers?: string[] // Added suggested answers field
  required?: boolean
  scale?: { min: number; max: number; step?: number } // For rating type
}

interface Response {
  question: string
  answer: string
}

const STATIC_QUESTIONS: Question[] = [
  {
    id: "contact_info",
    title: "Ready to Start Your Next Project?", // Updated title and description to match engaging messaging style from screenshot
    description: "Answer some quick questions about your project and then schedule a call with your project manager.",
    question: "What's your name and email?",
    inputType: "contact",
    required: true,
  },
  {
    id: "project_type",
    title: "Project Type", // Keeping concise title
    description: "Select the type of software solution you need to build.", // More formal, direct description
    question: "What type of software project are you looking to build?",
    inputType: "dropdown",
    options: [
      "Web Application",
      "Mobile App (iOS/Android)",
      "E-commerce Store",
      "SaaS Platform",
      "API/Backend System",
      "Website/Landing Page",
      "Automation Tool",
      "Other",
    ],
    required: true,
  },
  {
    id: "project_description",
    title: "Project Overview", // More formal title
    description: "Describe your project requirements, target users, and key functionality needed.", // More formal, concise description
    question: "Describe your project in detail",
    inputType: "long_text",
    suggestedAnswers: [
      "We need a customer portal where clients can track orders, manage their accounts, and access support resources.",
      "Our team spends 3 hours daily on manual data entry that could be automated with a custom workflow system.",
      "We want to build a marketplace connecting freelancers with small businesses, similar to Upwork but for our niche industry.",
      "I'm looking to create an internal dashboard that consolidates data from multiple systems for better decision making.",
    ],
    required: true,
  },
  {
    id: "deadline",
    title: "Project Timeline", // More formal title
    description: "Specify your preferred project completion timeframe or deadline requirements.", // More formal, instructional description
    question: "Do you have a deadline or launch date?",
    inputType: "dropdown",
    options: [
      "ASAP (Rush job)",
      "1-2 weeks",
      "1 month",
      "2-3 months",
      "3-6 months",
      "6+ months",
      "No specific deadline",
    ],
    required: false,
  },
]

function DiscoveryForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [questions, setQuestions] = useState<Question[]>(STATIC_QUESTIONS)
  const [responses, setResponses] = useState<Response[]>([])
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [multiSelectAnswers, setMultiSelectAnswers] = useState<string[]>([])
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState("")
  const [submissionStatus, setSubmissionStatus] = useState<"pending" | "success" | "error" | "idle">("pending")
  const [submissionMessage, setSubmissionMessage] = useState("")
  const [submissionId, setSubmissionId] = useState("")
  const [isOnline, setIsOnline] = useState(true)
  const [aiQuestionsGenerated, setAiQuestionsGenerated] = useState(0)
  const [apiKeyError, setApiKeyError] = useState(false)
  const [contactInfo, setContactInfo] = useState({ name: "", email: "" }) // New state for contact info
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1) // Added state for tracking focused pill option for keyboard navigation
  const [streamingQuestion, setStreamingQuestion] = useState<Partial<Question> | null>(null) // Initialize streaming state
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true) // Added state for collapsible suggestions
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)

  const currentQuestion = questions[currentStep]
  const isLastStaticQuestion = currentStep === STATIC_QUESTIONS.length - 1
  const canProceed = currentAnswer.trim() !== "" || !currentQuestion?.required
  const totalQuestions = questions.length + (isComplete ? 0 : 1) // Add 1 if not complete to account for potential next question
  const progressPercentage = Math.min(
    ((currentStep + 1) / Math.max(totalQuestions, STATIC_QUESTIONS.length + 1)) * 100,
    100,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && canProceed && !isGeneratingQuestion && !isSubmitting) {
        e.preventDefault()
        handleNext()
      }

      if (e.key === "Escape" && currentStep > 0 && !isGeneratingQuestion && !isSubmitting) {
        e.preventDefault()
        handleBack()
      }

      if (currentQuestion?.inputType === "dropdown" || currentQuestion?.inputType === "multiselect") {
        const options = currentQuestion.options || []

        if (e.key === "Tab" && !e.shiftKey) {
          e.preventDefault()
          setFocusedOptionIndex((prev) => (prev + 1) % options.length)
        }

        if (e.key === "Tab" && e.shiftKey) {
          e.preventDefault()
          setFocusedOptionIndex((prev) => (prev - 1 + options.length) % options.length)
        }

        if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
          e.preventDefault()
          const optionIndex = Number.parseInt(e.key) - 1
          if (optionIndex < options.length) {
            const option = options[optionIndex]
            if (currentQuestion.inputType === "dropdown") {
              setCurrentAnswer(option)
              if (validationError) setValidationError("")
            } else if (currentQuestion.inputType === "multiselect") {
              if (multiSelectAnswers.includes(option)) {
                setMultiSelectAnswers(multiSelectAnswers.filter((a) => a !== option))
              } else {
                setMultiSelectAnswers([...multiSelectAnswers, option])
              }
              if (validationError) setValidationError("")
            }
          }
        }

        if ((e.key === " " || e.key === "Enter") && focusedOptionIndex >= 0 && focusedOptionIndex < options.length) {
          e.preventDefault()
          const option = options[focusedOptionIndex]
          if (currentQuestion.inputType === "dropdown") {
            setCurrentAnswer(option)
            if (validationError) setValidationError("")
          } else if (currentQuestion.inputType === "multiselect") {
            if (multiSelectAnswers.includes(option)) {
              setMultiSelectAnswers(multiSelectAnswers.filter((a) => a !== option))
            } else {
              setMultiSelectAnswers([...multiSelectAnswers, option])
            }
            if (validationError) setValidationError("")
          }
        }
      }
    },
    [
      canProceed,
      currentStep,
      isGeneratingQuestion,
      isSubmitting,
      currentQuestion,
      focusedOptionIndex,
      multiSelectAnswers,
      validationError,
    ],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setFocusedOptionIndex(-1)
  }, [currentStep])

  const validateAnswer = (answer: string, question: Question): string => {
    if (question.required && !answer.trim()) {
      return "This field is required"
    }
    if (question.inputType === "text" && answer.length > 100) {
      return "Please keep your answer under 100 characters"
    }
    if (question.inputType === "long_text" && answer.length > 1000) {
      return "Please keep your answer under 1000 characters"
    }
    if (question.inputType === "number" && answer && isNaN(Number(answer))) {
      return "Please enter a valid number"
    }
    if (question.inputType === "contact") {
      const [name, email] = answer.split("|")
      if (!name?.trim()) {
        return "Name is required"
      }
      if (!email?.trim()) {
        return "Email is required"
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return "Please enter a valid email address"
      }
    }
    return ""
  }

  const handleNext = async () => {
    if (isSubmitting || isComplete) {
      return
    }

    setValidationError("")
    setFocusedOptionIndex(-1)

    // Validation logic
    if (currentQuestion?.inputType === "contact") {
      if (!contactInfo.name.trim() || !contactInfo.email.trim()) {
        setValidationError("Please fill in both name and email fields")
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email)) {
        setValidationError("Please enter a valid email address")
        return
      }
    } else if (currentQuestion?.inputType === "multiselect") {
      if (multiSelectAnswers.length === 0) {
        setValidationError("Please select at least one option")
        return
      }
    } else if (currentQuestion?.required && !currentAnswer.trim()) {
      setValidationError("This field is required")
      return
    }

    let answerValue = ""
    if (currentQuestion?.inputType === "contact") {
      answerValue = `${contactInfo.name}|${contactInfo.email}`
    } else if (currentQuestion?.inputType === "multiselect") {
      answerValue = multiSelectAnswers.join(", ")
    } else {
      answerValue = currentAnswer.trim()
    }

    if (!answerValue && currentQuestion?.required !== false) {
      setValidationError("Please provide an answer before continuing")
      return
    }

    const newResponse: Response = {
      question: currentQuestion.question,
      answer: answerValue,
    }
    const updatedResponses = [...responses, newResponse]
    setResponses(updatedResponses)

    const isLastStaticQuestion = currentStep >= STATIC_QUESTIONS.length - 1
    const isLastAIQuestion = aiQuestionsGenerated >= 8
    const isLastOverallQuestion = currentStep >= questions.length - 1

    if (isLastStaticQuestion && !isLastAIQuestion) {
      setIsGeneratingQuestion(true)
      try {
        const aiQuestion = await generateNextQuestion(updatedResponses, aiQuestionsGenerated)
        if (aiQuestion && aiQuestionsGenerated < 8) {
          const isDuplicate = questions.some((q) => q.title === aiQuestion.title || q.question === aiQuestion.question)
          if (!isDuplicate) {
            setQuestions([...questions, aiQuestion])
            setAiQuestionsGenerated(aiQuestionsGenerated + 1)
            setCurrentStep(currentStep + 1)
            setCurrentAnswer("")
            setMultiSelectAnswers([])
          } else {
            // Skip duplicate and try to complete or generate another
            if (aiQuestionsGenerated >= 7) {
              setIsComplete(true)
              handleSubmit()
            }
          }
        } else {
          setIsComplete(true)
          handleSubmit()
        }
      } catch (error) {
        console.error("Failed to generate question:", error)
        setIsComplete(true)
        handleSubmit()
      }
      setIsGeneratingQuestion(false)
    } else if (isLastOverallQuestion || isLastAIQuestion) {
      setIsComplete(true)
      handleSubmit()
    } else {
      setCurrentStep(currentStep + 1)
      setCurrentAnswer("")
      setMultiSelectAnswers([])
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      const previousResponse = responses[currentStep - 1]
      if (questions[currentStep - 1]?.inputType === "multiselect") {
        setMultiSelectAnswers(previousResponse?.answer ? previousResponse.answer.split(", ") : [])
        setCurrentAnswer("")
      } else if (questions[currentStep - 1]?.inputType === "contact") {
        const [name, email] = previousResponse?.answer.split("|") || ["", ""]
        setContactInfo({ name, email })
        setCurrentAnswer("")
      } else {
        setCurrentAnswer(previousResponse?.answer || "")
        setMultiSelectAnswers([])
      }
      setResponses(responses.slice(0, -1))
      setValidationError("")
    }
  }

  const generateNextQuestion = async (allResponses: Response[], currentAiCount: number): Promise<Question | null> => {
    try {
      setStreamingQuestion({}) // Initialize streaming state

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // Increased timeout for streaming

      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          responses: allResponses,
          aiQuestionsGenerated: currentAiCount,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        if (errorText.includes("API key") || errorText.includes("OPENAI_API_KEY")) {
          setApiKeyError(true)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let finalQuestion: Question | null = null

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") {
                setStreamingQuestion(null)
                break
              }

              try {
                const parsed = JSON.parse(data)

                if (parsed.complete) {
                  setStreamingQuestion(null)
                  return null
                }

                // Update streaming question with partial data
                setStreamingQuestion((prev) => ({
                  id: `ai_${currentAiCount + 1}`,
                  ...prev,
                  ...parsed,
                }))

                // If we have all required fields, prepare final question
                if (parsed.title && parsed.description && parsed.inputType) {
                  finalQuestion = {
                    id: `ai_${currentAiCount + 1}`,
                    title: parsed.title,
                    description: parsed.description,
                    question: parsed.title,
                    inputType: parsed.inputType,
                    options: parsed.options,
                    suggestedAnswers: parsed.suggestedAnswers,
                  }
                }
              } catch (e) {
                console.error("Error parsing streaming data:", e)
              }
            }
          }
        }
      }

      setApiKeyError(false)
      setStreamingQuestion(null)
      return finalQuestion
    } catch (error) {
      console.error("Error generating question:", error)
      setStreamingQuestion(null)
      if (error instanceof Error && error.message.includes("API key")) {
        setApiKeyError(true)
      }
      throw error
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting || submissionStatus === "success") {
      return
    }

    if (!isOnline) {
      setSubmissionStatus("error")
      setSubmissionMessage("You're currently offline. Please check your internet connection and try again.")
      return
    }

    setIsSubmitting(true)
    setSubmissionStatus("pending")

    try {
      const filteredResponses = responses.filter((response, index, arr) => {
        return response.answer.trim() !== "" && arr.findIndex((r) => r.question === response.question) === index
      })

      const payload = {
        timestamp: new Date().toISOString(),
        goal: "scoping a software project",
        responses: filteredResponses,
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch("/api/submit-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const result = await response.json()

      if (response.ok) {
        setSubmissionStatus("success")
        setSubmissionMessage(result.message || "Form submitted successfully!")
        setSubmissionId(result.submissionId || "")
      } else {
        setSubmissionStatus("error")
        setSubmissionMessage(result.message || "Submission failed. Please try again.")
        setSubmissionId(result.submissionId || "")
      }
    } catch (error) {
      console.error("Submission error:", error)
      setSubmissionStatus("error")
      if (error instanceof Error && error.name === "AbortError") {
        setSubmissionMessage("Request timed out. Please try again.")
      } else {
        setSubmissionMessage("Network error. Please check your connection and try again.")
      }
    }

    setIsSubmitting(false)
  }

  const renderInput = () => {
    const inputProps = {
      value: currentAnswer,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCurrentAnswer(e.target.value)
        if (validationError) setValidationError("")
      },
      className: `text-xl p-6 bg-input border-2 border-border rounded-xl transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground ${
        validationError ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
      }`,
      autoFocus: true,
      "aria-describedby": validationError ? "validation-error" : undefined,
    }

    switch (currentQuestion?.inputType) {
      case "text":
      case "email":
      case "url":
        return (
          <div className="space-y-3">
            <div className="relative">
              <Input
                type={
                  currentQuestion.inputType === "email" ? "email" : currentQuestion.inputType === "url" ? "url" : "text"
                }
                placeholder={
                  currentQuestion.inputType === "email"
                    ? "example@company.com" // Updated email placeholder with clearly dummy email
                    : currentQuestion.inputType === "url"
                      ? "https://example.com" // Updated URL placeholder with clearly dummy URL
                      : "Type your response here..." // Updated to generic placeholder
                }
                {...inputProps}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canProceed) {
                    e.preventDefault()
                    handleNext()
                  }
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                <div className="w-3 h-3 bg-primary rounded-full opacity-60"></div>
                <div className="w-3 h-3 bg-primary rounded-full opacity-40"></div>
              </div>
            </div>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "number":
        return (
          <div className="space-y-3">
            <div className="relative">
              <Input
                type="number"
                placeholder="123"
                {...inputProps}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canProceed) {
                    e.preventDefault()
                    handleNext()
                  }
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                <div className="w-3 h-3 bg-primary rounded-full opacity-60"></div>
                <div className="w-3 h-3 bg-primary rounded-full opacity-40"></div>
              </div>
            </div>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "date":
        const selectedDate = currentAnswer ? new Date(currentAnswer) : undefined

        return (
          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Input
                    readOnly
                    placeholder="Select date..."
                    value={selectedDate ? format(selectedDate, "MM/dd/yyyy") : ""}
                    className="cursor-pointer"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canProceed) {
                        e.preventDefault()
                        handleNext()
                      }
                    }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 pointer-events-none">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <div className="w-3 h-3 bg-primary rounded-full opacity-60"></div>
                    <div className="w-3 h-3 bg-primary rounded-full opacity-40"></div>
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setCurrentAnswer(date.toISOString().split("T")[0])
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "rating":
        const scale = currentQuestion.scale || { min: 1, max: 5, step: 1 }
        const ratingOptions = []
        for (let i = scale.min; i <= scale.max; i += scale.step || 1) {
          ratingOptions.push(i.toString())
        }
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 justify-center" role="radiogroup" aria-labelledby="question-text">
              {ratingOptions.map((rating) => (
                <Button
                  key={rating}
                  variant={currentAnswer === rating ? "default" : "outline"}
                  onClick={() => {
                    setCurrentAnswer(rating)
                    if (validationError) setValidationError("")
                  }}
                  className={`w-16 h-16 text-xl font-bold rounded-full transition-all hover:scale-110 border-2 ${
                    currentAnswer === rating
                      ? "bg-primary text-primary-foreground border-primary shadow-lg"
                      : "bg-input hover:bg-muted border-border"
                  }`}
                  role="radio"
                  aria-checked={currentAnswer === rating}
                >
                  {rating}
                </Button>
              ))}
            </div>
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <div className="flex justify-between px-4">
                <span>{scale.min} = Poor</span>
                <span>{scale.max} = Excellent</span>
              </div>
              {currentAnswer && (
                <div className="text-primary font-medium">
                  Selected: {currentAnswer}/{scale.max}
                </div>
              )}
            </div>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "long_text":
        return (
          <div className="space-y-4">
            <div className="relative">
              <Textarea
                placeholder="Example: We need a customer portal to reduce support calls and improve user experience..." // Updated to clearly example text
                className={`text-xl p-6 bg-input border-2 border-border rounded-xl min-h-32 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground ${
                  validationError ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                }`}
                value={currentAnswer}
                onChange={(e) => {
                  setCurrentAnswer(e.target.value)
                  if (validationError) setValidationError("")
                }}
                autoFocus
                aria-describedby={validationError ? "validation-error" : "char-count"}
              />
              <div className="absolute right-4 top-6 flex gap-2">
                <div className="w-3 h-3 bg-primary rounded-full opacity-60"></div>
                <div className="w-3 h-3 bg-primary rounded-full opacity-40"></div>
              </div>
            </div>

            {currentQuestion.suggestedAnswers && currentQuestion.suggestedAnswers.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
                  className="flex items-center gap-2 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  <span>Quick suggestions:</span>
                  {suggestionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    suggestionsExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {currentQuestion.suggestedAnswers.slice(0, 4).map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentAnswer(suggestion)
                          if (validationError) setValidationError("")
                        }}
                        className="text-xs px-3 py-2 h-auto bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-border/30 hover:border-border/60 transition-all duration-200 text-left justify-start whitespace-normal"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              {validationError ? (
                <p
                  id="validation-error"
                  className="text-sm text-destructive animate-in slide-in-from-top-1"
                  role="alert"
                >
                  {validationError}
                </p>
              ) : (
                <div />
              )}
              <p id="char-count" className="text-sm text-muted-foreground" aria-live="polite">
                {currentAnswer.length}/1000 characters
              </p>
            </div>
          </div>
        )
      case "dropdown":
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-labelledby="question-text">
              {currentQuestion.options?.map((option, index) => (
                <Button
                  key={option}
                  variant={currentAnswer === option ? "default" : "outline"}
                  onClick={() => {
                    setCurrentAnswer(option)
                    if (validationError) setValidationError("")
                  }}
                  className={`px-6 py-4 text-lg rounded-full transition-all hover:scale-105 border-2 ${
                    currentAnswer === option
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-input hover:bg-muted border-border"
                  } ${focusedOptionIndex === index ? "ring-2 ring-primary/50" : ""}`}
                  role="radio"
                  aria-checked={currentAnswer === option}
                  aria-label={`${option} (Press Cmd+${index + 1} to select)`}
                >
                  {currentAnswer === option && <CheckCircle className="mr-2 h-5 w-5" />}
                  {option}
                </Button>
              ))}
            </div>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "multiselect":
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3" role="group" aria-labelledby="question-text">
              {currentQuestion.options?.map((option, index) => {
                const isSelected = multiSelectAnswers.includes(option)
                return (
                  <Button
                    key={option}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => {
                      if (isSelected) {
                        setMultiSelectAnswers(multiSelectAnswers.filter((a) => a !== option))
                      } else {
                        setMultiSelectAnswers([...multiSelectAnswers, option])
                      }
                      if (validationError) setValidationError("")
                    }}
                    className={`px-6 py-4 text-lg rounded-full transition-all hover:scale-105 border-2 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-input hover:bg-muted border-border"
                    } ${focusedOptionIndex === index ? "ring-2 ring-primary/50" : ""}`}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`${option} (Press Cmd+${index + 1} to toggle)`}
                  >
                    {isSelected && <CheckCircle className="mr-2 h-5 w-5" />}
                    {option}
                  </Button>
                )
              })}
            </div>

            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "yes_no":
        return (
          <div className="space-y-3">
            <div className="flex gap-4" role="radiogroup" aria-labelledby="question-text">
              <Button
                variant={currentAnswer === "Yes" ? "default" : "outline"}
                onClick={() => {
                  setCurrentAnswer("Yes")
                  if (validationError) setValidationError("")
                }}
                className="flex-1 text-xl p-6 rounded-xl transition-all hover:scale-105 border-2"
                role="radio"
                aria-checked={currentAnswer === "Yes"}
              >
                <CheckCircle className="mr-3 h-6 w-6" />
                Yes
              </Button>
              <Button
                variant={currentAnswer === "No" ? "default" : "outline"}
                onClick={() => {
                  setCurrentAnswer("No")
                  if (validationError) setValidationError("")
                }}
                className="flex-1 text-xl p-6 rounded-xl transition-all hover:scale-105 border-2"
                role="radio"
                aria-checked={currentAnswer === "No"}
              >
                No
              </Button>
            </div>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      case "contact":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="John Smith" // Updated to clearly dummy name
                  value={contactInfo.name}
                  onChange={(e) => {
                    setContactInfo({ ...contactInfo, name: e.target.value })
                    setCurrentAnswer(`${e.target.value}|${contactInfo.email}`)
                    if (validationError) setValidationError("")
                  }}
                  className={`text-xl p-6 bg-input border-2 border-border rounded-xl transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground ${
                    validationError ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                  }`}
                  autoFocus
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 pointer-events-none">
                  <div className="w-3 h-3 bg-primary rounded-full opacity-60"></div>
                  <div className="w-3 h-3 bg-primary rounded-full opacity-40"></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type="email"
                  placeholder="john@company.com" // Updated to clearly dummy email
                  value={contactInfo.email}
                  onChange={(e) => {
                    setContactInfo({ ...contactInfo, email: e.target.value })
                    setCurrentAnswer(`${contactInfo.name}|${e.target.value}`)
                    if (validationError) setValidationError("")
                  }}
                  className={`text-xl p-6 bg-input border-2 border-border rounded-xl transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground ${
                    validationError ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed) {
                      e.preventDefault()
                      handleNext()
                    }
                  }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 pointer-events-none">
                  <div className="w-3 h-3 bg-primary rounded-full opacity-60"></div>
                  <div className="w-3 h-3 bg-primary rounded-full opacity-40"></div>
                </div>
              </div>
            </div>
            {validationError && (
              <p id="validation-error" className="text-sm text-destructive animate-in slide-in-from-top-1" role="alert">
                {validationError}
              </p>
            )}
          </div>
        )
      default:
        return null
    }
  }

  // useEffect(() => {
  //   if (isComplete && !isSubmitting && submissionStatus === "idle") {
  //     handleSubmit()
  //   }
  // }, [isComplete, isSubmitting, submissionStatus])

  if (isComplete && submissionStatus !== "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-2xl w-full p-8 text-center animate-in fade-in-50 slide-in-from-bottom-4">
          <div className="mb-6">
            {submissionStatus === "success" ? (
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            ) : submissionStatus === "error" ? (
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            ) : (
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
            )}
          </div>

          {submissionStatus === "success" ? (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-4 text-balance">Thank you for your submission!</h1>
              <p className="text-lg text-muted-foreground mb-4 text-pretty">{submissionMessage}</p>
              {submissionId && (
                <p className="text-sm text-muted-foreground mb-8">
                  Reference ID: <code className="bg-muted px-2 py-1 rounded font-mono text-xs">{submissionId}</code>
                </p>
              )}
            </>
          ) : submissionStatus === "error" ? (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-4 text-balance">Submission Error</h1>
              <p className="text-lg text-muted-foreground mb-4 text-pretty">{submissionMessage}</p>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isOnline}
                className="text-lg px-8 py-4 bg-primary hover:bg-primary/90 rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Retrying...
                  </>
                ) : (
                  "Try Again"
                )}
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-4 text-balance">Submitting...</h1>
              <p className="text-lg text-muted-foreground mb-8 text-pretty">
                Please wait while we process your submission.
              </p>
            </>
          )}
        </div>

        {/* Header elements */}
        <div className="fixed top-4 left-4 z-50">
          <a
            href="https://automatic.so"
            target="_blank"
            rel="noopener noreferrer"
            className="block opacity-60 hover:opacity-100 transition-opacity"
          >
            <img src="/images/automatic-logo.png" alt="Automatic" className="w-[180px] h-auto object-contain" />
          </a>
        </div>

        <div className="fixed top-4 right-4 z-50 flex items-center gap-6">
          <button
            onClick={() => setShowCloneDialog(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clone with v0
          </button>
          <a
            href="https://x.com/David__Flynn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
            Connect with David
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div
        className="fixed top-0 left-0 h-1 bg-primary transition-all duration-500 ease-out z-50"
        style={{
          width: `${progressPercentage}%`,
        }}
        role="progressbar"
        aria-valuenow={currentStep + 1}
        aria-valuemax={totalQuestions}
        aria-label={`Progress: ${Math.round(progressPercentage)}% complete`}
      />

      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-2xl w-full">
          {!isOnline && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
              <p className="text-sm text-destructive">You're currently offline. Some features may not work properly.</p>
            </div>
          )}

          {apiKeyError && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    AI Question Generation Unavailable
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The Anthropic API key is not configured. AI-generated questions will be replaced with fallback
                    questions. To enable AI features, please add your{" "}
                    <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-xs">ANTHROPIC_API_KEY</code>{" "}
                    environment variable.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-10 mb-8 animate-in fade-in-50 slide-in-from-right-4">
            <div className="space-y-8">
              {isGeneratingQuestion ? (
                <div className="py-16">
                  {streamingQuestion && (streamingQuestion.title || streamingQuestion.description) ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="text-sm text-primary font-medium">AI Question {aiQuestionsGenerated + 1}</div>
                      <div className="space-y-3">
                        {streamingQuestion.title && (
                          <h1 className="text-3xl font-bold text-foreground text-balance">
                            {streamingQuestion.title}
                            <span className="text-primary ml-1">*</span>
                          </h1>
                        )}
                        {streamingQuestion.description && (
                          <p className="text-lg text-muted-foreground leading-relaxed">
                            {streamingQuestion.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-center pt-8">
                        <EnhancedLoading />
                      </div>
                    </div>
                  ) : (
                    <EnhancedLoading />
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="text-sm text-primary font-medium">
                      {currentStep < STATIC_QUESTIONS.length
                        ? "Getting Started"
                        : `AI Question ${aiQuestionsGenerated}`}
                    </div>
                    <div className="space-y-3">
                      <h1 id="question-text" className="text-3xl font-bold text-foreground text-balance">
                        {currentQuestion?.title || currentQuestion?.question}
                        {currentQuestion?.required && <span className="text-primary ml-1">*</span>}
                      </h1>
                      {currentQuestion?.description && currentQuestion.description !== currentQuestion.question && (
                        <p className="text-lg text-muted-foreground text-pretty leading-relaxed">
                          {currentQuestion.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    {renderInput()}

                    <div className="flex justify-between items-center pt-8">
                      <Button
                        onClick={handleBack}
                        variant="ghost"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground px-6 py-3 rounded-xl"
                        disabled={currentStep === 0}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>

                      <Button
                        onClick={handleNext}
                        disabled={!canProceed || isGeneratingQuestion}
                        className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl"
                      >
                        {(currentStep >= STATIC_QUESTIONS.length - 1 && aiQuestionsGenerated >= 8) ||
                        currentStep >= questions.length - 1
                          ? "Submit"
                          : "Next"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="text-center text-sm text-muted-foreground hidden sm:block">
          <p>
            Use <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> to continue or{" "}
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd> to go back
            {(currentQuestion?.inputType === "dropdown" || currentQuestion?.inputType === "multiselect") && (
              <>
                <br />
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd> to navigate options,{" "}
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd+1-9</kbd> for quick selection
              </>
            )}
          </p>
        </div>
      </footer>

      <footer className="fixed top-4 right-4 z-40">
        <div className="flex items-center gap-9">
          <button
            onClick={() => setShowCloneDialog(true)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 opacity-60 hover:opacity-100"
          >
            Clone with v0
          </button>
          <a
            href="https://x.com/David__Flynn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors duration-200 opacity-60 hover:opacity-100 gap-1"
            aria-label="Connect with David on Twitter"
          >
            <XIcon className="w-5 h-5" />
            <span>Connect with David</span>
          </a>
        </div>
      </footer>

      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center mb-2">
              AI-Powered Discovery Form Template
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8 pb-6">
            {/* Hero Section */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm text-primary font-medium">
                <Sparkles className="w-4 h-4" />
                Premium Template
              </div>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Transform client intake with intelligent, adaptive questioning that gets better responses every time.
              </p>
            </div>

            {/* Key Features - Now in a better balanced grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 p-6 rounded-lg bg-muted/50 border border-muted">
                <Zap className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-base mb-2">AI-Generated Questions</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Dynamic follow-up questions based on previous responses using OpenAI GPT-4o-mini with streaming for
                    instant feedback
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-lg bg-muted/50 border border-muted">
                <MessageSquare className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-base mb-2">Streaming Responses</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Lightning-fast question generation with real-time streaming that displays content as it's generated
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-lg bg-muted/50 border border-muted">
                <Palette className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-base mb-2">Modern UI</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Dark theme with smooth animations, pill-style selectors, and full keyboard navigation support
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-lg bg-muted/50 border border-muted">
                <Code className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-base mb-2">Easy Customization</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Simply update AI prompts to match your industry and requirements. No complex setup needed
                  </p>
                </div>
              </div>
            </div>

            {/* Perfect For Section - Better spacing and layout */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-center">Perfect For:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-sm">Software agencies collecting project requirements</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-sm">Marketing consultants qualifying leads</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-sm">Design studios gathering creative briefs</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-sm">Any service business needing detailed client info</span>
                </div>
              </div>
            </div>

            {/* How to Clone - Better visual hierarchy */}
            <div className="space-y-4 p-6 bg-primary/5 rounded-lg border border-primary/20 max-w-4xl mx-auto">
              <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                <Copy className="w-5 h-5" />
                How to Clone & Customize
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm flex items-center justify-center font-medium">
                      1
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">Clone Template</div>
                      <div className="text-muted-foreground">Click "Clone" in v0 to copy to your workspace</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm flex items-center justify-center font-medium">
                      2
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">Update AI Prompts</div>
                      <div className="text-muted-foreground">
                        Customize prompts in <code className="bg-muted px-1 rounded text-xs">lib/ai-prompts.ts</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm flex items-center justify-center font-medium">
                      3
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">Customize Branding</div>
                      <div className="text-muted-foreground">Update questions and styling to match your brand</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm flex items-center justify-center font-medium">
                      4
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">Add API Keys</div>
                      <div className="text-muted-foreground">Configure OpenAI API key and webhook URL</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm flex items-center justify-center font-medium">
                      5
                    </span>
                    <div className="text-sm">
                      <div className="font-medium">Deploy & Launch</div>
                      <div className="text-muted-foreground">Start collecting better client information!</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-6 pt-4">
              <p className="text-lg text-muted-foreground">Ready to 10x your client discovery process?</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => setShowCloneDialog(false)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Clone This Template
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
                  onClick={() => {
                    window.open("https://automatic.so", "_blank")
                    setShowCloneDialog(false)
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Hire Automatic
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Need custom AI tools? Hire Automatic to build your own custom AI solutions
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="fixed top-4 left-4 z-40">
        <a
          href="https://automatic.so"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-60 hover:opacity-100 transition-opacity duration-200"
          aria-label="Visit Automatic.so"
        >
          <img
            src="/images/automatic-logo.png"
            alt="Automatic"
            className="h-auto object-contain hover:scale-105 transition-transform duration-200 w-36"
          />
        </a>
      </footer>
    </div>
  )
}

export { DiscoveryForm }
