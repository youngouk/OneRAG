import React, { useState } from 'react';
import PromptManager from '../components/PromptManager';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useToast } from '@/hooks/use-toast';

export default function PromptsPage() {
  const { toast } = useToast();

  return (
    <ProtectedRoute title="프롬프트 관리 접근">
      <div className="container mx-auto max-w-[1400px] py-6 animate-in fade-in duration-500">
        <PromptManager />
      </div>
    </ProtectedRoute>
  );
}
