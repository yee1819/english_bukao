import { Suspense } from "react"
import PracticeClient from "@/components/yuedu/PracticeClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>}>
      <PracticeClient />
    </Suspense>
  )
}
