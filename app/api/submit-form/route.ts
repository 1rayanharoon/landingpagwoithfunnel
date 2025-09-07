import { type NextRequest, NextResponse } from "next/server"

interface Response {
  question: string
  answer: string
}

interface SubmitFormRequest {
  timestamp: string
  goal: string
  responses: Response[]
}

interface WebhookPayload extends SubmitFormRequest {
  metadata: {
    userAgent: string
    ip?: string
    formVersion: string
    submissionId: string
  }
}

async function submitToWebhook(payload: WebhookPayload, retries = 3): Promise<boolean> {
  const webhookUrl = process.env.WEBHOOK_URL

  if (!webhookUrl) {
    console.warn("No webhook URL configured. Form data will be logged only.")
    console.log("Form submission data:", JSON.stringify(payload, null, 2))
    return true // Consider it successful for demo purposes
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000), // Increased timeout to 15 seconds
      })

      if (response.ok) {
        console.log(`Webhook submission successful on attempt ${attempt}`)
        return true
      } else {
        const errorText = await response.text().catch(() => "Unable to read response")
        console.error(`Webhook submission failed (attempt ${attempt}): ${response.status} ${response.statusText}`)
        console.error(`Response body: ${errorText}`)

        if (response.status >= 400 && response.status < 500) {
          console.error("Client error detected, not retrying")
          return false
        }
      }
    } catch (error) {
      console.error(`Webhook submission error (attempt ${attempt}):`, error)

      if (attempt === retries) {
        console.error("All webhook submission attempts failed")
        return false
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  return false
}

function generateSubmissionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitFormRequest = await request.json()

    if (!body.responses || !Array.isArray(body.responses) || body.responses.length === 0) {
      return NextResponse.json({ error: "Invalid submission: No responses provided" }, { status: 400 })
    }

    const submissionId = generateSubmissionId()
    const webhookPayload: WebhookPayload = {
      timestamp: body.timestamp,
      goal: body.goal,
      responses: body.responses,
      metadata: {
        userAgent: request.headers.get("user-agent") || "unknown",
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        formVersion: "1.0.0",
        submissionId,
      },
    }

    console.log("Sending webhook payload:", JSON.stringify(webhookPayload, null, 2))

    const success = await submitToWebhook(webhookPayload)

    if (success) {
      return NextResponse.json({
        success: true,
        submissionId,
        message: "Form submitted successfully",
      })
    } else {
      console.error("Webhook submission failed after all retries. Data:", JSON.stringify(webhookPayload, null, 2))

      return NextResponse.json(
        {
          error: "Submission failed",
          submissionId,
          message:
            "We're experiencing technical difficulties. Your information has been saved and we'll contact you soon.",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Form submission error:", error)

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred. Please try again or contact support.",
      },
      { status: 500 },
    )
  }
}
