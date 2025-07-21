import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface FontSizeContextType {
  currentFontSize: string;
  setCurrentFontSize: (fontSize: string) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

interface FontSizeProviderProps {
  children: ReactNode;
}

export function FontSizeProvider({ children }: FontSizeProviderProps) {
  const [currentFontSize, setCurrentFontSize] = useState("14px");

  // Load font size from localStorage on mount
  useEffect(() => {
    const savedFontSize = localStorage.getItem("gmail-font-size");
    if (savedFontSize) {
      setCurrentFontSize(savedFontSize);
    }
  }, []);

  // Save font size to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("gmail-font-size", currentFontSize);
    
    // Apply font size to root element
    document.documentElement.style.setProperty('--gmail-font-size', currentFontSize);
  }, [currentFontSize]);

  return (
    <FontSizeContext.Provider value={{ currentFontSize, setCurrentFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}