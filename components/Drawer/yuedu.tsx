'use client'
import { Button, Drawer, Input, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function Yuedu() {
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
            } catch { }
        }
        if (open) load()
    }, [open])
    return (
        <>
            <Button onClick={showDrawer}>阅读理解</Button>
            <Drawer
                title="请选择你的目标"
                closable={{ 'aria-label': 'Close Button' }}
                onClose={onClose}
                open={open}
            >
                <Space orientation="vertical" style={{ width: '100%' }}>
                    <Button type="primary" onClick={() => router.push('/yuedu?mode=random')}>随机一篇</Button>
                    <Button onClick={() => router.push('/yuedu?mode=sequence')}>按顺序</Button>
                    <Input
                        placeholder="输入如 u1t1"
                        value={targetKey}
                        onChange={(e) => setTargetKey(e.target.value)}
                    />
                    <Button disabled={!targetKey} onClick={() => router.push(`/yuedu/practice?key=${targetKey}&qid=1`)}>跳转到该单元</Button>
                    <Typography.Title level={5}>文章列表</Typography.Title>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                        {keys.map(k => (
                            <Space key={k} style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Typography.Text>{k}</Typography.Text>
                                <Button size="small" onClick={() => router.push(`/yuedu/practice?key=${k}&qid=1`)}>开始</Button>
                            </Space>
                        ))}
                    </Space>
                </Space>
            </Drawer>
        </>
    )
}

export default Yuedu
