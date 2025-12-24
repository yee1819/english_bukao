import { Suspense } from "react"
import SummaryClient from "@/components/yuedu/SummaryClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <SummaryClient />
    </Suspense>
  )
}
