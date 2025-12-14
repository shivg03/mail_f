import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterOption = {
  value: string;
  label: string;
};

type FilterDropdownProps = {
  filterType: string;
  setFilterType: (value: string) => void;
};

const filterOptions: FilterOption[] = [
  { value: "All", label: "All" },
  { value: "Restricted", label: "Restricted" },
  { value: "System Account", label: "System Account" },
  { value: "Exceeded Storage", label: "Exceeded Storage" },
];

export default function FilterDropdown({
  filterType,
  setFilterType,
}: FilterDropdownProps) {
    const handleChange = (value: string) => {
    if (value) {
      setFilterType(value);
    }
  };

  return (
    <div className="w-48">
      <Select
        value={filterType}
        onValueChange={handleChange}
        {...({ modal: false } as any)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          {filterOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
