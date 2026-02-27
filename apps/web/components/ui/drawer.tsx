"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Drawer({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
            aria-label="Close drawer"
          />
          <motion.aside
            initial={{ x: 420, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl border-l border-border bg-white p-5 shadow-soft"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">{title}</h3>
              <button
                type="button"
                className="rounded-full border border-border p-2 text-muted hover:text-text"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)] overflow-y-auto pr-1">{children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
