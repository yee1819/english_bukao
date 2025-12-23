import fs from 'fs'
import path from 'path'

const filePath = path.join(process.cwd(), 'public', 'data', 'tinli.json')

const raw = fs.readFileSync(filePath, 'utf-8')
const json = JSON.parse(raw)

function sanitize(obj) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) sanitize(obj[i])
    return
  }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (k === 'error_options' && Array.isArray(v)) {
        obj[k] = v.map(() => '')
      } else {
        sanitize(v)
      }
    }
  }
}

sanitize(json)

fs.writeFileSync(filePath, JSON.stringify(json, null, 4), 'utf-8')
console.log('Cleaned error_options strings in', filePath)
