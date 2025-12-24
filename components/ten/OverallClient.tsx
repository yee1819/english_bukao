"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Modal, Space, Tag, Typography, Select, Switch } from "antd"

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

export default function OverallClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unit = searchParams.get('key') || ''
  const [data, setData] = useState<Record<string, UnitData>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<number, string>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [activeBlank, setActiveBlank] = useState<number | null>(null)
  const [showFullText, setShowFullText] = useState(false)
  const [showFullTranslation, setShowFullTranslation] = useState(false)
  const [showTrans, setShowTrans] = useState(false)
  const [currentTransIndex, setCurrentTransIndex] = useState(1)
  const [optionCols, setOptionCols] = useState(5)
  const [openTextTrans, setOpenTextTrans] = useState<Record<number, boolean>>({})
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

  useEffect(() => {
    const updateCols = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024
      setOptionCols(w < 768 ? 3 : 5)
    }
    updateCols()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateCols)
      return () => window.removeEventListener('resize', updateCols)
    }
  }, [])

  const unitData: UnitData | undefined = data[unit]

  const correctList = useMemo(() => {
    const list = (unitData?.answer || []).map(a => (a.word || '').toLowerCase()).filter(Boolean)
    if (list.length) return list
    const txt = unitData?.text || ''
    return [...txt.matchAll(/【([^】]+)】/g)].map(m => (m[1] || '').toLowerCase())
  }, [unitData])

  const blanks = useMemo(() => Array.from({ length: Math.min(10, correctList.length || 10) }, (_, i) => i + 1), [correctList])

  const selectedValues = useMemo(() => Object.values(selected).filter(Boolean), [selected])
  const enParts = useMemo(() => (unitData?.text || '').split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0), [unitData])
  const cnParts = useMemo(() => (unitData?.translation || '').split(/(?<=[。！？])\s*/).filter(s => s.trim().length > 0), [unitData])

  const optionList = useMemo(() => {
    const ops = unitData?.options ? [...unitData.options] : []
    return shuffleDeterministic(ops, unit)
  }, [unitData, unit])

  const onSelect = (idx: number, val: string) => {
    setSelected(s => ({ ...s, [idx]: val }))
    setConfirmed(false)
  }

  const isCorrect = (idx: number) => {
    const v = selected[idx]
    const c = correctList[idx - 1]
    return v && c ? v.toLowerCase() === c : null
  }

  const submit = () => {
    if (!unitData) return
    const key = `ten_overall_${unit}`
    const result: Record<string, { selected: string | null; correct: boolean }> = {}
    blanks.forEach(i => {
      const v = selected[i] || null
      const c = correctList[i - 1]
      result[String(i)] = { selected: v, correct: !!(v && v.toLowerCase() === c) }
    })
    if (!ephemeral) localStorage.setItem(key, JSON.stringify(result))
    setConfirmed(true)
  }

  const toSummary = () => {
    router.push(`/ten/summary?key=${unit}&mode=overall`)
  }

  if (!unit) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>缺少参数 key</div>
  if (loading || !unitData) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>

  return (
    <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Space>
            <Switch checked={ephemeral} onChange={setEphemeral} />
            <Typography.Text>无痕刷题</Typography.Text>
          </Space>
          <Button onClick={() => { const key = `ten_overall_${unit}`; localStorage.removeItem(key); setSelected({}); setConfirmed(false) }}>清空本单元记录</Button>
        </Space>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>十五选十（整体） - {unit}</Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center' }}>{renderBrackets(unitData.question || '')}</Typography.Paragraph>

        <Space style={{ marginBottom: 12, justifyContent: 'center', width: '100%' }}>
          <Button onClick={() => setShowFullText(true)}>原文全文</Button>
          <Button onClick={() => setShowFullTranslation(true)}>全文翻译</Button>
          <Button onClick={() => setShowTrans(true)}>分题翻译</Button>
        </Space>

        <Typography.Title level={5}>空位</Typography.Title>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, 1fr)`, gap: 8 }}>
          {blanks.map(i => {
            const value = selected[i]
            const correct = isCorrect(i)
            return (
              <div key={i} onClick={() => setActiveBlank(i)} style={{ border: activeBlank === i ? '2px solid #1677ff' : '1px solid #ddd', borderRadius: 6, padding: 12, textAlign: 'center', cursor: 'pointer' }}>
                <Typography.Text style={{ fontWeight: 600 }}>{i} </Typography.Text>
                <span>{`【${value || '请选择'}】`}</span>
                {value && (
                  <Button danger size="small" style={{ marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); setSelected(s => { const n = { ...s }; delete n[i]; return n }) }}>X</Button>
                )}
                {correct !== null && (
                  <div style={{ marginTop: 6 }}>
                    <Tag color={correct ? 'green' : 'red'}>{correct ? '正确' : '错误'}</Tag>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Typography.Title level={5} style={{ marginTop: 16 }}>选项</Typography.Title>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${optionCols}, 1fr)`, gap: 8 }}>
          {optionList.map(op => {
            const used = selectedValues.includes(op)
            const isCurrent = activeBlank ? selected[activeBlank] === op : false
            const disabled = used && !isCurrent
            return (
              <Button key={op} type={isCurrent ? 'primary' : 'default'} disabled={disabled} onClick={() => {
                const target = activeBlank ?? blanks.find(b => !selected[b])
                if (!target) return
                onSelect(target, op)
              }}>{op}</Button>
            )
          })}
        </div>

        <Space style={{ marginTop: 16, justifyContent: 'center', width: '100%' }}>
          <Button type="primary" onClick={submit}>确认</Button>
          <Button onClick={toSummary}>提交并查看总结</Button>
          <Button onClick={() => router.push('/ten')}>返回</Button>
        </Space>

        <Modal open={showFullText} onCancel={() => setShowFullText(false)} footer={null} title="原文全文">
          <Space orientation="vertical" style={{ width: '100%' }}>
            {enParts.map((seg, i) => (
              <div key={i} style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
                {renderBrackets(seg)}
                <Space style={{ marginTop: 8 }}>
                  <Button size="small" onClick={() => setOpenTextTrans(prev => ({ ...prev, [i]: !prev[i] }))}>{openTextTrans[i] ? '隐藏翻译' : '显示翻译'}</Button>
                </Space>
                {openTextTrans[i] && (
                  <div style={{ marginTop: 8 }}>
                    {renderBrackets(cnParts[i] || '')}
                  </div>
                )}
              </div>
            ))}
          </Space>
        </Modal>

        <Modal open={showFullTranslation} onCancel={() => setShowFullTranslation(false)} footer={null} title="全文翻译">
          <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
            {renderBrackets(unitData.translation || '')}
          </div>
        </Modal>

        <Modal open={showTrans} onCancel={() => setShowTrans(false)} footer={null} title="选择题目查看翻译">
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
            <Button onClick={() => setCurrentTransIndex(i => Math.max(1, i - 1))}>上一条</Button>
            <Select
              value={currentTransIndex}
              style={{ width: 120 }}
              onChange={(v) => setCurrentTransIndex(Number(v))}
              options={unitData.answer.map((_, i) => ({ value: i + 1, label: `第${i + 1}题` }))}
            />
            <Button onClick={() => setCurrentTransIndex(i => Math.min(unitData.answer.length, i + 1))}>下一条</Button>
          </Space>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              <Typography.Text>{unitData.answer[currentTransIndex - 1]?.word}</Typography.Text>
              <Typography.Text style={{ marginLeft: 8, color: '#555' }}>{unitData.answer[currentTransIndex - 1]?.word_translation || ''}</Typography.Text>
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              {renderBrackets(unitData.answer[currentTransIndex - 1]?.long_sentence || '')}
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              <Typography.Text>{unitData.answer[currentTransIndex - 1]?.long_translation}</Typography.Text>
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              {renderBrackets(unitData.answer[currentTransIndex - 1]?.short_sentence || '')}
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
              <Typography.Text>{unitData.answer[currentTransIndex - 1]?.short_translation}</Typography.Text>
            </div>
            {unitData.answer[currentTransIndex - 1]?.description !== undefined && (
              <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
                <Typography.Text style={{ color: '#555' }}>{unitData.answer[currentTransIndex - 1]?.description}</Typography.Text>
              </div>
            )}
          </Space>
        </Modal>
      </div>
    </div>
  )
}

