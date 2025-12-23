import fs from 'fs'
import path from 'path'

const mdPath = path.join(process.cwd(), 'public', 'u校园.md')
const jsonPath = path.join(process.cwd(), 'public', 'data', 'tinli.json')

const md = fs.readFileSync(mdPath, 'utf-8').split(/\r?\n/)
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

function trimQuote(line) {
  if (!line) return ''
  const s = line.trim()
  return s.startsWith('>') ? s.replace(/^>\s?/, '') : s
}

let currentUnit = null
let currentBlock = null // 'fpl' | 'unit' | 'new' | 'passage'
let currentSub = null // 'short' | 'long' | 'passage'
let collecting = false
let currentQ = null
const store = {}

function ensureStore(unit) {
  if (!store[unit]) store[unit] = { fpl: { short: [], long: [], passage: [] }, unit: { short: [], long: [] }, new: [] }
}

for (let i = 0; i < md.length; i++) {
  const line = md[i]
  const t = line.trim()
  if (t.startsWith('## ')) {
    currentUnit = t.slice(3).trim()
    ensureStore(currentUnit)
    currentBlock = null
    currentSub = null
    collecting = false
    currentQ = null
    continue
  }
  if (t.startsWith('### ')) {
    const name = t.slice(4).trim().toLowerCase()
    if (name === 'further practice in listening') currentBlock = 'fpl'
    else if (name === 'unit test') currentBlock = 'unit'
    else if (name === 'new') { currentBlock = 'new'; currentSub = 'new' }
    else if (name === 'passage') { currentBlock = 'fpl'; currentSub = 'passage' }
    collecting = false
    currentQ = null
    continue
  }
  if (t.startsWith('#### ')) {
    const sub = t.slice(5).trim().toLowerCase()
    currentSub = sub
    collecting = false
    currentQ = null
    continue
  }
  // number line indicates new question
  if (/^\d+[\.|,]?$/.test(t)) {
    // finalize previous question if exists
    if (collecting && currentQ && (currentQ.correct || (currentQ.errors && currentQ.errors.length))) {
      const bucket = store[currentUnit]
      if (currentBlock === 'fpl') {
        const arr = bucket.fpl[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'unit') {
        const arr = bucket.unit[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'new') {
        bucket.new.push(currentQ)
      }
    }
    collecting = true
    currentQ = { correct: '', errors: [] }
    continue
  }
  if (!collecting || !currentUnit) continue
  if (t.replace(/\s+/g, '') === '---') {
    // separator; subsequent non-empty quote lines go to errors
    if (currentQ.correct === '') {
      // if missing before, look back to find previous quoted line
    }
    currentQ._afterSep = true
    continue
  }
  if (t.startsWith('>')) {
    const content = trimQuote(t)
    if (!content) continue
    if (!currentQ._afterSep) {
      // first non-empty quoted line before --- is correct
      if (!currentQ.correct) currentQ.correct = content
    } else {
      if (currentQ.errors.length < 3) currentQ.errors.push(content)
    }
    // lookahead: if next significant line is number or header, finalize
    const next = (md[i + 1] || '').trim()
    if (/^\d+[\.|,]?$/.test(next) || next.startsWith('###') || next.startsWith('####') || next.startsWith('##')) {
      // finalize this question into store
      const bucket = store[currentUnit]
      if (currentBlock === 'fpl') {
        const arr = bucket.fpl[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'unit') {
        const arr = bucket.unit[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'new') {
        bucket.new.push(currentQ)
      }
      collecting = false
      currentQ = null
    }
  }
}

// apply to tinli.json
function setAnswerAndErrors(obj, q) {
  if (!obj.answer) obj.answer = {}
  obj.answer.text = q.correct || (obj.answer.text || '')
  obj.error_options = q.errors && q.errors.length ? q.errors : obj.error_options || ['', '', '']
}

Object.keys(store).forEach((unit) => {
  const src = store[unit]
  const dst = data[unit]
  if (!dst) return
  // further practice in listening
  if (dst['further practice in listening']) {
    const fpl = dst['further practice in listening']
    // short
    if (fpl.short && Array.isArray(fpl.short)) {
      for (let i = 0; i < Math.min(fpl.short.length, src.fpl.short.length); i++) {
        setAnswerAndErrors(fpl.short[i], src.fpl.short[i])
      }
    }
    // long
    if (fpl.long && Array.isArray(fpl.long)) {
      for (let i = 0; i < Math.min(fpl.long.length, src.fpl.long.length); i++) {
        setAnswerAndErrors(fpl.long[i], src.fpl.long[i])
      }
    }
    // passage
    if (fpl.passage && Array.isArray(fpl.passage)) {
      for (let i = 0; i < Math.min(fpl.passage.length, src.fpl.passage.length); i++) {
        setAnswerAndErrors(fpl.passage[i], src.fpl.passage[i])
      }
    }
  }
  // new: split into two groups of 2 if present
  if (dst.new && Array.isArray(dst.new)) {
    const q = src.new
    if (q.length) {
      const groupSize = Math.floor(q.length / dst.new.length) || 1
      let idx = 0
      for (let gi = 0; gi < dst.new.length; gi++) {
        const g = dst.new[gi]
        if (!Array.isArray(g.question)) g.question = []
        for (let qi = 0; qi < g.question.length && idx < q.length; qi++, idx++) {
          setAnswerAndErrors(g.question[qi], q[idx])
        }
      }
    }
  }
  // unit test
  if (dst['unit test']) {
    const ut = dst['unit test']
    // short
    if (ut.short && Array.isArray(ut.short)) {
      for (let i = 0; i < Math.min(ut.short.length, src.unit.short.length); i++) {
        setAnswerAndErrors(ut.short[i], src.unit.short[i])
      }
    }
    // long: chunk into groups of 5
    if (ut.long && Array.isArray(ut.long)) {
      const qs = src.unit.long
      if (qs.length) {
        let idx = 0
        for (let gi = 0; gi < ut.long.length; gi++) {
          const group = ut.long[gi]
          if (!Array.isArray(group.question)) group.question = []
          for (let qi = 0; qi < group.question.length && idx < qs.length; qi++, idx++) {
            setAnswerAndErrors(group.question[qi], qs[idx])
          }
        }
      }
    }
  }
})

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), 'utf-8')
console.log('Filled tinli.json from u校园.md')
