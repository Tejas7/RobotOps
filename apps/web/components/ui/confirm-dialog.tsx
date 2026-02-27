"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  variant = "danger"
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  variant?: "danger" | "primary";
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
            onClick={onCancel}
            aria-label="Dismiss confirmation"
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-white p-6 shadow-soft"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant={variant} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
