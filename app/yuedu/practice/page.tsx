"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Button, FloatButton, Modal, Radio, Space, Typography } from "antd"

type WordItem = { word?: string; phrase?: string; translate: string }
type AnswerInfo = { title: string; titleTranslate: string; word: WordItem[] }
type QA = {
  title: string
  titleTranslate: string
  word: WordItem[]
  answer: AnswerInfo
  errorOpinion: string[]
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<Record<string, Record<string, QA>>>({})
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showTitleTrans, setShowTitleTrans] = useState(false)
  const [showAnswerTrans, setShowAnswerTrans] = useState(false)

  const unit = searchParams.get('key') || ''
  const qid = searchParams.get('qid') || ''

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/yuedu.json')
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  const qa: QA | undefined = useMemo(() => {
    const u = data[unit] as Record<string, QA> | undefined
    if (!u) return undefined
    return u[qid]
  }, [data, unit, qid])

  const options = useMemo(() => {
    if (!qa) return []
    const arr = [qa.answer.title, ...(qa.errorOpinion || [])].filter(Boolean)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    const labels = ["A", "B", "C", "D"]
    return arr.map((text, idx) => ({ key: labels[idx], text }))
  }, [qa])

  const ids = useMemo(() => {
    const u = data[unit]
    if (!u) return []
    return Object.keys(u).sort((a, b) => parseInt(a) - parseInt(b))
  }, [data, unit])

  useEffect(() => {
    if (unit) localStorage.setItem('yuedu_last_key', unit)
  }, [unit])

  const chosen = useMemo(() => options.find(o => o.key === selectedKey)?.text, [options, selectedKey])
  const isCorrect = selectedKey ? chosen === qa?.answer.title : null

  const goNext = () => {
    const u = data[unit]
    if (!u) return
    const ids = Object.keys(u).sort((a, b) => parseInt(a) - parseInt(b))
    const currentIndex = ids.indexOf(qid)
    const nextId = ids[currentIndex + 1]
    setSelectedKey(null)
    setConfirmed(false)
    if (nextId) router.push(`/yuedu/practice?key=${unit}&qid=${nextId}`)
    else router.push(`/yuedu/summary?key=${unit}`)
  }

  const onSelect = (val: string) => {
    setSelectedKey(val)
    setConfirmed(false)
    const key = `yuedu_progress_${unit}`
    const prev = localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    const r = obj[qid] || {}
    const chosenText = options.find(o => o.key === val)?.text
    const nowCorrect = chosenText === qa?.answer.title
    obj[qid] = { ...r, selected: val, correct: nowCorrect }
    localStorage.setItem(key, JSON.stringify(obj))
  }

  const onConfirm = () => {
    if (!selectedKey) return
    const key = `yuedu_progress_${unit}`
    const prev = localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    obj[qid] = { selected: selectedKey, correct: chosen === qa?.answer.title }
    localStorage.setItem(key, JSON.stringify(obj))
    setConfirmed(true)
  }

  useEffect(() => {
    setSelectedKey(null)
    setConfirmed(false)
  }, [qid])

  if (!unit || !qid) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>缺少参数 key 或 qid</div>
  if (loading || !qa) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>加载中...</div>

  return (
    <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 800 }}>
        <Space style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
          {ids.map((id) => (
            <Typography.Text key={id} style={{ fontWeight: id === qid ? 600 : 400 }}>{id}</Typography.Text>
          ))}
        </Space>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>{qa.title || `${unit} 第${qid}题`}</Typography.Title>
        <Space orientation="vertical" style={{ width: '100%' }}>
        <Radio.Group
          value={selectedKey as any}
          onChange={(e) => onSelect(e.target.value)}
        >
          <Space orientation="vertical">
            {options.map((op) => (
              <Radio key={op.key} value={op.key}>{`${op.key}. ${op.text}`}</Radio>
            ))}
          </Space>
        </Radio.Group>

        {confirmed && selectedKey && (
          <Alert
            type={isCorrect ? 'success' : 'error'}
            title={isCorrect ? '回答正确' : '回答错误'}
            showIcon
          />
        )}

        <Space>
          <Button type="primary" disabled={!selectedKey} onClick={onConfirm}>查看是否正确</Button>
          <Button onClick={goNext}>下一题</Button>
          <Button onClick={() => router.push('/yuedu')}>返回选择</Button>
        </Space>
      </Space>

      <FloatButton.Group shape="square" style={{ right: 24 }}>
        <FloatButton content="题目翻译" onClick={() => setShowTitleTrans(true)} />
        <FloatButton content="答案翻译" onClick={() => setShowAnswerTrans(true)} />
      </FloatButton.Group>

      <Modal open={showTitleTrans} onCancel={() => setShowTitleTrans(false)} footer={null} title="题目翻译">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
            <Typography.Text>{qa.title}</Typography.Text>
          </div>
          <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
            <Typography.Text>{qa.titleTranslate}</Typography.Text>
          </div>
          {qa.word && qa.word.length > 0 && (
            <Space orientation="vertical">
              {qa.word.map((w, i) => (
                <div key={i} style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
                  <Typography.Text>{(w.word ?? w.phrase) + ' — ' + w.translate}</Typography.Text>
                </div>
              ))}
            </Space>
          )}
        </Space>
      </Modal>

      <Modal open={showAnswerTrans} onCancel={() => setShowAnswerTrans(false)} footer={null} title="答案翻译">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
            <Typography.Text>{qa.answer.title}</Typography.Text>
          </div>
          <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
            <Typography.Text>{qa.answer.titleTranslate}</Typography.Text>
          </div>
          {qa.answer.word && qa.answer.word.length > 0 && (
            <Space orientation="vertical">
              {qa.answer.word.map((w, i) => (
                <div key={i} style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: 8 }}>
                  <Typography.Text>{(w.word ?? w.phrase) + ' — ' + w.translate}</Typography.Text>
                </div>
              ))}
            </Space>
          )}
        </Space>
      </Modal>
      </div>
    </div>
  )
}
