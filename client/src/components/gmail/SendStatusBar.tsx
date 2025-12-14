import React from "react";

export type SendStatusBarProps = {
  status: 'idle' | 'sending' | 'sent';
  onUndo: () => void;
  onView: () => void;
  onClose: () => void;
};

function MiniSpinner() {
  return (
    <span
      className="inline-block text-[#ffa184] w-4 h-4 mr-2 align-middle border-2 border-current border-t-transparent rounded-full animate-spin"
      aria-label="Loading"
    />
  );
}

export default function SendStatusBar({ status, onUndo, onView, onClose }: SendStatusBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white shadow-md rounded px-4 py-2 flex items-center gap-3 border min-w-[260px] max-w-[240px]">
      {status === "sending" ? (
        <>
          <MiniSpinner />
          <span className="text-sm font-medium text-gray-700">Sending…</span>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-700">Mail sent successfully</span>
        </>
      )}
      <button className="ml-auto text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}