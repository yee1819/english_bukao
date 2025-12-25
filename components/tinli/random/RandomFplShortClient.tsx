"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Radio, Space, Typography } from "antd"

type TinliAnswer = { text: string; translation?: string; word?: { word: string; translate: string }[] }
type TinliQuestion = { error_options: string[]; answer: TinliAnswer }

type GlobalShort = { unitKey: string; source: 'fpl' | 'unit'; index: number; q: TinliQuestion }

export default function RandomFplShortClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<GlobalShort[]>([])
  const [idx, setIdx] = useState(1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/tinli.json')
      const json = await res.json()
      const keys = Object.keys(json).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      const arr: GlobalShort[] = []
      for (const k of keys) {
        const shortA = json[k]?.["further practice in listening"]?.short || []
        for (let i = 0; i < shortA.length; i++) arr.push({ unitKey: k, source: 'fpl', index: i, q: shortA[i] })
        const unitShort = json[k]?.["unit test"]?.short || []
        for (let i = 0; i < unitShort.length; i++) arr.push({ unitKey: k, source: 'unit', index: i, q: unitShort[i] })
      }
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      setList(arr)
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

  const q = useMemo(() => list[idx - 1]?.q || null, [list, idx])
  const options = useMemo(() => {
    if (!q) return []
    const base = [q.answer.text, ...(q.error_options || [])]
    let seed = 0
    const s = base.join("|")
    for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) | 0
    const rnd = (function (t: number) {
      return function () {
        t += 0x6D2B79F5
        let x = Math.imul(t ^ (t >>> 15), t | 1)
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296
      }
    })(seed)
    const arr = [...base]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.map((t, i) => ({ key: String(i + 1), text: t }))
  }, [q])
  const chosen = useMemo(() => options.find(o => o.key === selectedKey)?.text, [options, selectedKey])
  const isCorrect = selectedKey ? chosen === q?.answer.text : null

  const saveProgress = (i: number, sel: string | null, correct: boolean | null) => {
    const key = `tinli_random_fpl_short`
    const prev = localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    const meta = list[i - 1] ? { unitKey: list[i - 1].unitKey, source: list[i - 1].source, index: list[i - 1].index } : null
    obj[String(i)] = { selected: sel, correct, meta }
    localStorage.setItem(key, JSON.stringify(obj))
  }

  const onSelect = (val: string) => {
    setSelectedKey(val)
    setConfirmed(false)
    const nowCorrect = options.find(o => o.key === val)?.text === q?.answer.text
    saveProgress(idx, val, (nowCorrect ?? null))
  }

  const onConfirm = () => {
    if (!selectedKey) return
    const nowCorrect = chosen === q?.answer.text
    saveProgress(idx, selectedKey, nowCorrect)
    setConfirmed(true)
  }

  const goNext = () => {
    if (!selectedKey) saveProgress(idx, null, false)
    setSelectedKey(null)
    setConfirmed(false)
    const nextId = idx + 1
    if (nextId <= (list.length || 1)) setIdx(nextId)
    else router.push('/tinli/random/short/summary')
  }

  const endNow = () => {
    if (!selectedKey) saveProgress(idx, null, false)
    router.push('/tinli/random/short/summary')
  }

  if (loading) return <div style={{ padding: 16 }}>加载中...</div>
  if (!q) return <div style={{ padding: 16 }}>暂无数据</div>

  return (
    <div style={{ padding: isMobile ? 12 : 16, maxWidth: 720, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Text style={{ fontSize: isMobile ? 14 : 16 }}>随机短题 · 第{idx}题 / {list.length}</Typography.Text>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </Space>

      <Radio.Group style={{ width: '100%' }} value={selectedKey} onChange={(e) => onSelect(e.target.value)}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          {options.map(op => (
            <Radio key={op.key} value={op.key} style={{ whiteSpace: 'normal', lineHeight: isMobile ? 1.5 : 1.6, padding: isMobile ? 6 : 4 }}>{op.text}</Radio>
          ))}
        </Space>
      </Radio.Group>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Button type="primary" size={isMobile ? 'small' : 'middle'} disabled={!selectedKey} onClick={onConfirm} style={{ flex: isMobile ? '1 1 100%' : undefined }}>查看是否正确</Button>
        <Button size={isMobile ? 'small' : 'middle'} onClick={goNext} style={{ flex: isMobile ? '1 1 48%' : undefined }}>下一题</Button>
        <Button size={isMobile ? 'small' : 'middle'} onClick={endNow} style={{ flex: isMobile ? '1 1 48%' : undefined }}>结束并总结</Button>
      </div>

      {confirmed && isCorrect !== null && (
        <Alert style={{ marginTop: 12 }} type={isCorrect ? 'success' : 'error'} title={isCorrect ? '回答正确' : '回答错误'} />
      )}
    </div>
  )
}
