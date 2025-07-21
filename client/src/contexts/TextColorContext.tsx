import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface TextColorContextType {
  currentTextColor: string;
  setCurrentTextColor: (color: string) => void;
}

const TextColorContext = createContext<TextColorContextType | undefined>(undefined);

interface TextColorProviderProps {
  children: ReactNode;
}

export function TextColorProvider({ children }: TextColorProviderProps) {
  const [currentTextColor, setCurrentTextColor] = useState("#000000");

  // Load text color from localStorage on mount
  useEffect(() => {
    const savedTextColor = localStorage.getItem("gmail-text-color");
    if (savedTextColor) {
      setCurrentTextColor(savedTextColor);
    }
  }, []);

  // Save text color to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("gmail-text-color", currentTextColor);
    
    // Apply text color to root element
    document.documentElement.style.setProperty('--gmail-text-color', currentTextColor);
  }, [currentTextColor]);

  return (
    <TextColorContext.Provider value={{ currentTextColor, setCurrentTextColor }}>
      {children}
    </TextColorContext.Provider>
  );
}

export function useTextColor() {
  const context = useContext(TextColorContext);
  if (context === undefined) {
    throw new Error("useTextColor must be used within a TextColorProvider");
  }
  return context;
}