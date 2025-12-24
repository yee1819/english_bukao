import { Suspense } from "react"
import SummaryClient from "@/components/ten/SummaryClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>}>
      <SummaryClient />
    </Suspense>
  )
}
