import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab') return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input,textarea,[tabindex="0"]',
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keys);
      if (previous?.isConnected && document.activeElement === document.body)
        previous.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 !m-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b flex justify-between items-center gap-3">
          <h2 className="font-bold text-agro-dark">{title}</h2>
          <button
            aria-label="Yopish"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-5 space-y-5">
          {children}
        </div>
      </div>
    </div>
  );
}
