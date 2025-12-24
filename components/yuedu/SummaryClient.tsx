"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Space, Tag, Typography } from "antd"

type QA = {
  title: string
}

export default function SummaryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unit = searchParams.get('key') || ''
  const [data, setData] = useState<Record<string, Record<string, QA>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/yuedu.json')
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  const progress = useMemo(() => {
    const key = `yuedu_progress_${unit}`
    const prev = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    return prev ? JSON.parse(prev) : {}
  }, [unit, loading])

  const u = data[unit] || {}
  const ids = Object.keys(u).sort((a, b) => parseInt(a) - parseInt(b))

  const resetAndRestart = () => {
    localStorage.removeItem(`yuedu_progress_${unit}`)
    router.push(`/yuedu/practice?key=${unit}&qid=${ids[0] || '1'}`)
  }

  const goNextUnit = () => {
    const ks = Object.keys(data)
    const sorted = ks.sort((a, b) => {
      const pa = a.match(/u(\d+)t(\d+)/)
      const pb = b.match(/u(\d+)t(\d+)/)
      if (!pa || !pb) return a.localeCompare(b)
      const ua = parseInt(pa[1], 10), ta = parseInt(pa[2], 10)
      const ub = parseInt(pb[1], 10), tb = parseInt(pb[2], 10)
      if (ua === ub) return ta - tb
      return ua - ub
    })
    const idx = sorted.indexOf(unit)
    const nextKey = sorted[idx + 1] || sorted[0]
    const nextIds = Object.keys(data[nextKey] || {}).sort((a, b) => parseInt(a) - parseInt(b))
    router.push(`/yuedu/practice?key=${nextKey}&qid=${nextIds[0] || '1'}`)
  }

  if (!unit) return <div style={{ padding: 16 }}>缺少参数 key</div>
  if (loading) return <div style={{ padding: 16 }}>加载中...</div>

  return (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4}>总结</Typography.Title>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {ids.map((id) => {
          const r = progress[id]
          const st = r
            ? (typeof r.correct === 'boolean'
              ? (r.correct ? 'correct' : 'wrong')
              : (r.selected ? 'unconfirmed' : 'unanswered'))
            : 'unanswered'
          const tag = st === 'correct' ? { color: 'green', text: '正确' }
            : st === 'wrong' ? { color: 'red', text: '错误' }
              : st === 'unconfirmed' ? { color: 'gold', text: '未确认' }
                : { color: 'default', text: '未作答' }
          return (
            <Space key={id} style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Typography.Text style={{ fontSize: 16 }}>{u[id]?.title || `第${id}题`}</Typography.Text>
                <Tag color={tag.color as any} style={{ fontSize: 16 }}>{tag.text}</Tag>
              </Space>
              <Button onClick={() => router.push(`/yuedu/practice?key=${unit}&qid=${id}`)}>查看</Button>
            </Space>
          )
        })}
      </Space>
      <Space>
        <Button type="primary" onClick={resetAndRestart}>再来一次</Button>
        <Button onClick={goNextUnit}>下一篇</Button>
        <Button onClick={() => router.push('/')}>返回</Button>
      </Space>
    </div>
  )
}

