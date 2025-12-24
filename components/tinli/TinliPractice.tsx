"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Button, Radio, Space, Tag, Typography } from "antd"

type TinliAnswer = { text: string; translation?: string; word?: { word: string; translate: string }[] }
type TinliQuestion = { error_options: string[]; answer: TinliAnswer }

type UnitTinli = {
  new?: { question: TinliQuestion[] }[]
  "further practice in listening"?: {
    short?: TinliQuestion[]
    long?: TinliQuestion[]
    passage?: TinliQuestion[]
  }
  "unit test"?: {
    short?: TinliQuestion[]
    long?: { question: TinliQuestion[] }[]
  }
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr]
  function score(str: string) {
    let h = 2166136261 >>> 0
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
    }
    return h >>> 0
  }
  const tagged = a.map((v, i) => ({ v, r: score(seed + ':' + i) }))
  tagged.sort((x, y) => (x.r < y.r ? -1 : x.r > y.r ? 1 : 0))
  return tagged.map(t => t.v)
}



function buildQuestions(type: string, unitKey: string, unit: UnitTinli, groupIndex?: number): TinliQuestion[] {
  if (!unit) return []
  if (type === "new") {
    const groups = unit.new || []
    if (typeof groupIndex === 'number' && groupIndex >= 0) {
      const g = groups[groupIndex]
      return g ? (g.question || []) : []
    }
    const res: TinliQuestion[] = []
    for (const g of groups) for (const q of g.question || []) res.push(q)
    return res
  }
  if (type === "fpl-short") return unit["further practice in listening"]?.short || []
  if (type === "fpl-long") return unit["further practice in listening"]?.long || []
  if (type === "fpl-passage") return unit["further practice in listening"]?.passage || []
  if (type === "unit-short") return unit["unit test"]?.short || []
  if (type === "unit-long") {
    const groups = unit["unit test"]?.long || []
    if (typeof groupIndex === 'number' && groupIndex >= 0) {
      const g = groups[groupIndex]
      return g ? (g.question || []) : []
    }
    const res: TinliQuestion[] = []
    for (const g of groups) for (const q of g.question || []) res.push(q)
    return res
  }
  if (type === "short") {
    const a = unit["further practice in listening"]?.short || []
    const b = unit["unit test"]?.short || []
    return [...a, ...b]
  }
  if (type === "long") {
    const a = unit["further practice in listening"]?.long || []
    const gb = unit["unit test"]?.long || []
    const b: TinliQuestion[] = []
    for (const g of gb) for (const q of g.question || []) b.push(q)
    return [...a, ...b]
  }
  return []
}

export default function TinliPractice({ fixedType }: { fixedType?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = (fixedType || (searchParams.get("type") || "short")).toLowerCase()
  const mode = (searchParams.get("mode") || "practice").toLowerCase()
  const salt = (searchParams.get("salt") || searchParams.get("rand") || "")
  const unitNum = searchParams.get("unit")
  const unitKey = unitNum ? `u${unitNum}` : (searchParams.get("key") || "u1")
  const qid = parseInt(searchParams.get("qid") || "1", 10)
  const groupIndex = (() => { const g = searchParams.get("group"); return g ? parseInt(g, 10) : undefined })()
  const [data, setData] = useState<Record<string, UnitTinli>>({})
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showTrans, setShowTrans] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/data/tinli.json")
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const detect = () => setIsMobile(typeof window !== "undefined" && window.innerWidth <= 640)
    detect()
    window.addEventListener("resize", detect)
    return () => window.removeEventListener("resize", detect)
  }, [])

  const unit = data[unitKey]
  const qs = useMemo(() => buildQuestions(type, unitKey, unit || {} as UnitTinli, groupIndex), [type, unitKey, unit, groupIndex])
  const idx = Math.max(1, Math.min(qs.length || 1, qid))
  const q = qs[idx - 1] || null
  const groupLens = useMemo(() => {
    if (!unit) return [] as number[]
    if (type === "new") {
      const all = (unit.new || []).map(g => (g.question || []).length)
      if (typeof groupIndex === 'number' && groupIndex >= 0) return [all[groupIndex] || 0]
      return all
    }
    if (type === "unit-long") {
      const all = (unit["unit test"]?.long || []).map(g => (g.question || []).length)
      if (typeof groupIndex === 'number' && groupIndex >= 0) return [all[groupIndex] || 0]
      return all
    }
    return qs.length ? [qs.length] : []
  }, [unit, type, qs, groupIndex])
  const groupBounds = useMemo(() => {
    const out: { start: number; end: number }[] = []
    let s = 1
    for (const l of groupLens) {
      const e = s + Math.max(0, l) - 1
      if (l > 0) out.push({ start: s, end: e })
      s = e + 1
    }
    return out
  }, [groupLens])
  const currentGroupIndex = useMemo(() => {
    for (let i = 0; i < groupBounds.length; i++) {
      const g = groupBounds[i]
      if (idx >= g.start && idx <= g.end) return i
    }
    return 0
  }, [groupBounds, idx])
  const options = useMemo(() => {
    if (!q) return []
    const arr = shuffle([q.answer.text, ...(q.error_options || [])], `${unitKey}:${type}:${idx}:${salt}:${groupIndex ?? ''}`)
    return arr.map((t, i) => ({ key: String(i + 1), text: t }))
  }, [q, unitKey, type, idx, salt, groupIndex])
  const chosen = useMemo(() => options.find(o => o.key === selectedKey)?.text, [options, selectedKey])
  const isCorrect = selectedKey ? chosen === q?.answer.text : null

  useEffect(() => {
    if (!loading && unitKey) localStorage.setItem("tinli_last_key", unitKey)
  }, [loading, unitKey])

  const saltedRef = useRef(false)
  useEffect(() => {
    if (mode !== "summary" && !saltedRef.current) {
      saltedRef.current = true
      const base = fixedType ? `/tinli/${fixedType}` : `/tinli/practice`
      const newSalt = String(Date.now())
      const groupPart = (typeof groupIndex === 'number' && groupIndex >= 0) ? `&group=${groupIndex}` : ''
      const query = fixedType ? `?key=${unitKey}&qid=${idx}&salt=${newSalt}${groupPart}` : `?type=${type}&key=${unitKey}&qid=${idx}&salt=${newSalt}${groupPart}`
      router.replace(`${base}${query}`)
    }
  }, [mode, unitKey, type, idx, fixedType, router, groupIndex])



  const onSelect = (val: string) => {
    setSelectedKey(val)
    setConfirmed(false)
    const key = `tinli_${type}_${unitKey}`
    const prev = localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    const nowCorrect = options.find(o => o.key === val)?.text === q?.answer.text
    obj[String(idx)] = { selected: val, correct: nowCorrect }
    localStorage.setItem(key, JSON.stringify(obj))
  }

  const onConfirm = () => {
    if (!selectedKey) return
    const key = `tinli_${type}_${unitKey}`
    const prev = localStorage.getItem(key)
    const obj = prev ? JSON.parse(prev) : {}
    obj[String(idx)] = { selected: selectedKey, correct: chosen === q?.answer.text }
    localStorage.setItem(key, JSON.stringify(obj))
    setConfirmed(true)
  }

  const goNext = () => {
    const nextId = idx + 1
    setSelectedKey(null)
    setConfirmed(false)
    // 未选择视为错误
    if (!selectedKey) {
      const key = `tinli_${type}_${unitKey}`
      const prev = localStorage.getItem(key)
      const obj = prev ? JSON.parse(prev) : {}
      if (!obj[String(idx)]) obj[String(idx)] = { selected: null, correct: false }
      localStorage.setItem(key, JSON.stringify(obj))
    }
    const g = groupBounds[currentGroupIndex]
    if (g && nextId > g.end) {
      const base = fixedType ? `/tinli/${fixedType}` : `/tinli/practice`
      const groupPart = (typeof groupIndex === 'number' && groupIndex >= 0) ? `&group=${groupIndex}` : ''
      const query = fixedType ? `?mode=summary&key=${unitKey}${groupPart}` : `?mode=summary&type=${type}&key=${unitKey}${groupPart}`
      router.push(`${base}${query}`)
      return
    }
    const base = fixedType ? `/tinli/${fixedType}` : `/tinli/practice`
    const newSalt = String(Date.now())
    const groupPart = (typeof groupIndex === 'number' && groupIndex >= 0) ? `&group=${groupIndex}` : ''
    const query = fixedType ? `?key=${unitKey}&qid=${nextId}&salt=${newSalt}${groupPart}` : `?type=${type}&key=${unitKey}&qid=${nextId}&salt=${newSalt}${groupPart}`
    const resetQuery = fixedType ? `?key=${unitKey}&qid=1&salt=${newSalt}${groupPart}` : `?type=${type}&key=${unitKey}&qid=1&salt=${newSalt}${groupPart}`
    if (nextId <= (qs.length || 1)) router.push(`${base}${query}`)
    else router.push(`${base}${resetQuery}`)
  }

  const goPrev = () => {
    const prevId = idx - 1
    setSelectedKey(null)
    setConfirmed(false)
    const base = fixedType ? `/tinli/${fixedType}` : `/tinli/practice`
    const newSalt = String(Date.now())
    const groupPart = (typeof groupIndex === 'number' && groupIndex >= 0) ? `&group=${groupIndex}` : ''
    const query = fixedType ? `?key=${unitKey}&qid=${prevId}&salt=${newSalt}${groupPart}` : `?type=${type}&key=${unitKey}&qid=${prevId}&salt=${newSalt}${groupPart}`
    if (prevId >= 1) router.push(`${base}${query}`)
  }

  useEffect(() => {
    if (mode !== "summary" && !salt) {
      const base = fixedType ? `/tinli/${fixedType}` : `/tinli/practice`
      const newSalt = String(Date.now())
      const groupPart = (typeof groupIndex === 'number' && groupIndex >= 0) ? `&group=${groupIndex}` : ''
      const query = fixedType ? `?key=${unitKey}&qid=${idx}&salt=${newSalt}${groupPart}` : `?type=${type}&key=${unitKey}&qid=${idx}&salt=${newSalt}${groupPart}`
      router.replace(`${base}${query}`)
    }
  }, [mode, salt, unitKey, type, idx, fixedType, router, groupIndex])
  if (loading) return <div>加载中...</div>
  if (mode === "summary") {
    const key = `tinli_${type}_${unitKey}`
    const prev = typeof window !== "undefined" ? localStorage.getItem(key) : null
    const answered = prev ? JSON.parse(prev) : {}
    const group = (groupBounds[currentGroupIndex] || { start: 1, end: qs.length })
    const list = qs.slice(group.start - 1, group.end)
    const correctCount = list.reduce((acc, _q, i) => {
      const r = answered[String(group.start + i)] || {}
      return acc + (r.correct ? 1 : 0)
    }, 0)
    return (
      <div style={{ padding: isMobile ? 12 : 16, maxWidth: 680, margin: "0 auto" }}>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
          <Typography.Text>{unitKey} · {type} · 总结</Typography.Text>
          <Button onClick={() => router.push("/")}>返回首页</Button>
        </Space>
        <Typography.Paragraph>本组题目：{list.length}，正确：{correctCount}</Typography.Paragraph>
        <Space orientation="vertical" style={{ width: "100%" }}>
          {list.map((qq, i) => {
            const r = answered[String((group.start) + i)] || {}
            return (
              <div key={i} style={{ padding: 8, border: "1px solid #eee", borderRadius: 6 }}>
                <Space>
                  <Typography.Text>第{i + 1}题</Typography.Text>
                  <Tag color={r.correct ? "green" : "red"}>{r.correct ? "正确" : "错误"}</Tag>
                </Space>
                <div style={{ marginTop: 8 }}>
                  <Typography.Paragraph>正确答案：{qq.answer.text}</Typography.Paragraph>
                  <Typography.Paragraph>{qq.answer.translation || ""}</Typography.Paragraph>
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    {(qq.answer.word || []).map((w, idx) => (
                      <Typography.Text key={idx}>{w.word} · {w.translate}</Typography.Text>
                    ))}
                  </Space>
                </div>
              </div>
            )
          })}
        </Space>
      </div>
    )
  }
  if (!q) return <div>暂无数据</div>

  const words = q.answer.word || []

  return (
    <div style={{ padding: isMobile ? 12 : 16, maxWidth: 680, margin: "0 auto" }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Text style={{ fontSize: isMobile ? 14 : 16 }}>{unitKey} · {type} · 第{idx}题</Typography.Text>
      </Space>



      <Radio.Group style={{ width: "100%" }} value={selectedKey} onChange={(e) => onSelect(e.target.value)}>
        <Space orientation="vertical" style={{ width: "100%" }}>
          {options.map(op => (
            <Radio key={op.key} value={op.key} style={{ whiteSpace: "normal", lineHeight: isMobile ? 1.5 : 1.6, padding: isMobile ? 6 : 4 }}>{op.text}</Radio>
          ))}
        </Space>
      </Radio.Group>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Button type="primary" size={isMobile ? "small" : "middle"} disabled={!selectedKey} onClick={onConfirm} style={{ flex: isMobile ? "1 1 100%" : undefined }}>查看是否正确</Button>
        <Button size={isMobile ? "small" : "middle"} onClick={() => setShowTrans(v => !v)} style={{ flex: isMobile ? "1 1 48%" : undefined }}>翻译</Button>
        <Button size={isMobile ? "small" : "middle"} onClick={goPrev} disabled={idx <= 1} style={{ flex: isMobile ? "1 1 48%" : undefined }}>上一题</Button>
        <Button size={isMobile ? "small" : "middle"} onClick={goNext} style={{ flex: isMobile ? "1 1 48%" : undefined }}>下一题</Button>
        <Button size={isMobile ? "small" : "middle"} onClick={() => router.push("/")} style={{ flex: isMobile ? "1 1 48%" : undefined }}>返回首页</Button>
      </div>

      {confirmed && isCorrect !== null && (
        <Alert style={{ marginTop: 12 }} type={isCorrect ? "success" : "error"} title={isCorrect ? "回答正确" : "回答错误"} />
      )}

      {showTrans && (
        <div style={{ marginTop: 12 }}>
          <Typography.Paragraph style={{ fontSize: isMobile ? 14 : 16 }}>正确答案：{q.answer.text}</Typography.Paragraph>
          <Typography.Paragraph style={{ fontSize: isMobile ? 14 : 16 }}>{q.answer.translation || ""}</Typography.Paragraph>
          <Space orientation="vertical" style={{ width: "100%" }}>
            {words.map((w, i) => (
              <Typography.Text key={i} style={{ fontSize: isMobile ? 14 : 16 }}>{w.word} · {w.translate}</Typography.Text>
            ))}
          </Space>
        </div>
      )}

    </div>
  )
}
