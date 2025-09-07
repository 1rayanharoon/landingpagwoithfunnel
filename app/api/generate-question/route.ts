import { type NextRequest, NextResponse } from "next/server"
import { streamObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { DISCOVERY_SYSTEM_PROMPT, createDiscoveryPrompt } from "@/lib/ai-prompts"

interface Response {
  question: string
  answer: string
}

interface GenerateQuestionRequest {
  responses: Response[]
  aiQuestionsGenerated: number
  maxAiQuestions?: number // Made optional since AI will determine completion
}

const questionSchema = z.object({
  title: z.string().describe("A short, concise question title (3-8 words max)"),
  description: z.string().describe("A clear, detailed explanation of what you're asking and why"),
  inputType: z
    .enum(["text", "long_text", "yes_no", "dropdown", "multiselect", "date", "number", "rating", "email", "url"])
    .describe("The type of input field for this question"),
  options: z.array(z.string()).optional().describe("Options for dropdown or multiselect questions"),
  suggestedAnswers: z
    .array(z.string())
    .optional()
    .describe("2-3 example responses for long_text inputs to help users get started"),
  complete: z
    .boolean()
    .describe(
      "Whether you have enough information to provide a comprehensive project scope and should end the discovery process",
    ),
})

export async function POST(request: NextRequest) {
  try {
    const { responses, aiQuestionsGenerated = 0 }: GenerateQuestionRequest = await request.json()

    if (aiQuestionsGenerated >= 8) {
      return NextResponse.json({ complete: true })
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is missing. Please add OPENAI_API_KEY to your environment variables.")
      return NextResponse.json({ complete: true })
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

    const existingQuestions = responses.map((r) => r.question.toLowerCase())

    const result = await streamObject({
      model: openai(model),
      system: DISCOVERY_SYSTEM_PROMPT,
      prompt: createDiscoveryPrompt(responses, aiQuestionsGenerated, 8),
      schema: questionSchema,
      temperature: 0.7,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const partialObject of result.partialObjectStream) {
            const chunk = `data: ${JSON.stringify(partialObject)}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }

          const finalObject = await result.object

          if (finalObject.complete || aiQuestionsGenerated >= 7) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true })}\n\n`))
          } else if (!finalObject.title || !finalObject.description || !finalObject.inputType) {
            console.error("Invalid AI response structure:", finalObject)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ complete: true })}\n\n`))
          } else {
            const response = {
              title: finalObject.title,
              description: finalObject.description,
              inputType: finalObject.inputType,
              options: finalObject.options,
              suggestedAnswers: finalObject.suggestedAnswers,
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`))
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (error) {
          console.error("Streaming error:", error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error generating question:", error)

    const { aiQuestionsGenerated = 0 } = await request.json().catch(() => ({}))

    const contextualFallbacks = [
      {
        title: "Budget Range",
        description:
          "What's your estimated budget range for this project? This helps us recommend the right approach and timeline.",
        inputType: "dropdown",
        options: ["Under $5k", "$5k - $15k", "$15k - $30k", "$30k - $75k", "$75k+", "Let's discuss"],
      },
      {
        title: "Company Information",
        description:
          "Tell us about your company or organization. What industry are you in and what's your company size?",
        inputType: "long_text",
        suggestedAnswers: [
          "We're a 50-person marketing agency specializing in B2B SaaS companies",
          "Small e-commerce business selling handmade jewelry with 5 employees",
          "Healthcare startup developing patient management solutions",
        ],
      },
      {
        title: "Current Website",
        description: "Do you have an existing website or system we should know about?",
        inputType: "url",
      },
      {
        title: "Success Metrics",
        description: "How will you measure the success of this project? What are your key goals?",
        inputType: "long_text",
        suggestedAnswers: [
          "Reduce manual work by 80% and save 10 hours per week for our team",
          "Increase customer satisfaction scores and reduce support tickets by 50%",
          "Generate $50k in additional revenue within 6 months of launch",
        ],
      },
      {
        title: "Technical Requirements",
        description:
          "Do you have any specific technical requirements, integrations, or constraints we should consider?",
        inputType: "long_text",
        suggestedAnswers: [
          "Must integrate with our existing Salesforce CRM and Stripe payments",
          "Need mobile-responsive design and work on tablets for field staff",
          "Requires HIPAA compliance and secure data handling for patient information",
        ],
      },
    ]

    if (aiQuestionsGenerated >= 7) {
      return NextResponse.json({ complete: true })
    }

    const fallbackIndex = Math.min(aiQuestionsGenerated, contextualFallbacks.length - 1)
    if (fallbackIndex >= 0 && fallbackIndex < contextualFallbacks.length) {
      return NextResponse.json(contextualFallbacks[fallbackIndex])
    }

    return NextResponse.json({ complete: true })
  }
}
