import { Suspense } from "react"
import RandomFplShortClient from "@/components/tinli/random/RandomFplShortClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <RandomFplShortClient />
    </Suspense>
  )
}

