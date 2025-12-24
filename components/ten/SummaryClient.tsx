"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Space, Tag, Typography } from "antd"

export default function SummaryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unit = searchParams.get('key') || ''
  const mode = (searchParams.get('mode') || 'overall') as 'overall' | 'single'
  const [count, setCount] = useState<number>(10)
  const [loading, setLoading] = useState(true)
  const [keys, setKeys] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/15xuan10.json')
      const json = await res.json()
      setCount((json[unit]?.answer?.length) || 10)
      const ks = Object.keys(json).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      setKeys(ks)
      setLoading(false)
    }
    load()
  }, [unit])

  const progress = useMemo(() => {
    const key = `ten_${mode}_${unit}`
    const prev = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    return prev ? JSON.parse(prev) : {}
  }, [unit, mode])

  const ids = Array.from({ length: count }, (_, i) => i + 1)
  const [hoverId, setHoverId] = useState<number | null>(null)

  const resetAndRestart = () => {
    localStorage.removeItem(`ten_${mode}_${unit}`)
    if (mode === 'overall') router.push(`/ten/overall?key=${unit}`)
    else router.push(`/ten/single?key=${unit}&qid=1`)
  }

  const goNextUnit = () => {
    const idx = keys.indexOf(unit)
    const nextKey = keys[idx + 1] || keys[0]
    if (mode === 'overall') router.push(`/ten/overall?key=${nextKey}`)
    else router.push(`/ten/single?key=${nextKey}&qid=1`)
  }

  if (!unit) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>缺少参数 key</div>
  if (loading) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>

  return (
    <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>十五选十总结 - {unit}（{mode === 'overall' ? '整体' : '单题'}）</Typography.Title>
        <Space orientation="vertical" style={{ width: '100%' }}>
          {ids.map((id) => {
            const r = progress[String(id)]
            const st = r
              ? (typeof r.correct === 'boolean'
                ? (r.correct ? 'correct' : 'wrong')
                : (r.selected ? 'unconfirmed' : 'unanswered'))
              : 'unanswered'
            const tag = st === 'correct' ? { color: 'green', text: '正确' }
              : st === 'wrong' ? { color: 'red', text: '错误' }
                : st === 'unconfirmed' ? { color: 'gold', text: '未确认' }
                  : { color: 'default', text: '未作答' }
            const hovered = hoverId === id
            const bg = hovered ? (st === 'wrong' ? '#fff1f0' : '#f5f5f5') : 'transparent'
            return (
              <Space
                key={id}
                style={{ width: '100%', justifyContent: 'space-between', backgroundColor: bg, borderRadius: 6, padding: 8 }}
                onMouseEnter={() => setHoverId(id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <Space>
                  <Typography.Text>第{id}题</Typography.Text>
                  <Tag color={tag.color as any}>{tag.text}</Tag>
                </Space>
                <Button onClick={() => mode === 'overall' ? router.push(`/ten/overall?key=${unit}`) : router.push(`/ten/single?key=${unit}&qid=${id}`)}>查看</Button>
              </Space>
            )
          })}
        </Space>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={resetAndRestart}>再来一次</Button>
          <Button onClick={goNextUnit}>下一篇</Button>
          <Button onClick={() => router.push('/')}>返回</Button>
        </Space>
      </div>
    </div>
  )
}

