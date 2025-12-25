import { Suspense } from "react"
import RandomFplPassageClient from "@/components/tinli/random/RandomFplPassageClient"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>加载中...</div>}>
      <RandomFplPassageClient />
    </Suspense>
  )
}

