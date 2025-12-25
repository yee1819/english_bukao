"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Button, Radio, Space, Typography } from "antd"

type TinliAnswer = { text: string; translation?: string; word?: { word: string; translate: string }[] }
type TinliQuestion = { error_options: string[]; answer: TinliAnswer }
 
 

type GroupNode = { unitKey: string; type: 'fpl-passage' | 'fpl-long' | 'unit-long' | 'new'; index?: number; questions: TinliQuestion[] }

export default function RandomFplPassageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [node, setNode] = useState<GroupNode | null>(null)
  const [qid, setQid] = useState(1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/tinli.json')
      const json = await res.json()
      const unit = searchParams.get('unit') || ''
      const type = (searchParams.get('type') || '').toLowerCase() as GroupNode['type']
      const group = searchParams.get('group')
      if (unit) {
        const u = json[unit]
        if (type === 'new' && group) {
          const idx = parseInt(group, 10)
          const item = (u?.new || [])[idx]
          if (item) setNode({ unitKey: unit, type: 'new', index: idx, questions: item.question || [] })
        } else if (type === 'unit-long' && group) {
          const idx = parseInt(group, 10)
          const item = (u?.["unit test"]?.long || [])[idx]
          if (item) setNode({ unitKey: unit, type: 'unit-long', index: idx, questions: item.question || [] })
        } else if (type === 'fpl-long') {
          const qs = u?.["further practice in listening"]?.long || []
          if (qs.length) setNode({ unitKey: unit, type: 'fpl-long', questions: qs })
        } else {
          const qs = u?.["further practice in listening"]?.passage || []
          if (qs.length) setNode({ unitKey: unit, type: 'fpl-passage', questions: qs })
        }
      } else {
        const keys = Object.keys(json).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
        const pool: GroupNode[] = []
        for (const k of keys) {
          const u = json[k]
          const newGroups = u?.new || []
          for (let i = 0; i < newGroups.length; i++) {
            const g = newGroups[i]
            const qs = g?.question || []
            if (qs.length) pool.push({ unitKey: k, type: 'new', index: i, questions: qs })
          }
          const unitLong = u?.["unit test"]?.long || []
          for (let i = 0; i < unitLong.length; i++) {
            const g = unitLong[i]
            const qs = g?.question || []
            if (qs.length) pool.push({ unitKey: k, type: 'unit-long', index: i, questions: qs })
          }
          const fplPassage = u?.["further practice in listening"]?.passage || []
          if (fplPassage.length) pool.push({ unitKey: k, type: 'fpl-passage', questions: fplPassage })
          const fplLong = u?.["further practice in listening"]?.long || []
          if (fplLong.length) pool.push({ unitKey: k, type: 'fpl-long', questions: fplLong })
        }
        const pick = pool[Math.floor(Math.random() * pool.length)] || null
        setNode(pick)
      }
      setLoading(false)
    }
    load()
  }, [searchParams])

  useEffect(() => {
    const detect = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 640)
    detect()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', detect)
      return () => window.removeEventListener('resize', detect)
    }
  }, [])

  const q = useMemo(() => node?.questions[qid - 1] || null, [node, qid])
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

  const progressKey = useMemo(() => {
    if (!node) return ''
    const gid = typeof node.index === 'number' ? String(node.index) : 'all'
    return `tinli_random_long_${node.type}_${node.unitKey}_${gid}`
  }, [node])
  const saveProgress = (i: number, sel: string | null, correct: boolean | null) => {
    if (!progressKey) return
    const prev = localStorage.getItem(progressKey)
    const obj = prev ? JSON.parse(prev) : {}
    obj[String(i)] = { selected: sel, correct }
    localStorage.setItem(progressKey, JSON.stringify(obj))
  }

  const onSelect = (val: string) => {
    setSelectedKey(val)
    setConfirmed(false)
    const nowCorrect = options.find(o => o.key === val)?.text === q?.answer.text
    saveProgress(qid, val, (nowCorrect ?? null))
  }

  const onConfirm = () => {
    if (!selectedKey) return
    const nowCorrect = chosen === q?.answer.text
    saveProgress(qid, selectedKey, nowCorrect)
    setConfirmed(true)
  }

  const goNext = () => {
    if (!selectedKey) saveProgress(qid, null, false)
    setSelectedKey(null)
    setConfirmed(false)
    const nextId = qid + 1
    if (node && nextId <= node.questions.length) setQid(nextId)
    else if (node) {
      const gid = typeof node.index === 'number' ? `&group=${node.index}` : ''
      router.push(`/tinli/random/long/summary?type=${node.type}&unit=${node.unitKey}${gid}`)
    }
  }

  if (loading) return <div style={{ padding: 16 }}>加载中...</div>
  if (!node || !q) return <div style={{ padding: 16 }}>暂无数据</div>

  return (
    <div style={{ padding: isMobile ? 12 : 16, maxWidth: 720, margin: '0 auto' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Text style={{ fontSize: isMobile ? 14 : 16 }}>随机长题 · {node.type} · {node.unitKey} · 第{qid}题 / {node.questions.length}</Typography.Text>
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
      </div>

      {confirmed && isCorrect !== null && (
        <Alert style={{ marginTop: 12 }} type={isCorrect ? 'success' : 'error'} title={isCorrect ? '回答正确' : '回答错误'} />
      )}
    </div>
  )
}
