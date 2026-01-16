import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Settings,
} from 'lucide-react';
import { UploadTab } from '../components/UploadTab';
import { DocumentsTab } from '../components/DocumentsTab';
import { ChatSettingsManager } from '../components/ChatSettingsManager';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ToastMessage } from '../types';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const { toast } = useToast();

  // 토스트 메시지 표시
  const showToast = (message: Omit<ToastMessage, 'id'>) => {
    toast({
      variant: message.type === 'error' ? 'destructive' : 'default',
      title: message.type === 'success' ? '성공' : message.type === 'error' ? '오류' : '알림',
      description: message.message,
    });
  };

  return (
    <ProtectedRoute title="문서 관리 접근">
      <div className="container max-w-7xl mx-auto py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border/40 bg-background/50 backdrop-blur-sm sticky top-16 z-30 -mx-4 px-4 md:mx-0 md:px-0 rounded-t-2xl">
            <TabsList className="h-14 w-full justify-start bg-transparent p-0 gap-2">
              <TabsTrigger
                value="upload"
                className="h-14 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 gap-2 font-bold transition-all hover:bg-muted/50"
              >
                <UploadCloud className="w-5 h-5" />
                문서 업로드
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="h-14 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 gap-2 font-bold transition-all hover:bg-muted/50"
              >
                <FileText className="w-5 h-5" />
                문서 관리
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="h-14 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 gap-2 font-bold transition-all hover:bg-muted/50"
              >
                <Settings className="w-5 h-5" />
                챗봇 설정
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="upload" className="animate-in fade-in-50 duration-300">
              <UploadTab showToast={showToast} />
            </TabsContent>
            <TabsContent value="documents" className="animate-in fade-in-50 duration-300">
              <DocumentsTab showToast={showToast} />
            </TabsContent>
            <TabsContent value="settings" className="animate-in fade-in-50 duration-300">
              <ChatSettingsManager
                onSave={() => {
                  showToast({
                    type: 'success',
                    message: '챗봇 설정이 저장되었습니다',
                  });
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}