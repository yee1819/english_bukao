'use client'
import { Button, Drawer, Input, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


function Ten() {
    const [open, setOpen] = useState(false);
    const [targetKey, setTargetKey] = useState("");
    const [keys, setKeys] = useState<string[]>([]);
    const router = useRouter();

    const showDrawer = () => {
        setOpen(true);
    };

    const onClose = () => {
        setOpen(false);
    };

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/data/15xuan10.json')
                const json = await res.json()
                const ks = Object.keys(json)
                const sorted = ks.sort((a, b) => {
                    const pa = a.match(/u(\d+)/)
                    const pb = b.match(/u(\d+)/)
                    if (!pa || !pb) return a.localeCompare(b)
                    const ua = parseInt(pa[1], 10)
                    const ub = parseInt(pb[1], 10)
                    return ua - ub
                })
                setKeys(sorted)
            } catch {}
        }
        if (open) load()
    }, [open])

    const startSequence = (mode: 'overall' | 'single') => {
        const last = typeof window !== 'undefined' ? localStorage.getItem('ten_last_key') : null
        const nextIdx = last ? Math.max(0, Math.min(keys.length - 1, keys.indexOf(last) + 1)) : 0
        const nextKey = keys[nextIdx] || keys[0]
        if (mode === 'overall') router.push(`/ten/overall?key=${nextKey}`)
        else router.push(`/ten/single?key=${nextKey}&qid=1`)
    }

    const startRandom = (mode: 'overall' | 'single') => {
        if (!keys.length) return
        const idx = Math.floor(Math.random() * keys.length)
        const k = keys[idx]
        if (mode === 'overall') router.push(`/ten/overall?key=${k}`)
        else router.push(`/ten/single?key=${k}&qid=1`)
    }

    return (
        <>
            <Button onClick={showDrawer}>十五选十</Button>
            <Drawer
                title="请选择你的目标"
                closable={{ 'aria-label': 'Close Button' }}
                onClose={onClose}
                open={open}
            >
            <Space orientation="vertical" style={{ width: '100%' }}>
                <Space>
                    <Button type="primary" onClick={() => startRandom('overall')}>随机单元（整体）</Button>
                    <Button onClick={() => startRandom('single')}>随机单元（单题）</Button>
                </Space>
                <Space>
                    <Button onClick={() => startSequence('overall')}>按顺序（整体）</Button>
                    <Button onClick={() => startSequence('single')}>按顺序（单题）</Button>
                </Space>
                <Input
                    placeholder="输入如 u1"
                    value={targetKey}
                    onChange={(e) => setTargetKey(e.target.value)}
                />
                <Space>
                    <Button disabled={!targetKey} onClick={() => router.push(`/ten/overall?key=${targetKey}`)}>跳转（整体）</Button>
                    <Button disabled={!targetKey} onClick={() => router.push(`/ten/single?key=${targetKey}&qid=1`)}>跳转（单题）</Button>
                </Space>
                <Typography.Title level={5}>单元列表</Typography.Title>
                <Space orientation="vertical" style={{ width: '100%' }}>
                    {keys.map(k => (
                        <Space key={k} style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Typography.Text>{k}</Typography.Text>
                            <Space>
                                <Button size="small" onClick={() => router.push(`/ten/overall?key=${k}`)}>整体</Button>
                                <Button size="small" onClick={() => router.push(`/ten/single?key=${k}&qid=1`)}>单题</Button>
                            </Space>
                        </Space>
                    ))}
                </Space>
            </Space>
            </Drawer>
        </>
    )
}

export default Ten
