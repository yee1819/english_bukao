import { Suspense } from "react"
import IndexClient from "@/components/yuedu/IndexClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <IndexClient />
    </Suspense>
  )
}
