"use client"
import { useEffect, useMemo, useState } from "react"
import { Button, Space, Tag, Typography } from "antd"
import { useRouter, useSearchParams } from "next/navigation"
type TinliAnswer = { text: string; translation?: string; word?: { word: string; translate: string }[] }
type TinliQuestion = { error_options: string[]; answer: TinliAnswer }
type UnitTinli = {
  new?: { question: TinliQuestion[] }[]
  "further practice in listening"?: { long?: TinliQuestion[]; passage?: TinliQuestion[] }
  "unit test"?: { long?: { question: TinliQuestion[] }[] }
}

export default function RandomFplPassageSummaryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unit = searchParams.get('unit') || ''
  const type = (searchParams.get('type') || 'fpl-passage').toLowerCase()
  const group = searchParams.get('group') || ''
  const key = `tinli_random_long_${type}_${unit}_${group || 'all'}`
  const [data, setData] = useState<Record<string, UnitTinli>>({})
  const progress = useMemo(() => {
    const prev = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    return prev ? JSON.parse(prev) : {}
  }, [key])
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/tinli.json')
      const json = await res.json()
      setData(json)
    }
    load()
  }, [])
  const qs = useMemo(() => {
    const u = data[unit]
    if (!u) return [] as TinliQuestion[]
    if (type === 'new') {
      const idx = group ? parseInt(group, 10) : -1
      const item = (u.new || [])[idx]
      return item ? (item.question || []) : []
    }
    if (type === 'unit-long') {
      const idx = group ? parseInt(group, 10) : -1
      const item = (u["unit test"]?.long || [])[idx]
      return item ? (item.question || []) : []
    }
    if (type === 'fpl-long') return u["further practice in listening"]?.long || []
    return u["further practice in listening"]?.passage || []
  }, [data, unit, type, group])
  const ids = Object.keys(progress).map(k => parseInt(k)).sort((a, b) => a - b)
  const correctCount = ids.reduce((acc, i) => acc + (progress[String(i)]?.correct ? 1 : 0), 0)

  const another = () => {
    localStorage.removeItem(key)
    router.push('/tinli/random/long')
  }
  const retry = () => {
    const gid = group ? `&group=${group}` : ''
    router.push(`/tinli/random/long?type=${type}&unit=${unit}${gid}`)
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <Typography.Title level={4} style={{ textAlign: 'center' }}>随机长题总结</Typography.Title>
      <Typography.Paragraph>作答：{ids.length}，正确：{correctCount}</Typography.Paragraph>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {ids.map((id) => {
          const r = progress[String(id)] || {}
          const tag: { color: string; text: string } = r.correct ? { color: 'green', text: '正确' } : { color: 'red', text: '错误' }
          const q = qs[id - 1]
          return (
            <div key={id} style={{ padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Typography.Text>第{id}题</Typography.Text>
                <Tag color={tag.color}>{tag.text}</Tag>
              </Space>
              {q && (
                <div style={{ marginTop: 8 }}>
                  <Typography.Paragraph>正确答案：{q.answer.text}</Typography.Paragraph>
                  <Typography.Paragraph>{q.answer.translation || ''}</Typography.Paragraph>
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {(q.answer.word || []).map((w, i) => (
                      <Typography.Text key={i}>{w.word} · {w.translate}</Typography.Text>
                    ))}
                  </Space>
                </div>
              )}
            </div>
          )
        })}
      </Space>
      <Space style={{ marginTop: 12 }}>
        <Button type="primary" onClick={another}>再来一篇</Button>
        <Button onClick={retry}>重答一次</Button>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </Space>
    </div>
  )
}
