import { useState } from "react";
import { Check } from "lucide-react";

interface LabelColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

const LABEL_COLORS = [
  { name: "Red", value: "bg-red-400", class: "bg-red-400" },
  { name: "Orange", value: "bg-orange-400", class: "bg-orange-400" },
  { name: "Yellow", value: "bg-yellow-400", class: "bg-yellow-400" },
  { name: "Green", value: "bg-green-400", class: "bg-green-400" },
  { name: "Blue", value: "bg-blue-400", class: "bg-blue-400" },
  { name: "Purple", value: "bg-purple-400", class: "bg-purple-400" },
  { name: "Pink", value: "bg-pink-400", class: "bg-pink-400" },
  { name: "Indigo", value: "bg-indigo-400", class: "bg-indigo-400" },
  { name: "Gray", value: "bg-gray-400", class: "bg-gray-400" },
  { name: "Teal", value: "bg-teal-400", class: "bg-teal-400" },
  { name: "Cyan", value: "bg-cyan-400", class: "bg-cyan-400" },
  { name: "Emerald", value: "bg-emerald-400", class: "bg-emerald-400" }
];

export default function LabelColorPicker({ currentColor, onColorChange, onClose }: LabelColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState(currentColor);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onColorChange(color);
  };

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Choose label color</div>
      
      <div className="grid grid-cols-6 gap-2 mb-4">
        {LABEL_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => handleColorSelect(color.value)}
            className={`w-8 h-8 rounded-full ${color.class} border-2 ${
              selectedColor === color.value 
                ? "border-gray-800 dark:border-white" 
                : "border-gray-300 dark:border-gray-600"
            } hover:scale-110 transition-transform flex items-center justify-center`}
            title={color.name}
          >
            {selectedColor === color.value && (
              <Check className="w-4 h-4 text-white" />
            )}
          </button>
        ))}
      </div>
      
      <div className="flex justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}