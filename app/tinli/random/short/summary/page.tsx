import { Suspense } from "react"
import RandomFplShortSummaryClient from "@/components/tinli/random/RandomFplShortSummaryClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <RandomFplShortSummaryClient />
    </Suspense>
  )
}

