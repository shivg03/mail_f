import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function CustomDialog({ isOpen, onClose, title, children, actions }: CustomDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
      <div className="bg-white dark:bg-black border rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm dark:text-white mb-6">
          {children}
        </div>
        {actions && (
          <div className="flex justify-end space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default"
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <CustomDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      actions={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#ffa184] hover:bg-[#ffa184]/20 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              "px-4 py-2 text-sm rounded transition-colors",
              variant === "destructive"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {confirmText}
          </button>
        </>
      }
    >
      {message}
    </CustomDialog>
  );
}

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export function InputDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder,
  defaultValue = "",
  confirmText = "OK",
  cancelText = "Cancel"
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <CustomDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      actions={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#ffa184] hover:bg-[#ffa184]/20 dark:hover:bg-[#ffa184]/20 rounded transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm text-white rounded bg-[#ffa184] hover:bg-[#fd9474] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div>
        {message && <p className="mb-4 dark:text-white">{message}</p>}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#ffa184] dark:bg-black dark:text-white"
          autoFocus
        />
      </div>
    </CustomDialog>
  );
}