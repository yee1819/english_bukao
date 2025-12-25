"use client"
import { useEffect, useMemo, useState } from "react"
import { Button, Space, Typography, Select } from "antd"

type WordItem = { word: string; translate: string }
type UnitItem = { text: string; translation: string; word?: WordItem[] }

export default function TransfromClient() {
  const [data, setData] = useState<Record<string, UnitItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<string>('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/transfrom.json')
      const json = await res.json()
      setData(json)
      const keys = Object.keys(json).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      setActive(keys[0] || '')
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const detect = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 640)
    detect()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', detect)
      return () => window.removeEventListener('resize', detect)
    }
  }, [])

  const unitKeys = useMemo(() => Object.keys(data).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))), [data])
  const items = useMemo(() => (active ? (data[active] || []) : []), [data, active])

  if (loading) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>

  return (
    <div style={{ padding: isMobile ? 12 : 16, maxWidth: 900, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>翻译展示</Typography.Title>
        <Button onClick={() => window.history.back()}>返回</Button>
      </Space>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Select
          value={active}
          style={{ width: isMobile ? '100%' : 200 }}
          onChange={(v) => setActive(v)}
          options={unitKeys.map(k => ({ value: k, label: k }))}
        />
      </Space>

      <Space orientation="vertical" style={{ width: '100%' }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ padding: isMobile ? 10 : 12, border: '1px solid #eee', borderRadius: 8 }}>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: isMobile ? 14 : 16 }}>{it.text}</Typography.Paragraph>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: isMobile ? 14 : 16, color: '#444' }}>{it.translation}</Typography.Paragraph>
            {it.word && it.word.length > 0 && (
              <Space orientation="vertical" style={{ width: '100%' }}>
                {it.word.map((w, i) => (
                  <Typography.Text key={i} style={{ fontSize: isMobile ? 14 : 16 }}>{w.word} · {w.translate}</Typography.Text>
                ))}
              </Space>
            )}
          </div>
        ))}
      </Space>
    </div>
  )
}
