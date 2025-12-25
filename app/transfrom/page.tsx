import { Suspense } from "react"
import TransfromClient from "@/components/transfrom/TransfromClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>}>
      <TransfromClient />
    </Suspense>
  )
}
