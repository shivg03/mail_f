import React, { useRef } from "react";

export default function MinimalEditor() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => {
          if (ref.current) {
            ref.current.focus();
            document.execCommand("insertOrderedList");
          }
        }}
        style={{ marginBottom: 12 }}
      >
        Numbered List
      </button>
      <div
        ref={ref}
        contentEditable
        style={{
          minHeight: 100,
          border: "1px solid #ccc",
          marginTop: 10,
          padding: 8,
          fontSize: 16,
        }}
        suppressContentEditableWarning
      ></div>
      <div style={{ marginTop: 16, color: '#888', fontSize: 14 }}>
        Type some text, then try clicking the button with the caret at the end or with text selected.<br/>
        If you see a numbered list, execCommand works in your environment.
      </div>
    </div>
  );
} 