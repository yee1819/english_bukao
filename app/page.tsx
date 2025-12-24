"use client"
import { Button, Flex, Space, Typography } from 'antd';
import Ten from '@/components/Drawer/ten'
import Yuedu from '@/components/Drawer/yuedu'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [keys, setKeys] = useState<string[]>([])
  const [tenKeys, setTenKeys] = useState<string[]>([])
  const [tinliKeys, setTinliKeys] = useState<string[]>([])
  const [tinliGroups, setTinliGroups] = useState<Record<string, { new: number; unitLong: number }>>({})

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/yuedu.json')
      const json = await res.json()
      const ks = Object.keys(json)
      const sorted = ks.sort((a, b) => {
        const pa = a.match(/u(\d+)t(\d+)/)
        const pb = b.match(/u(\d+)t(\d+)/)
        if (!pa || !pb) return a.localeCompare(b)
        const ua = parseInt(pa[1], 10), ta = parseInt(pa[2], 10)
        const ub = parseInt(pb[1], 10), tb = parseInt(pb[2], 10)
        if (ua === ub) return ta - tb
        return ua - ub
      })
      setKeys(sorted)
    }
    load()
  }, [])

  useEffect(() => {
    const loadTen = async () => {
      const res = await fetch('/data/15xuan10.json')
      const json = await res.json()
      const ks = Object.keys(json)
      const sorted = ks.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      setTenKeys(sorted)
    }
    loadTen()
  }, [])

  useEffect(() => {
    const loadTinli = async () => {
      const res = await fetch('/data/tinli.json')
      const json = await res.json()
      const ks = Object.keys(json)
      const sorted = ks.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
      setTinliKeys(sorted)
      const groups: Record<string, { new: number; unitLong: number }> = {}
      for (const k of ks) {
        const n = Array.isArray(json[k]?.new) ? json[k].new.length : 0
        const ul = Array.isArray(json[k]?.["unit test"]?.long) ? json[k]["unit test"].long.length : 0
        groups[k] = { new: n, unitLong: ul }
      }
      setTinliGroups(groups)
    }
    loadTinli()
  }, [])

  return (
    <>
      <Flex gap="small" wrap>
        <Ten />
        <Yuedu />
      </Flex>

      <div style={{ marginTop: 16 }}>
        <Typography.Title level={4}>文章列表</Typography.Title>
        <Flex gap="small" wrap>
          {keys.map(k => (
            <Button key={k} onClick={() => router.push(`/yuedu/practice?key=${k}&qid=1`)}>
              {k}
            </Button>
          ))}
        </Flex>
      </div>

      <div style={{ marginTop: 16 }}>
        <Typography.Title level={4}>十五选十单元</Typography.Title>
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          {tenKeys.map(k => (
            <Space key={k} size="small" style={{ width: '100%', padding: 4, borderRadius: 6 }}>
              <Typography.Text style={{ fontSize: 16 }}>{k}</Typography.Text>
              <Button size="small" onClick={() => router.push(`/ten/overall?key=${k}`)}>全部</Button>
              <Button size="small" onClick={() => router.push(`/ten/single?key=${k}&qid=1`)}>单选</Button>
            </Space>
          ))}
        </Space>
      </div>

      <div style={{ marginTop: 16 }}>
        <Typography.Title level={4}>听力练习</Typography.Title>
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          {tinliKeys.map(k => (
            <Space key={k} size="small" style={{ width: '100%', padding: 4, borderRadius: 6 }}>
              <Typography.Text style={{ fontSize: 16 }}>{k}</Typography.Text>
              <Button size="small" onClick={() => router.push(`/tinli/short?unit=${k.slice(1)}&qid=1`)}>短题</Button>
              <Button size="small" onClick={() => router.push(`/tinli/long?unit=${k.slice(1)}&qid=1`)}>长题</Button>
              <Button size="small" onClick={() => router.push(`/tinli/practice?type=fpl-passage&unit=${k.slice(1)}&qid=1`)}>篇章</Button>
              <Button size="small" onClick={() => router.push(`/tinli/practice?type=new&unit=${k.slice(1)}&qid=1`)}>新题</Button>
              <Button size="small" onClick={() => router.push(`/tinli/practice?type=unit-short&unit=${k.slice(1)}&qid=1`)}>测验短题</Button>
              <Button size="small" onClick={() => router.push(`/tinli/practice?type=unit-long&unit=${k.slice(1)}&qid=1`)}>测验长题</Button>
              {Array.from({ length: tinliGroups[k]?.new || 0 }, (_, i) => (
                <Button key={`new-${i}`} size="small" onClick={() => router.push(`/tinli/practice?type=new&unit=${k.slice(1)}&group=${i}&qid=1`)}>
                  新题{i + 1}
                </Button>
              ))}
              {Array.from({ length: tinliGroups[k]?.unitLong || 0 }, (_, i) => (
                <Button key={`unit-long-${i}`} size="small" onClick={() => router.push(`/tinli/practice?type=unit-long&unit=${k.slice(1)}&group=${i}&qid=1`)}>
                  测验长题{i + 1}
                </Button>
              ))}
            </Space>
          ))}
        </Space>
      </div>
    </>
  );
}
