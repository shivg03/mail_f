import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface FontContextType {
  currentFont: string;
  setCurrentFont: (font: string) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

interface FontProviderProps {
  children: ReactNode;
}

export function FontProvider({ children }: FontProviderProps) {
  const [currentFont, setCurrentFont] = useState(() => {
    // Load font from localStorage or default to Poppins
    const savedSettings = localStorage.getItem('gmailSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        return settings.defaultTextStyle || 'Poppins';
      } catch {
        return 'Poppins';
      }
    }
    return 'Poppins';
  });

  // Apply font to document body whenever font changes
  useEffect(() => {
    document.body.style.fontFamily = `"${currentFont}", sans-serif`;
    
    // Also save to localStorage when font changes
    const savedSettings = localStorage.getItem('gmailSettings');
    let settings = {};
    if (savedSettings) {
      try {
        settings = JSON.parse(savedSettings);
      } catch {
        settings = {};
      }
    }
    
    const updatedSettings = {
      ...settings,
      defaultTextStyle: currentFont
    };
    
    localStorage.setItem('gmailSettings', JSON.stringify(updatedSettings));
  }, [currentFont]);

  // Load Google Fonts dynamically
  useEffect(() => {
    const loadGoogleFont = (fontName: string) => {
      // Skip loading for system fonts
      const systemFonts = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact'];
      if (systemFonts.includes(fontName)) {
        return;
      }

      // Check if font is already loaded
      const existingLink = document.querySelector(`link[href*="${fontName.replace(/\s+/g, '+')}"]`);
      if (existingLink) {
        return;
      }

      // Create and append Google Fonts link
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    };

    loadGoogleFont(currentFont);
  }, [currentFont]);

  return (
    <FontContext.Provider value={{ currentFont, setCurrentFont }}>
      {children}
    </FontContext.Provider>
  );
}

export function useFont() {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error('useFont must be used within a FontProvider');
  }
  return context;
}