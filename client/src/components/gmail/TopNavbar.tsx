import { useState, useRef, useEffect } from "react";
import PortalListbox from "../ui/portal-listbox";
import Icon from "../../../assets/icon-mail-n.svg?react";
import { Listbox } from '@headlessui/react'
import { apiRequest } from "@/lib/queryClient";
import Settings from "./Settings";

interface TopNavbarProps {
  onToggleSidebar: () => void;
  showFilters?: boolean;
  onShowFiltersChange?: (show: boolean) => void;
  onShowSettings?: () => void;
  onSearch?: (filters: SearchFilters) => void;
  onToggleRightPanel?: () => void;
  sidebarOpen?: boolean;
  mailId?: string;
  onSearchResults?: (results: any[]) => void;
}

interface SearchFilters {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasWords?: string;
  doesntHave?: string;
  size?: string;
  sizeUnit?: string;
  hasAttachment?: boolean;
  dontIncludeChats?: boolean;
}

export default function TopNavbar({ onToggleSidebar, showFilters: externalShowFilters, onShowFiltersChange, onShowSettings, onSearch, onToggleRightPanel, sidebarOpen = false, onSearchResults, mailId }: TopNavbarProps) {
  const [internalShowFilters, setInternalShowFilters] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode was previously enabled
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const filterRef = useRef<HTMLDivElement>(null);
  const [showFilterNameModal, setShowFilterNameModal] = useState(false);
  const [pendingFilterData, setPendingFilterData] = useState<any>(null);
  const [filterName, setFilterName] = useState("");

  // Saved filters state
  const [savedFilters, setSavedFilters] = useState<{ filterUniqueId: string, name: string }[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(false);

  const showFilters = externalShowFilters !== undefined ? externalShowFilters : internalShowFilters;
  const setShowFilters = onShowFiltersChange || setInternalShowFilters;

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsData, setSettingsData] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Initialize dark mode on mount
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#000000';
      document.body.style.backgroundColor = '#000000';
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#000000'; // pure black
      document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    }
  };

// Close filter when clicking outside
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (
      filterRef.current &&
      !filterRef.current.contains(target) &&
      !target.closest(".portal-listbox-options") // ⬅️ allow clicks inside portal dropdown
    ) {
      setShowFilters(false);
    }
  }

  if (showFilters) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [showFilters, setShowFilters]);

  // Filter form state
  const [searchQuery, setSearchQuery] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [hasWordsFilter, setHasWordsFilter] = useState("");
  const [doesntHaveFilter, setDoesntHaveFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [sizeComparison, setSizeComparison] = useState("greater than");
  const [sizeUnit, setSizeUnit] = useState("MB");
  const [hasAttachment, setHasAttachment] = useState(false);
  const [dontIncludeChats, setDontIncludeChats] = useState(false);

  // Fetch filter names when modal opens or mailId changes
  useEffect(() => {
    if (showFilters && mailId) {
      setLoadingFilters(true);
      apiRequest('POST', '/email/getFilterNames', { mail_id: mailId })
        .then(res => {
          setSavedFilters(res.data.filters || []);
        })
        .catch(() => setSavedFilters([]))
        .finally(() => setLoadingFilters(false));
    }
  }, [showFilters, mailId]);

  // Fetch filter details when a filter is selected
  useEffect(() => {
    if (selectedFilterId) {
      apiRequest('POST', '/email/getFilterDetailsbyId', { filterUniqueId: selectedFilterId })
        .then(res => {
          const filter = res.data.filter?.filterObject || {};
          // Populate modal fields with filter details
          setSearchQuery(filter.text || "");
          setFromFilter(filter.from || "");
          setToFilter(filter.to || "");
          setSubjectFilter(filter.subject || "");
          setHasAttachment(!!filter.hasAttachments);
          setSizeFilter(filter.minSize ? String(filter.minSize / (1024 * 1024)) : filter.maxSize ? String(filter.maxSize / (1024 * 1024)) : "");
          setSizeComparison(filter.minSize ? "greater than" : filter.maxSize ? "less than" : "greater than");
          setSizeUnit("MB"); // You can enhance this to detect KB/GB if needed
        });
    }
  }, [selectedFilterId]);

  // Utility to convert size to bytes
  function convertToBytes(value: string, unit: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return undefined;
    switch (unit) {
      case 'KB': return Math.round(num * 1024);
      case 'MB': return Math.round(num * 1024 * 1024);
      case 'GB': return Math.round(num * 1024 * 1024 * 1024);
      default: return Math.round(num);
    }
  }

  // Update handleSearch for simple search (flat object)
  const handleSearch = async () => {
    const body: any = { mail_id: mailId };
    if (searchQuery) body.text = searchQuery;
    if (fromFilter) body.from = fromFilter;
    if (toFilter) body.to = toFilter;
    if (subjectFilter) body.subject = subjectFilter;
    if (hasAttachment) body.hasAttachments = true;
    if (sizeFilter) {
      if (sizeComparison === 'greater than') body.minSize = convertToBytes(sizeFilter, sizeUnit);
      else body.maxSize = convertToBytes(sizeFilter, sizeUnit);
    }
    // Remove undefined/null
    Object.keys(body).forEach(k => (body[k] == null || body[k] === "") && delete body[k]);
    try {
      const res = await apiRequest('POST', '/email/searchEmails', body);
      const data = res.data;
      if (data.results && Array.isArray(data.results)) {
        onSearchResults && onSearchResults([...data.results]);
      }
      setShowFilters(false);
    } catch (e) {
      // Optionally show error
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setFromFilter("");
    setToFilter("");
    setSubjectFilter("");
    setHasWordsFilter("");
    setDoesntHaveFilter("");
    setSizeFilter("");
    setSizeComparison("greater than");
    setSizeUnit("MB");
    setHasAttachment(false);
    setDontIncludeChats(false);
    setShowFilters(false);
  };

  const units = ['MB', 'KB', 'GB']

  // Add handleCreateFilter for filter creation
  const handleCreateFilter = () => {
    const filter: any = { mail_id: mailId };
    if (searchQuery) filter.text = searchQuery;
    if (fromFilter) filter.from = fromFilter;
    if (toFilter) filter.to = toFilter;
    if (subjectFilter) filter.subject = subjectFilter;
    if (hasAttachment) filter.hasAttachments = true;
    if (sizeFilter) {
      if (sizeComparison === 'greater than') filter.minSize = convertToBytes(sizeFilter, sizeUnit);
      else filter.maxSize = convertToBytes(sizeFilter, sizeUnit);
    }
    Object.keys(filter).forEach(k => (filter[k] == null || filter[k] === "") && delete filter[k]);
    setPendingFilterData(filter);
    setShowFilterNameModal(true);
  };

  // Actually send the filter creation request
  const handleSubmitFilterName = async () => {
    if (!filterName || !pendingFilterData) return;
    try {
      const res = await apiRequest('POST', '/email/createFilter', { filter: pendingFilterData, name: filterName });
      const data = res.data;
      if (data.results && Array.isArray(data.results)) {
        onSearchResults && onSearchResults([...data.results]);
      }
      setShowFilters(false);
      setShowFilterNameModal(false);
      setFilterName("");
      setPendingFilterData(null);
    } catch (e) {
      // Optionally show error
      setShowFilterNameModal(false);
      setFilterName("");
      setPendingFilterData(null);
    }
  };

  // Remove settings modal state and API logic

  return (
    <header className="flex items-center justify-between px-2 md:px-4 py-2 border-b bg-card shadow-sm z-50">
      <div className="flex items-center space-x-2 md:space-x-4 min-w-0">
        {/* Mobile: Animated hamburger menu */}
        <button 
          onClick={onToggleSidebar}
          className="p-2 hover:bg-accent rounded-md transition-colors duration-200 md:hidden"
        >
          <div className="w-5 h-5 flex flex-col justify-center items-center">
            <span className={`bg-muted-foreground block transition-all duration-300 ease-out h-0.5 w-5 rounded-sm ${
              sidebarOpen ? 'rotate-45 translate-y-1' : '-translate-y-0.5'
            }`}></span>
            <span className={`bg-muted-foreground block transition-all duration-300 ease-out h-0.5 w-5 rounded-sm my-0.5 ${
              sidebarOpen ? 'opacity-0' : 'opacity-100'
            }`}></span>
            <span className={`bg-muted-foreground block transition-all duration-300 ease-out h-0.5 w-5 rounded-sm ${
              sidebarOpen ? '-rotate-45 -translate-y-1' : 'translate-y-0.5'
            }`}></span>
          </div>
        </button>

        {/* Desktop: Logo and title */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="w-9 h-9 flex items-center justify-center">
             <Icon className="w-10 h-10 text-[#ffa184]" style={{ fill: '#ffa184' }} />
          </div>
          <span className="text-xl font-semibold text-foreground">Fusion Mail</span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-2 md:mx-8 relative" ref={filterRef}>
      <div className="flex items-center bg-muted rounded-md hover:bg-background hover:shadow-sm transition-all duration-200 border border-border hover:border-[#ffa184] h-8 md:h-9">
          <button className="p-1 md:p-2">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <input 
            type="text" 
            placeholder="Search mail" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="flex-1 bg-transparent outline-none py-1 md:py-2 text-xs md:text-sm text-foreground placeholder-muted-foreground"
          />
          <button 
            className="p-1 md:p-2 hover:bg-accent rounded-r-md transition-colors duration-200"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </button>
        </div>

        {showFilters && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-black rounded-lg shadow-lg border overflow-hidden z-50 max-h-100 overflow-y-auto max-md:fixed max-md:inset-x-4 max-md:top-16 max-md:max-h-[70vh]">
            <div className="p-3 md:p-4 space-y-3">
              {/* Saved Filters Dropdown */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Saved Filters</label>
                {loadingFilters ? (
                  <div className="text-xs text-gray-500">Loading filters...</div>
                ) : (
                  <select
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184]"
                    value={selectedFilterId || ""}
                    onChange={e => setSelectedFilterId(e.target.value || null)}
                  >
                    <option value="">-- Select a filter --</option>
                    {savedFilters.map(f => (
                      <option key={f.filterUniqueId} value={f.filterUniqueId}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">From</label>
                  <input 
                    type="text" 
                    value={fromFilter}
                    onChange={(e) => setFromFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-100" //focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184]
                    placeholder=""
                  />
                </div>  

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">To</label>
                  <input 
                    type="text" 
                    value={toFilter}
                    onChange={(e) => setToFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-100" //focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184]
                    placeholder=""
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Subject</label>
                  <input 
                    type="text" 
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-100" //focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184]
                    placeholder=""
                  />
                </div>

                {/* <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Has the words</label>
                  <input 
                    type="text" 
                    value={hasWordsFilter}
                    onChange={(e) => setHasWordsFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-100" //focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184]
                    placeholder=""
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Doesn't have</label>
                  <input 
                    type="text" 
                    value={doesntHaveFilter}
                    onChange={(e) => setDoesntHaveFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-100" //focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184]
                    placeholder=""
                  />
                </div> */}

                <div className="space-y-1 col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Size</label>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center space-y-2 md:space-y-0 md:space-x-2">
                    <select 
                      value={sizeComparison}
                      onChange={(e) => setSizeComparison(e.target.value)}
                      className="w-full md:w-auto px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-200"
                    >
                      <option value="greater than">greater than</option>
                      <option value="less than">less than</option>
                    </select>
                    <input 
                      type="number" 
                      value={sizeFilter}
                      onChange={(e) => setSizeFilter(e.target.value)}
                      className="w-full md:flex-1 px-2 py-1.5 text-sm border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-1 focus:ring-[#ffa184] focus:border-[#ffa184] transition-all duration-200" 
                      placeholder="Size"
                    />
                    <PortalListbox
                      value={sizeUnit}
                      onChange={setSizeUnit}
                      options={["MB", "KB", "GB"]}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4 pt-2">
                <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={hasAttachment}
                    onChange={(e) => setHasAttachment(e.target.checked)}
                    className="w-4 h-4 accent-[#ffa184]"
                  />
                  <span className="text-sm dark:text-gray-300">Has attachment</span>
                </label>
{/* 
                <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={dontIncludeChats}
                    onChange={(e) => setDontIncludeChats(e.target.checked)}
                    className="w-4 h-4 accent-[#ffa184]"
                  />
                  <span className="text-sm dark:text-gray-300">Don't include chats</span>
                </label> */}
              </div>

              <div className="flex flex-col md:flex-row justify-end items-stretch md:items-center space-y-2 md:space-y-0 md:space-x-3 pt-3 border-t">
                <button
                  onClick={handleCreateFilter}
                  className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-[#ffa184] dark:hover:text-[#ffa184]/80 hover:bg-[#ffa184]/20 dark:hover:bg-[#ffa184]/20 rounded transition-all duration-200"
                >
                  Create filter
                </button>
                <button 
                  onClick={handleSearch}
                  className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white rounded bg-[#ffa184] hover:bg-[#fd9474] transition-all duration-200"
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Filter Name Modal */}
        {showFilterNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-black rounded-lg shadow-lg p-6 w-full max-w-xs mx-auto">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Give your filter a name</h2>
              <input
                type="text"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white dark:bg-black dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-[#ffa184] focus:border-[#ffa184] mb-4"
                placeholder="Enter filter name"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowFilterNameModal(false); setFilterName(""); setPendingFilterData(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFilterName}
                  className="px-4 py-2 text-sm font-medium text-white rounded bg-[#ffa184] hover:bg-[#fd9474]"
                  disabled={!filterName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1">
        

        {/* Desktop: Support and Settings buttons */}
        <button className="hidden md:flex p-2 rounded-lg hover:bg-accent transition-colors duration-200" title="Support">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button 
          onClick={onShowSettings}
          className="hidden md:flex p-2 rounded-lg hover:bg-accent transition-colors duration-200" 
          title="Settings"
        >
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Mobile: Right panel arrow */}
        <button 
          onClick={() => window.history.back()}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group relative"
          title="Toggle right panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="url(#mobile-gradient)" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="mobile-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffa184" />
                <stop offset="35%" stopColor="#ffc3a0" />
                <stop offset="70%" stopColor="#ff6b6b" />
              </linearGradient>
            </defs> 
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Desktop: Account icon */}
        <button className="hidden md:flex w-8 h-8 rounded-full bg-gradient-to-br from-[#ffa184] via-[#ffc3a0] to-[#ff6b6b] font-medium text-sm items-center justify-center hover:shadow-lg transition-all duration-200" title="Account">
          JD
        </button>
      </div>
    </header>
  );
}