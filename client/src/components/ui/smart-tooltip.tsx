import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function SmartTooltip({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) {
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Flip to bottom if not enough space above
    if (triggerRect.top < tooltipRect.height + 8) {
      setPosition("bottom");
    } else {
      setPosition("top");
    }
  }, [visible]);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`fixed z-[9999] bg-red-200 text-red-700 text-xs rounded-md px-2 py-1 
                        whitespace-nowrap shadow-lg transition-all duration-300 ease-out
                        ${position === "top" ? "mb-1" : "mt-1"}`}
            style={{
              top:
                position === "top"
                  ? triggerRef.current!.getBoundingClientRect().top - 25
                  : triggerRef.current!.getBoundingClientRect().bottom + 8,
              left:
                triggerRef.current!.getBoundingClientRect().left +
                triggerRef.current!.offsetWidth / 2,
              transform: "translateX(-50%)",
              opacity: visible ? 1 : 0,
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </div>
  );
}
