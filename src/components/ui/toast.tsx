'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const types = {
    success: 'bg-background/90 border border-green-500/20 text-foreground shadow-[0_0_20px_rgba(34,197,94,0.1)] rounded-xl',
    error: 'bg-background/90 border border-red-500/20 text-foreground shadow-[0_0_20px_rgba(239,68,68,0.1)] rounded-xl',
    info: 'bg-background/90 border border-primary/20 text-foreground shadow-[0_0_20px_rgba(59,130,246,0.1)] rounded-xl'
  };

  const icons = {
    success: '✅',
    error: '❌',
    info: '💡'
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50 backdrop-blur-md',
        types[type]
      )}
    >
      <span>{icons[type]}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 hover:opacity-70 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

interface ToastManagerProps {
  message: string | null;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export function ToastManager({ message, type = 'info', duration, onClose }: ToastManagerProps) {
  if (!message) return null;

  return createPortal(
    <Toast
      message={message}
      type={type}
      duration={duration}
      onClose={onClose}
    />,
    document.body,
  );
}
