import { DiscoveryForm } from "@/components/discovery-form"
import { ErrorBoundary } from "@/components/error-boundary"

export default function HomePage() {
  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-background">
        <DiscoveryForm />
      </main>
    </ErrorBoundary>
  )
}
