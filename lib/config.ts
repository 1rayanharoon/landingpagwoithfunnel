export const WEBHOOK_CONFIG = {
  // Default webhook URL - can be overridden by environment variables
  defaultUrl: "https://hooks.automatic.so/discovery-capture",

  // Retry configuration
  maxRetries: 3,
  timeoutMs: 10000,

  // Form configuration
  maxQuestions: 8,
  formVersion: "1.0.0",
} as const

export function getWebhookUrl(): string | null {
  return process.env.WEBHOOK_URL || process.env.NEXT_PUBLIC_WEBHOOK_URL || WEBHOOK_CONFIG.defaultUrl
}
