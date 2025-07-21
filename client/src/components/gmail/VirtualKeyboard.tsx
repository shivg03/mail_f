import { useState } from "react";

interface VirtualKeyboardProps {
  onClose: () => void;
}

export default function VirtualKeyboard({ onClose }: VirtualKeyboardProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const languages = [
    "English",
    "Spanish", 
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Russian",
    "Chinese",
    "Japanese",
    "Hindi"
  ];

  const keyboardLayout = {
    row1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
    row2: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    row3: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
    row4: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
  };

  const handleKeyPress = (key: string) => {
    console.log(`Virtual key pressed: ${key}`);
    // In a real implementation, this would insert the character into the focused input
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-black border rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium dark:text-white">Virtual Keyboard</h3>
          <div className="flex items-center space-x-4">
            <button 
              onClick={onClose}
              className=" hover:text-gray-600 dark:text-white transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-black border rounded-lg p-6">
          <div className="space-y-3">
            {/* Number Row */}
            <div className="flex justify-center space-x-1">
              {keyboardLayout.row1.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="keyboard-key bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-0"
                  style={{ minWidth: '40px', height: '40px' }}
                >
                  {key}
                </button>
              ))}
            </div>
            
            {/* Top Row */}
            <div className="flex justify-center space-x-1">
              {keyboardLayout.row2.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="keyboard-key bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-0"
                  style={{ minWidth: '40px', height: '40px' }}
                >
                  {key}
                </button>
              ))}
            </div>
            
            {/* Home Row */}
            <div className="flex justify-center space-x-1">
              {keyboardLayout.row3.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="keyboard-key bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-0"
                  style={{ minWidth: '40px', height: '40px' }}
                >
                  {key}
                </button>
              ))}
            </div>
            
            {/* Bottom Row */}
            <div className="flex justify-center space-x-1">
              {keyboardLayout.row4.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="keyboard-key bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-0"
                  style={{ minWidth: '40px', height: '40px' }}
                >
                  {key}
                </button>
              ))}
            </div>
            
            {/* Space Bar */}
            <div className="flex justify-center">
              <button
                onClick={() => handleKeyPress(' ')}
                className="keyboard-key bg-white border border-gray-300 rounded px-3 py-2 text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors"
                style={{ width: '320px', height: '40px' }}
              >
                Space
              </button>
            </div>
          </div>
        </div>
        

      </div>
    </div>
  );
}
