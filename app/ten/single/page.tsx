"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Button, FloatButton, Modal, Space, Typography, Switch } from "antd"

type AnswerItem = {
  word: string
  word_translation?: string
  description?: string
  long_question: string
  long_sentence: string
  long_translation: string
  short_sentence: string
  short_translation: string
}

type UnitData = {
  question: string
  text: string
  translation: string
  options: string[]
  answer: AnswerItem[]
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unit = searchParams.get('key') || ''
  const qid = searchParams.get('qid') || '1'
  const idx = parseInt(qid, 10) || 1
  const [data, setData] = useState<Record<string, UnitData>>({})
  const [loading, setLoading] = useState(true)
  const [uiSelection, setUiSelection] = useState<{ idx: number; value: string | null }>({ idx, value: null })
  const [confirmed, setConfirmed] = useState(false)
  const [cols, setCols] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024
    if (w < 360) return 1
    if (w < 480) return 2
    return 3
  })
  const [showTrans, setShowTrans] = useState(false)
  const [ephemeral, setEphemeral] = useState(false)
  const renderBrackets = (s: string) => {
    const parts = (s || '').split(/(【[^】]+】)/g)
    return parts.map((p, i) => {
      if (/^【[^】]+】$/.test(p)) return <Typography.Text key={i} style={{ color: 'red', fontWeight: 700 }}>{p}</Typography.Text>
      return <Typography.Text key={i}>{p}</Typography.Text>
    })
  }

  const hashString = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
    return h >>> 0
  }

  const mulberry32 = (a: number) => {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const shuffleDeterministic = (arr: string[], seed: string) => {
    const a = [...arr]
    const rng = mulberry32(hashString(seed))
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp
    }
    return a
  }

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/15xuan10.json')
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (unit) localStorage.setItem('ten_last_key', unit)
  }, [unit])

  const unitData: UnitData | undefined = data[unit]
  const answerItem: AnswerItem | undefined = unitData?.answer[idx - 1]
  const correctWord = useMemo(() => {
    const fromAnswer = (answerItem?.word || '').toLowerCase()
    if (fromAnswer) return fromAnswer
    const text = unitData?.text || ''
    const matches = [...text.matchAll(/【([^】]+)】/g)]
    return (matches[idx - 1]?.[1] || '').toLowerCase()
  }, [unitData, idx, answerItem])

  const optionList = useMemo(() => {
    const ops = unitData?.options ? [...unitData.options] : []
    return shuffleDeterministic(ops, `${unit}-${idx}`)
  }, [unitData, unit, idx])

  const prevRecord = useMemo(() => {
    if (ephemeral) return null
    const key = `ten_single_${unit}`
    const prev = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (!prev) return null
    try {
      const obj = JSON.parse(prev)
      return obj[String(idx)] || null
    } catch {
      return null
    }
  }, [unit, idx, ephemeral])

  const currentSelected = (uiSelection.idx === idx ? uiSelection.value : null) ?? (prevRecord ? (prevRecord.selected ?? null) : null)
  const currentConfirmed = confirmed || (prevRecord ? typeof prevRecord.correct === 'boolean' : false)
  const isCorrect = currentSelected ? (correctWord ? currentSelected.toLowerCase() === correctWord : null) : null



  const saveProgress = (val: string | null, correct?: boolean) => {
    if (ephemeral) return
    const key = `ten_single_${unit}`
    const prev = localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    obj[String(idx)] = correct === undefined ? { selected: val } : { selected: val, correct }
    localStorage.setItem(key, JSON.stringify(obj))
  }

  useEffect(() => {
    const updateCols = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024
      if (w < 360) setCols(1)
      else if (w < 480) setCols(2)
      else setCols(3)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateCols)
      return () => window.removeEventListener('resize', updateCols)
    }
  }, [])

  const onConfirm = () => {
    if (!unitData) return
    const key = `ten_single_${unit}`
    const prev = ephemeral ? null : localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    if (!correctWord) {
      if (!ephemeral) {
        obj[String(idx)] = { selected: currentSelected }
        localStorage.setItem(key, JSON.stringify(obj))
      }
      setConfirmed(true)
      return
    }
    if (!ephemeral) {
      obj[String(idx)] = { selected: currentSelected, correct: (currentSelected || '').toLowerCase() === correctWord }
      localStorage.setItem(key, JSON.stringify(obj))
    }
    setConfirmed(true)
  }

  const goNext = () => {
    setUiSelection({ idx, value: null })
    setConfirmed(false)
    const nextId = idx + 1
    if (nextId <= (unitData?.answer.length || 10)) router.push(`/ten/single?key=${unit}&qid=${nextId}`)
    else router.push(`/ten/summary?key=${unit}&mode=single`)
  }

  const goPrev = () => {
    setUiSelection({ idx, value: null })
    setConfirmed(false)
    const prevId = idx - 1
    if (prevId >= 1) router.push(`/ten/single?key=${unit}&qid=${prevId}`)
  }



  if (!unit || !qid) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>缺少参数 key 或 qid</div>
  if (loading || !unitData || !answerItem) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>

  return (
    <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Space>
            <Switch checked={ephemeral} onChange={setEphemeral} />
            <Typography.Text>无痕刷题</Typography.Text>
          </Space>
          <Button onClick={() => { const key = `ten_single_${unit}`; localStorage.removeItem(key); setUiSelection({ idx, value: null }); setConfirmed(false) }}>清空本单元记录</Button>
        </Space>
        <Space style={{ width: '90%', justifyContent: 'center', marginBottom: 12 }}>
          {Array.from({ length: unitData.answer.length }, (_, i) => i + 1).map((id) => (
            <Typography.Text key={id} style={{ fontWeight: id === idx ? 600 : 400 }}>{id}</Typography.Text>
          ))}
        </Space>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>十五选十（单题） - {unit} 第{idx}题</Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center' }}>{renderBrackets(answerItem.long_question || '')}</Typography.Paragraph>

        <Space orientation="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
            {optionList.map(op => (
              <Button
                key={op}
                type={currentSelected === op ? 'primary' : 'default'}
                onClick={() => {
                  setUiSelection({ idx, value: op })
                  setConfirmed(false)
                  const ok = correctWord ? op.toLowerCase() === correctWord : undefined
                  saveProgress(op, ok as any)
                }}
              >
                {op}
              </Button>
            ))}
          </div>

          {currentConfirmed && currentSelected && isCorrect !== null && (
            <Alert type={isCorrect ? 'success' : 'error'} title={isCorrect ? '回答正确' : '回答错误'} showIcon />
          )}

          <Space>
            <Button disabled={idx <= 1} onClick={goPrev}>上一题</Button>
            <Button type="primary" disabled={!currentSelected} onClick={onConfirm}>查看答案是否正确</Button>
            <Button onClick={goNext}>下一题</Button>
            <Button onClick={() => router.push('/ten')}>返回</Button>
          </Space>
        </Space>

        <FloatButton.Group shape="square" style={{ right: 24 }}>
          <FloatButton content="翻译" onClick={() => setShowTrans(true)} />
        </FloatButton.Group>

        <Modal open={showTrans} onCancel={() => setShowTrans(false)} footer={null} title="原文与翻译">
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              <Typography.Text>{answerItem.word}</Typography.Text>
              <Typography.Text style={{ marginLeft: 8, color: '#555' }}>{answerItem.word_translation || ''}</Typography.Text>
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              {renderBrackets(answerItem.long_sentence || '')}
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              <Typography.Text>{answerItem.long_translation}</Typography.Text>
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              {renderBrackets(answerItem.short_sentence || '')}
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              <Typography.Text>{answerItem.short_translation}</Typography.Text>
            </div>
            {answerItem.description !== undefined && (
              <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
                <Typography.Text style={{ color: '#555' }}>{answerItem.description}</Typography.Text>
              </div>
            )}
          </Space>
        </Modal>
      </div>
    </div>
  )
}
