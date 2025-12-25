"use client"
import { useEffect, useMemo, useState } from "react"
import { Button, Space, Tag, Typography } from "antd"
import { useRouter } from "next/navigation"
type TinliAnswer = { text: string; translation?: string; word?: { word: string; translate: string }[] }
type TinliQuestion = { error_options: string[]; answer: TinliAnswer }
type UnitTinli = {
  "further practice in listening"?: { short?: TinliQuestion[] }
  "unit test"?: { short?: TinliQuestion[] }
}

export default function RandomFplShortSummaryClient() {
  const router = useRouter()
  const [data, setData] = useState<Record<string, UnitTinli>>({})
  const progress = useMemo(() => {
    const prev = typeof window !== 'undefined' ? localStorage.getItem('tinli_random_fpl_short') : null
    return prev ? JSON.parse(prev) : {}
  }, [])
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/tinli.json')
      const json = await res.json()
      setData(json)
    }
    load()
  }, [])

  const ids = Object.keys(progress).map(k => parseInt(k)).sort((a, b) => a - b)
  const correctCount = ids.reduce((acc, i) => acc + (progress[String(i)]?.correct ? 1 : 0), 0)

  const restart = () => {
    localStorage.removeItem('tinli_random_fpl_short')
    router.push('/tinli/random/short')
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <Typography.Title level={4} style={{ textAlign: 'center' }}>随机短题总结</Typography.Title>
      <Typography.Paragraph>作答：{ids.length}，正确：{correctCount}</Typography.Paragraph>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {ids.map((id) => {
          const r = progress[String(id)] || {}
          const tag: { color: string; text: string } = r.correct ? { color: 'green', text: '正确' } : { color: 'red', text: '错误' }
          const meta = r.meta as { unitKey: string; source: 'fpl' | 'unit'; index: number } | null
          const unit = meta ? data[meta.unitKey] : undefined
          const q = meta ? (meta.source === 'fpl' ? (unit?.["further practice in listening"]?.short?.[meta.index]) : (unit?.["unit test"]?.short?.[meta.index])) : undefined
          return (
            <div key={id} style={{ padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Typography.Text>第{id}题 · {meta?.unitKey} · {meta?.source === 'fpl' ? 'FPL短题' : '测验短题'}</Typography.Text>
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
        <Button type="primary" onClick={restart}>再来一次</Button>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </Space>
    </div>
  )
}
