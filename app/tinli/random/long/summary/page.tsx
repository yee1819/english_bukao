import { Suspense } from "react"
import RandomFplPassageSummaryClient from "@/components/tinli/random/RandomFplPassageSummaryClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <RandomFplPassageSummaryClient />
    </Suspense>
  )
}

