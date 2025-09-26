"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DownloadCloud, KeyRound, Link2 } from 'lucide-react';
import { useDatasetSettings } from '@/features/user/settings/data-access';
import { DatasetSyncPanel } from './DatasetSyncPanel';

interface ZoteroQuickPanelProps {
    className?: string;
    currentCollectionId?: string;
}

export const ZoteroQuickPanel: React.FC<ZoteroQuickPanelProps> = ({ className, currentCollectionId }) => {
    const { settings, updateSettings } = useDatasetSettings();
    const [apiKey, setApiKey] = React.useState(settings?.apiKey || '');
    const [testing, setTesting] = React.useState(false);
    const [testResult, setTestResult] = React.useState<null | { ok: boolean; message?: string }>(null);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        setApiKey(settings?.apiKey || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings?.apiKey]);

    const saveKey = () => {
        updateSettings({ apiKey: apiKey.trim() });
    };

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const url = `/api/dataset/zotero/test?limit=1&format=json`;
            const res = await fetch(url, { headers: { 'Zotero-API-Key': apiKey.trim() || '' } });
            if (!res.ok) {
                setTestResult({ ok: false, message: `HTTP ${res.status}` });
            } else {
                setTestResult({ ok: true });
            }
        } catch (e: any) {
            setTestResult({ ok: false, message: e?.message || 'Network error' });
        } finally {
            setTesting(false);
        }
    };

    const statusColor = testResult == null ? 'text-muted-foreground' : (testResult.ok ? 'text-emerald-600' : 'text-red-600');
    const statusText = testResult == null ? '未测试' : (testResult.ok ? '连接正常' : `连接失败${testResult.message ? `：${testResult.message}` : ''}`);

    return (
        <>
            <Card className={className}>
                <CardHeader className="pb-3" variant="gray">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DownloadCloud className="w-4 h-4" />
                        Zotero 快捷导入
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 theme-background-primary" variant="gray">
                    <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Zotero API Key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            onBlur={saveKey}
                        />
                        <Button variant="secondary" onClick={saveKey} disabled={settings?.apiKey === apiKey.trim()}>保存</Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
                            <Link2 className="w-3.5 h-3.5 mr-1" />{testing ? '测试中…' : '测试连接'}
                        </Button>
                        <span className={statusColor}>{statusText}</span>
                    </div>
                    <div className="pt-1">
                        <Button size="sm" onClick={() => setOpen(true)} disabled={!apiKey.trim()}>
                            打开导入面板
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-5xl h-[80vh] grid grid-rows-[auto_minmax(0,1fr)] items-stretch content-stretch justify-stretch overflow-hidden">
                    <DialogHeader className="px-6 py-2">
                        <DialogTitle>Zotero 导入</DialogTitle>
                    </DialogHeader>
                    <div className="h-full min-h-0 px-6 pb-6 overflow-hidden">
                        <DatasetSyncPanel defaultCollectionId={currentCollectionId} />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ZoteroQuickPanel;


