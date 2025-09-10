"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    Upload,
    Download,
    FileText,
    Link,
    Database,
    Settings,
    MoreHorizontal
} from "lucide-react";

interface LiteratureActionsProps {
    className?: string;
    compact?: boolean;
}

export function LiteratureActions({ className, compact = false }: LiteratureActionsProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);

    // 处理添加文献
    const handleAddLiterature = () => {
        setShowAddForm(true);
        console.log('Opening add literature form');
    };

    // 处理批量导入
    const handleImport = (type: 'zotero' | 'file' | 'doi') => {
        setShowImportDialog(true);
        console.log('Opening import dialog:', type);
    };

    // 处理导出
    const handleExport = (format: 'csv' | 'json' | 'bibtex' | 'ris') => {
        setShowExportDialog(true);
        console.log('Exporting data as:', format);
    };

    // 处理设置
    const handleSettings = () => {
        console.log('Opening literature settings');
    };

    if (compact) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <Button onClick={handleAddLiterature} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleImport('file')}>
                            <Upload className="h-4 w-4 mr-2" />
                            批量导入
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('csv')}>
                            <Download className="h-4 w-4 mr-2" />
                            导出数据
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSettings}>
                            <Settings className="h-4 w-4 mr-2" />
                            设置
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* 主要操作按钮 */}
            <Button onClick={handleAddLiterature} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                添加文献
            </Button>

            {/* 导入下拉菜单 */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        导入
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleImport('zotero')}>
                        <Link className="h-4 w-4 mr-2" />
                        从 Zotero 导入
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleImport('file')}>
                        <FileText className="h-4 w-4 mr-2" />
                        从文件导入
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleImport('doi')}>
                        <Database className="h-4 w-4 mr-2" />
                        通过 DOI 导入
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* 导出下拉菜单 */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        导出
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('csv')}>
                        <FileText className="h-4 w-4 mr-2" />
                        导出为 CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')}>
                        <Database className="h-4 w-4 mr-2" />
                        导出为 JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport('bibtex')}>
                        <FileText className="h-4 w-4 mr-2" />
                        导出为 BibTeX
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('ris')}>
                        <FileText className="h-4 w-4 mr-2" />
                        导出为 RIS
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* 设置按钮 */}
            <Button variant="outline" size="icon" onClick={handleSettings}>
                <Settings className="h-4 w-4" />
            </Button>

            {/* TODO: 添加对话框组件 */}
            {/* {showAddForm && (
        <AddLiteratureDialog 
          open={showAddForm}
          onClose={() => setShowAddForm(false)}
        />
      )}
      
      {showImportDialog && (
        <ImportLiteratureDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
        />
      )}
      
      {showExportDialog && (
        <ExportLiteratureDialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
        />
      )} */}
        </div>
    );
}

