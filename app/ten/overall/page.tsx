import { Suspense } from "react"
import OverallClient from "@/components/ten/OverallClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>}>
      <OverallClient />
    </Suspense>
  )
}
