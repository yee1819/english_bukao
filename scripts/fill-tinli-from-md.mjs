import fs from 'fs'
import path from 'path'

const mdPath = path.join(process.cwd(), 'public', 'u校园.md')
const jsonPath = path.join(process.cwd(), 'public', 'data', 'tinli.json')

const md = fs.readFileSync(mdPath, 'utf-8').split(/\r?\n/)
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
const LT_URL = process.env.LIBRETRANSLATE_URL || process.env.DICT_TRANSLATE_URL || 'http://127.0.0.1:5000'
const LT_KEY = process.env.LIBRETRANSLATE_API_KEY || process.env.DICT_TRANSLATE_API_KEY || ''
const FORCE_TRANSLATE = process.env.FORCE_TRANSLATE === '1'
const translateTasks = []
const CLEAN_PLACEHOLDERS = process.env.CLEAN_PLACEHOLDERS !== '0'

async function translateText(text) {
  if (!LT_URL || !text) return ''
  try {
    const res = await fetch(LT_URL.replace(/\/$/, '') + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'auto', target: 'zh', format: 'text', api_key: LT_KEY })
    })
    const json = await res.json()
    if (typeof json === 'string') return json
    return json.translatedText || ''
  } catch (e) {
    return ''
  }
}

const STOPWORDS = new Set((process.env.STOPWORDS || 'a,an,the,he,she,it,we,they,you,over,on,at,of,to,in,with,for,by,from,into,than,as,that,which,who,whom,where,when,how,what,why,is,are,was,were,be,been,being,do,does,did,done,doing,has,have,had,having,will,would,can,could,shall,should,may,might,not').split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
const WORDS_MAX = parseInt(process.env.WORDS_MAX || '8', 10)

function extractWordsFromText(text) {
  const tokens = (text.match(/[A-Za-z][A-Za-z'\-]+/g) || []).map(w => w.toLowerCase())
  const contentIdx = []
  for (let i = 0; i < tokens.length; i++) {
    if (!STOPWORDS.has(tokens[i])) contentIdx.push(i)
  }
  // build bigrams: consecutive content words
  const phrases = []
  for (let i = 0; i < contentIdx.length - 1; i++) {
    const i1 = contentIdx[i], i2 = contentIdx[i + 1]
    if (i2 === i1 + 1) phrases.push(tokens[i1] + ' ' + tokens[i2])
  }
  // skip-gram within window 3 (allow one stopword between)
  for (let i = 0; i < contentIdx.length - 1; i++) {
    const i1 = contentIdx[i]
    for (let j = i + 1; j < contentIdx.length; j++) {
      const i2 = contentIdx[j]
      if (i2 - i1 <= 3) {
        const between = tokens.slice(i1 + 1, i2).filter(t => !STOPWORDS.has(t))
        if (between.length === 0) phrases.push(tokens[i1] + ' ' + tokens[i2])
      } else break
    }
  }
  const singles = Array.from(new Set(contentIdx.map(i => tokens[i])))
  const candidates = Array.from(new Set([...phrases, ...singles]))
  const picked = candidates.slice(0, WORDS_MAX)
  return picked.map(w => ({ word: w, translate: '' }))
}

function mergeWords(existing = [], extracted = []) {
  const map = new Map()
  for (const e of existing) {
    if (!e || !e.word) continue
    map.set(e.word.toLowerCase(), { word: e.word, translate: e.translate || '' })
  }
  for (const ex of extracted) {
    const k = ex.word.toLowerCase()
    if (!map.has(k)) map.set(k, { word: ex.word, translate: ex.translate || '' })
  }
  return Array.from(map.values())
}

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
let currentGroup = null // collect questions for grouped sections (new, unit long)
const store = {}

function ensureStore(unit) {
  if (!store[unit]) store[unit] = { fpl: { short: [], long: [], passage: [] }, unit: { short: [], long: [] }, new: [] }
}

for (let i = 0; i < md.length; i++) {
  const line = md[i]
  const t = line.trim()
  if (t.startsWith('## ')) {
    // finalize any pending group when switching units
    if (currentUnit && currentGroup && currentGroup.length) {
      const bucket = store[currentUnit]
      if (bucket) {
        if (currentBlock === 'new') {
          if (!bucket.new_groups) bucket.new_groups = []
          bucket.new_groups.push(currentGroup)
        } else if (currentBlock === 'unit' && (currentSub || 'short') === 'long') {
          if (!bucket.unit.long_groups) bucket.unit.long_groups = []
          bucket.unit.long_groups.push(currentGroup)
        }
      }
    }
    currentUnit = t.slice(3).trim()
    ensureStore(currentUnit)
    currentBlock = null
    currentSub = null
    collecting = false
    currentQ = null
    currentGroup = null
    continue
  }
  if (t.startsWith('### ')) {
    const name = t.slice(4).trim().toLowerCase()
    // finalize any pending group when switching blocks
    if (currentGroup && currentGroup.length) {
      const bucket = store[currentUnit]
      if (bucket) {
        if (currentBlock === 'new') {
          if (!bucket.new_groups) bucket.new_groups = []
          bucket.new_groups.push(currentGroup)
        } else if (currentBlock === 'unit' && (currentSub || 'short') === 'long') {
          if (!bucket.unit.long_groups) bucket.unit.long_groups = []
          bucket.unit.long_groups.push(currentGroup)
        }
      }
    }
    if (name === 'further practice in listening') currentBlock = 'fpl'
    else if (name === 'unit test') currentBlock = 'unit'
    else if (name === 'new') { currentBlock = 'new'; currentSub = 'new'; if (currentUnit === 'u3') console.log('enter NEW block for', currentUnit) }
    else if (name === 'passage') { currentBlock = 'fpl'; currentSub = 'passage' }
    collecting = false
    currentQ = null
    currentGroup = null
    continue
  }
  // handle 5-level headers used under unit test for long
  if (t.startsWith('##### ')) {
    const sub = t.slice(6).trim().toLowerCase()
    // finalize any pending long group when switching subheaders
    if (currentBlock === 'unit' && (currentSub || 'short') === 'long' && currentGroup && currentGroup.length) {
      const bucket = store[currentUnit]
      if (bucket) {
        if (!bucket.unit.long_groups) bucket.unit.long_groups = []
        bucket.unit.long_groups.push(currentGroup)
      }
    }
    currentSub = sub
    collecting = false
    currentQ = null
    currentGroup = null
    continue
  }
  if (t.startsWith('#### ')) {
    const sub = t.slice(5).trim().toLowerCase()
    // finalize any pending long group when switching subheaders
    if (currentBlock === 'unit' && (currentSub || 'short') === 'long' && currentGroup && currentGroup.length) {
      const bucket = store[currentUnit]
      if (bucket) {
        if (!bucket.unit.long_groups) bucket.unit.long_groups = []
        bucket.unit.long_groups.push(currentGroup)
      }
    }
    currentSub = sub
    collecting = false
    currentQ = null
    currentGroup = null
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
        if ((currentSub || 'short') === 'long') {
          if (!currentGroup) currentGroup = []
          currentGroup.push(currentQ)
        } else {
          const arr = bucket.unit[currentSub || 'short']
          arr.push(currentQ)
        }
      } else if (currentBlock === 'new') {
        if (!currentGroup) currentGroup = []
        currentGroup.push(currentQ)
        // also collect sequentially for fallback
        store[currentUnit].new.push(currentQ)
      }
    }
    collecting = true
    currentQ = { correct: '', errors: [] }
    continue
  }
  if (!currentUnit) continue
  // detect separator lines, including quoted '---' or '----'
  const bare = trimQuote(t)
  if (/^[\-\–\—]{3,}$/.test(bare.replace(/\s+/g, ''))) {
    if (!collecting) {
      collecting = true
      currentQ = { correct: '', errors: [] }
    }
    currentQ._afterSep = true
    continue
  }
  // metadata lines for translation and vocab: start with '>>'
  if (t.startsWith('>>')) {
    if (!collecting) {
      collecting = true
      currentQ = { correct: '', errors: [] }
    }
    const meta = t.slice(2).trim()
    const mTrans = meta.match(/^\s*(zh|translation)\s*:\s*(.+)$/i)
    if (mTrans) {
      currentQ.translation = mTrans[2].trim()
      continue
    }
    const mWords = meta.match(/^\s*(word|words|vocab)\s*:\s*(.+)$/i)
    if (mWords) {
      const payload = mWords[2].trim()
      const entries = payload.split(/[;；]+/).map((s) => s.trim()).filter(Boolean)
      if (!currentQ.words) currentQ.words = []
      for (const e of entries) {
        // support formats: "Denver | n. 丹佛", "Denver = n. 丹佛", "Denver - n. 丹佛"
        const parts = e.split(/\s*[\|=\-]\s*/)
        if (parts.length >= 2) {
          const w = parts[0].trim()
          const tr = parts.slice(1).join(' ').trim()
          if (w && tr) currentQ.words.push({ word: w, translate: tr })
        } else if (e) {
          // bare token without translation; keep word only
          currentQ.words.push({ word: e, translate: '' })
        }
      }
      continue
    }
    // allow single-word entries per line: ">> word: Denver | n. 丹佛"
    const mWordSingle = meta.match(/^\s*word\s*:\s*(.+)$/i)
    if (mWordSingle) {
      const payload = mWordSingle[1].trim()
      if (!currentQ.words) currentQ.words = []
      const parts = payload.split(/\s*[\|=\-]\s*/)
      if (parts.length >= 2) {
        currentQ.words.push({ word: parts[0].trim(), translate: parts.slice(1).join(' ').trim() })
      } else {
        currentQ.words.push({ word: payload, translate: '' })
      }
      continue
    }
  }
  // group separator between questions (non-quoted --- or ----)
  if (!t.startsWith('>') && /^[\-\–\—]{3,}$/.test(t.replace(/\s+/g, ''))) {
    // finalize any current question into group
    if (collecting && currentQ && (currentQ.correct || (currentQ.errors && currentQ.errors.length))) {
      const bucket = store[currentUnit]
      if (currentBlock === 'fpl') {
        const arr = bucket.fpl[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'unit') {
        if ((currentSub || 'short') === 'long') {
          if (!currentGroup) currentGroup = []
          currentGroup.push(currentQ)
        } else {
          const arr = bucket.unit[currentSub || 'short']
          arr.push(currentQ)
        }
      } else if (currentBlock === 'new') {
        if (!currentGroup) currentGroup = []
        currentGroup.push(currentQ)
        store[currentUnit].new.push(currentQ)
      }
      collecting = false
      currentQ = null
    }
    // push current group boundary
    const bucket = store[currentUnit]
    if (currentBlock === 'new') {
      if (!store[currentUnit].new_groups) store[currentUnit].new_groups = []
      if (currentGroup && currentGroup.length) { store[currentUnit].new_groups.push(currentGroup); if (currentUnit === 'u3') console.log('push NEW group for', currentUnit, 'size', currentGroup.length) }
      currentGroup = null
    } else if (currentBlock === 'unit' && (currentSub || 'short') === 'long') {
      if (!store[currentUnit].unit.long_groups) store[currentUnit].unit.long_groups = []
      if (currentGroup && currentGroup.length) store[currentUnit].unit.long_groups.push(currentGroup)
      currentGroup = null
    }
    continue
  }
  if (t.startsWith('>')) {
    if (!collecting) {
      collecting = true
      currentQ = { correct: '', errors: [] }
    }
    const content = trimQuote(t)
    if (!content) continue
    if (!currentQ._afterSep) {
      if (!currentQ.correct) currentQ.correct = content
    } else {
      if (currentQ.errors.length < 3) currentQ.errors.push(content)
    }
    // auto-finalize if we already have three errors
    if (currentQ._afterSep && currentQ.errors.length === 3) {
      const bucket = store[currentUnit]
      if (currentBlock === 'fpl') {
        const arr = bucket.fpl[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'unit') {
        if ((currentSub || 'short') === 'long') {
          if (!currentGroup) currentGroup = []
          currentGroup.push(currentQ)
        } else {
          const arr = bucket.unit[currentSub || 'short']
          arr.push(currentQ)
        }
      } else if (currentBlock === 'new') {
        if (!currentGroup) currentGroup = []
        currentGroup.push(currentQ)
        store[currentUnit].new.push(currentQ)
      }
      collecting = false
      currentQ = null
      continue
    }
    // lookahead: if next significant line is number or header, finalize
    const next = (md[i + 1] || '').trim()
    if (/^\d+[\.|,]?$/.test(next) || next.startsWith('###') || next.startsWith('####') || next.startsWith('##')) {
      const bucket = store[currentUnit]
      if (currentBlock === 'fpl') {
        const arr = bucket.fpl[currentSub || 'short']
        arr.push(currentQ)
      } else if (currentBlock === 'unit') {
        if ((currentSub || 'short') === 'long') {
          if (!currentGroup) currentGroup = []
          currentGroup.push(currentQ)
        } else {
          const arr = bucket.unit[currentSub || 'short']
          arr.push(currentQ)
        }
      } else if (currentBlock === 'new') {
        if (!currentGroup) currentGroup = []
        currentGroup.push(currentQ)
        // also collect sequentially for fallback
        store[currentUnit].new.push(currentQ)
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
  if (q.translation) obj.answer.translation = q.translation
  if (q.words && q.words.length) obj.answer.word = q.words
  // clean placeholders
  if (CLEAN_PLACEHOLDERS) {
    if (obj.answer.translation && /^(this\s+is\s+a?\s*test\.?|测试)$/i.test(obj.answer.translation.trim())) {
      obj.answer.translation = ''
    }
    if (obj.answer.word && Array.isArray(obj.answer.word)) {
      obj.answer.word = obj.answer.word.filter((w) => {
        const ww = (w.word || '').trim().toLowerCase()
        const tr = (w.translate || '').trim().toLowerCase()
        if (!ww && !tr) return false
        if (/^(test|this)$/.test(ww)) return false
        if (/^(v\.?\s*测试|n\.?\s*这个|测试|这个)$/.test(tr)) return false
        return true
      })
    }
  }
  if ((FORCE_TRANSLATE || !obj.answer.translation) && LT_URL && obj.answer.text) translateTasks.push({ kind: 'text', target: obj })
  const autoWords = process.env.AUTO_WORDS === '1'
  const augment = process.env.AUGMENT_WORDS === '1'
  const forceWords = process.env.FORCE_WORDS === '1'
  if (autoWords && obj.answer.text) {
    const extracted = extractWordsFromText(obj.answer.text)
    if (!obj.answer.word || !obj.answer.word.length || forceWords) {
      obj.answer.word = extracted
    } else if (augment) {
      obj.answer.word = mergeWords(obj.answer.word, extracted)
    }
  }
  if (LT_URL && obj.answer.word && Array.isArray(obj.answer.word)) {
    for (const w of obj.answer.word) {
      if (FORCE_TRANSLATE || !w.translate) translateTasks.push({ kind: 'word', target: w })
    }
  }
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
  // new: create/align groups from md if present
  if (dst.new && Array.isArray(dst.new)) {
    let groups = src.new_groups && src.new_groups.length ? src.new_groups : (src.new && src.new.length ? [src.new] : [])
    // heuristic: if only one group was detected but we have multiple sequential items, auto-split for u3 to ensure new1/new2
    if (unit === 'u3' && (!src.new_groups || src.new_groups.length <= 1) && Array.isArray(src.new) && src.new.length >= 4) {
      const half = Math.ceil(src.new.length / 2)
      groups = [src.new.slice(0, half), src.new.slice(half)]
    }
    if (unit === 'u3') console.log('u3 new groups from md:', (src.new_groups || []).length, 'fallback:', (src.new || []).length, 'dst.new:', dst.new.length)
    if (groups.length) {
      // ensure dst has enough groups
      if (dst.new.length < groups.length) dst.new = Array.from({ length: groups.length }, () => ({ question: [] }))
      // align dst groups with src groups
      for (let gi = 0; gi < groups.length; gi++) {
        const g = dst.new[gi]
        const srcGroup = groups[gi] || []
        if (!Array.isArray(g.question)) g.question = []
        const out = []
        for (let qi = 0; qi < srcGroup.length; qi++) {
          const obj = g.question[qi] || {}
          setAnswerAndErrors(obj, srcGroup[qi])
          out.push(obj)
        }
        g.question = out
      }
      // drop extra dst groups beyond src
      if (dst.new.length > groups.length) dst.new = dst.new.slice(0, groups.length)
    } else {
      dst.new = (dst.new || []).map((g) => {
        const qs = Array.isArray(g.question) ? g.question.filter((q) => {
          const t = (q.answer && q.answer.text || '').trim().toLowerCase()
          const hasErrors = Array.isArray(q.error_options) && q.error_options.some((e) => (e || '').trim())
          if (!hasErrors) return false
          if (!t) return false
          if (/^this\s+is\s+a?\s*test\.?$/.test(t)) return false
          return true
        }) : []
        return { question: qs }
      }).filter((g) => Array.isArray(g.question) && g.question.length)
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
    // long: prefer md-defined groups via separators, fallback to sequential
    if (ut.long && Array.isArray(ut.long)) {
      const groups = src.unit.long_groups && src.unit.long_groups.length ? src.unit.long_groups : (src.unit.long && src.unit.long.length ? [src.unit.long] : [])
      if (unit === 'u3') console.log('u3 unit long groups from md:', (src.unit.long_groups || []).length, 'fallback:', (src.unit.long || []).length, 'dst.long:', ut.long.length)
      if (groups.length) {
        // ensure dst has enough groups
        if (ut.long.length < groups.length) ut.long = Array.from({ length: groups.length }, () => ({ question: [] }))
        for (let gi = 0; gi < groups.length; gi++) {
          const group = ut.long[gi]
          const srcGroup = groups[gi] || []
          if (!Array.isArray(group.question)) group.question = []
          const out = []
          for (let qi = 0; qi < srcGroup.length; qi++) {
            const obj = group.question[qi] || {}
            setAnswerAndErrors(obj, srcGroup[qi])
            out.push(obj)
          }
          group.question = out
        }
        // drop extra groups beyond src
        if (ut.long.length > groups.length) ut.long = ut.long.slice(0, groups.length)
      } else {
        ut.long = (ut.long || []).map((group) => {
          const qs = Array.isArray(group.question) ? group.question.filter((q) => {
            const t = (q.answer && q.answer.text || '').trim().toLowerCase()
            const hasErrors = Array.isArray(q.error_options) && q.error_options.some((e) => (e || '').trim())
            if (!hasErrors) return false
            if (!t) return false
            if (/^this\s+is\s+a?\s*test\.?$/.test(t)) return false
            return true
          }) : []
          return { question: qs }
        }).filter((g) => Array.isArray(g.question) && g.question.length)
      }
    }
  }
})

// finalize dangling question/group at EOF
if (collecting && currentQ && (currentQ.correct || (currentQ.errors && currentQ.errors.length))) {
  const bucket = store[currentUnit]
  if (bucket) {
    if (currentBlock === 'fpl') {
      const arr = bucket.fpl[currentSub || 'short']
      arr.push(currentQ)
    } else if (currentBlock === 'unit') {
      if ((currentSub || 'short') === 'long') {
        if (!currentGroup) currentGroup = []
        currentGroup.push(currentQ)
      } else {
        const arr = bucket.unit[currentSub || 'short']
        arr.push(currentQ)
      }
    } else if (currentBlock === 'new') {
      if (!currentGroup) currentGroup = []
      currentGroup.push(currentQ)
      // also collect sequentially for fallback
      store[currentUnit].new.push(currentQ)
    }
  }
}
if (currentGroup && currentGroup.length) {
  const bucket = store[currentUnit]
  if (bucket) {
    if (currentBlock === 'new') {
      if (!bucket.new_groups) bucket.new_groups = []
      bucket.new_groups.push(currentGroup)
    } else if (currentBlock === 'unit' && (currentSub || 'short') === 'long') {
      if (!bucket.unit.long_groups) bucket.unit.long_groups = []
      bucket.unit.long_groups.push(currentGroup)
    }
  }
  currentGroup = null
}

// global sanitize and schedule for existing data (ensure placeholders removed everywhere)
Object.keys(data).forEach((unitKey) => {
  const unitObj = data[unitKey]
  const qs = collectQuestionsFromUnit(unitObj)
  for (const q of qs) sanitizeAndSchedule(q)
})

async function flushTranslations() {
  let sentCount = 0
  let wordCount = 0
  for (const t of translateTasks) {
    if (t.kind === 'text') {
      const obj = t.target
      if (obj && obj.answer && obj.answer.text) {
        const zh = await translateText(obj.answer.text)
        if (zh) obj.answer.translation = zh
        sentCount++
      }
    } else if (t.kind === 'word') {
      const w = t.target
      if (w && w.word) {
        const zh = await translateText(w.word)
        if (zh) w.translate = zh
        wordCount++
      }
    }
  }
  if (sentCount || wordCount) {
    console.log(`Applied translations: sentences=${sentCount}, words=${wordCount}`)
  }
}

function isPlaceholderTranslation(s) {
  if (!s) return false
  const t = s.trim().toLowerCase()
  return t === 'this is a test' || t === '测试'
}

function isPlaceholderWord(w) {
  const ww = (w.word || '').trim().toLowerCase()
  const tr = (w.translate || '').trim().toLowerCase()
  if (!ww && !tr) return true
  if (ww === 'test' || ww === 'this') return true
  if (/^(v\.?\s*测试|n\.?\s*这个|测试|这个)$/.test(tr)) return true
  return false
}

function collectQuestionsFromUnit(u) {
  const out = []
  if (!u) return out
  // new
  if (Array.isArray(u.new)) {
    for (const g of u.new) {
      if (g && Array.isArray(g.question)) for (const q of g.question) out.push(q)
    }
  }
  // further practice in listening
  const fpl = u['further practice in listening']
  if (fpl) {
    if (Array.isArray(fpl.short)) for (const q of fpl.short) out.push(q)
    if (Array.isArray(fpl.long)) for (const q of fpl.long) out.push(q)
    if (Array.isArray(fpl.passage)) for (const q of fpl.passage) out.push(q)
  }
  // unit test
  const ut = u['unit test']
  if (ut) {
    if (Array.isArray(ut.short)) for (const q of ut.short) out.push(q)
    if (Array.isArray(ut.long)) for (const g of ut.long) {
      if (g && Array.isArray(g.question)) for (const q of g.question) out.push(q)
    }
  }
  return out
}

function sanitizeAndSchedule(obj) {
  if (!obj || !obj.answer) return
  // clean placeholders
  if (CLEAN_PLACEHOLDERS && isPlaceholderTranslation(obj.answer.translation)) obj.answer.translation = ''
  if (CLEAN_PLACEHOLDERS && Array.isArray(obj.answer.word)) obj.answer.word = obj.answer.word.filter(w => !isPlaceholderWord(w))
  // auto words if needed
  const autoWords = process.env.AUTO_WORDS === '1'
  const augment = process.env.AUGMENT_WORDS === '1'
  const forceWords = process.env.FORCE_WORDS === '1'
  if (autoWords && obj.answer.text) {
    const extracted = extractWordsFromText(obj.answer.text)
    if (!obj.answer.word || !obj.answer.word.length || forceWords) obj.answer.word = extracted
    else if (augment) obj.answer.word = mergeWords(obj.answer.word, extracted)
  }
  // schedule translations
  if ((FORCE_TRANSLATE || !obj.answer.translation) && LT_URL && obj.answer.text) translateTasks.push({ kind: 'text', target: obj })
  if (LT_URL && Array.isArray(obj.answer.word)) {
    for (const w of obj.answer.word) {
      if (FORCE_TRANSLATE || !w.translate) translateTasks.push({ kind: 'word', target: w })
    }
  }
}

await flushTranslations()
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), 'utf-8')
console.log('Filled tinli.json from u校园.md')
