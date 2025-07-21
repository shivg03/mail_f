import React, { useState, useRef, useLayoutEffect } from "react";
import { Listbox } from "@headlessui/react";
import { createPortal } from "react-dom";

interface PortalListboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export default function PortalListbox({
  value,
  onChange,
  options,
}: PortalListboxProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Position calculation when open
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className="relative">
          <Listbox.Button
            ref={buttonRef}
            onClick={updatePosition}
            className="border dark:text-gray-100 rounded px-4 py-2 w-full text-left"
          >
            {value}
          </Listbox.Button>

          {open &&
            createPortal(
                <Listbox.Options
                style={{
                  position: "absolute",
                  top: position.top,
                  left: position.left,
                  width: position.width,
                  zIndex: 9999,
                }}
                className="portal-listbox-options bg-white dark:bg-black dark:text-gray-100 shadow-lg rounded border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto"
              >
                {options.map((opt) => (
                  <Listbox.Option
                    key={opt}
                    value={opt}
                    className={({ active, selected }) =>
                      `cursor-pointer select-none px-4 py-2 ${
                        active || selected ? "bg-[#ffa184] text-white" : "dark:text-gray-100"
                      }`
                    }
                  >
                    {opt}
                  </Listbox.Option>
                ))}
              </Listbox.Options>,
              document.body
            )}
        </div>
      )}
    </Listbox>
  );
}
