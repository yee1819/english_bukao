"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Space, Typography } from "antd"

export default function IndexClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [keys, setKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data/yuedu.json')
        const json = await res.json()
        const ks = Object.keys(json)
        const sorted = ks.sort((a, b) => {
          const pa = a.match(/u(\d+)t(\d+)/)
          const pb = b.match(/u(\d+)t(\d+)/)
          if (!pa || !pb) return a.localeCompare(b)
          const ua = parseInt(pa[1], 10), ta = parseInt(pa[2], 10)
          const ub = parseInt(pb[1], 10), tb = parseInt(pb[2], 10)
          if (ua === ub) return ta - tb
          return ua - ub
        })
        setKeys(sorted)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!loading && keys.length) {
      const mode = searchParams.get('mode')
      const key = searchParams.get('key')
      if (key) {
        router.replace(`/yuedu/practice?key=${key}&qid=1`)
        return
      }
      if (mode === 'random') {
        const idx = Math.floor(Math.random() * keys.length)
        router.replace(`/yuedu/practice?key=${keys[idx]}&qid=1`)
        return
      }
      if (mode === 'sequence') {
        const last = typeof window !== 'undefined' ? localStorage.getItem('yuedu_last_key') : null
        const nextIdx = last ? Math.max(0, Math.min(keys.length - 1, keys.indexOf(last) + 1)) : 0
        const nextKey = keys[nextIdx] || keys[0]
        router.replace(`/yuedu/practice?key=${nextKey}&qid=1`)
      }
    }
  }, [loading, keys, searchParams, router])

  if (loading) return <div>加载中...</div>

  return (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4}>请选择单元开始练习</Typography.Title>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {keys.map((k) => (
          <Space key={k} style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text>{k}</Typography.Text>
            <Button onClick={() => router.push(`/yuedu/practice?key=${k}&qid=1`)}>开始</Button>
          </Space>
        ))}
      </Space>
    </div>
  )
}

