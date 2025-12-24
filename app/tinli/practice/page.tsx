import { Suspense } from "react"
import TinliPractice from "@/components/tinli/TinliPractice"

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>}>
      <TinliPractice />
    </Suspense>
  )
}
