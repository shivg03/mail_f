import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import LabelColorPicker from "./LabelColorPicker";
import { useTranslation } from "../../contexts/TranslationContext";
import { InputDialog } from "@/components/ui/custom-dialog";

type Label = {
  labelUniqueId: string;
  name: string;
  color: string;
  isVisible: boolean;
  showIfUnread: boolean;
  showInMessageList: boolean;
  // add any other fields you use
};

const IconComponent = ({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const iconPaths: Record<string, string> = {
    inbox:
      "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z M3 9l9 6 9-6",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    clock:
      "M12 2v4 M16.24 7.76l-1.41 1.42 M20 12h-4 M16.24 16.24l-1.41-1.42 M12 20v-4 M7.76 16.24l1.42-1.42 M4 12h4 M7.76 7.76l1.42 1.42",
    send: "M2 21l21-9L2 3v7l15 2-15 2v7z",
    "file-text":
      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    "alert-triangle":
      "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
    "message-circle":
      "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
    calendar:
      "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z",
    folder:
      "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
    archive:
      "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19a2 2 0 002 2h14a2 2 0 002-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "trash-2":
      "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6",
    "chevron-right": "M9 18l6-6-6-6",
    "chevron-down": "M6 9l6 6 6-6",
    plus: "M12 5v14 M5 12h14",
    "more-vertical": "M12 5v.01M12 12v.01M12 19v.01",
    tag: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01",
    ban: "M18 10a8 8 0 00-8 8c0 1.54.36 3 1 4.29V19a2 2 0 002 2h10a2 2 0 002-2v-1.71C18.64 13 18 11.54 18 10zM6 10a6 6 0 0112 0c0 1.54-.36 3-1 4.29V19H7v-1.71C6.36 13 6 11.54 6 10z",
  };

  return (
    <svg
      className={className || "w-4 h-4"}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={style}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={iconPaths[name]}
      />
    </svg>
  );
};

interface LeftSidebarProps {
  collapsed: boolean;
  currentView: string;
  onViewChange: (view: string) => void;
  onCompose: () => void;
  onShowSettings?: () => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  mailId?: string; // <-- Add mailId prop
}

export default function LeftSidebar({
  collapsed,
  currentView,
  onViewChange,
  onCompose,
  onShowSettings,
  selectedCategory,
  onCategoryChange,
  mailId,
}: LeftSidebarProps) {
  const { t } = useTranslation();
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [activeLabelMenu, setActiveLabelMenu] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top?: string;
    bottom?: string;
  }>({});
  const [showHiddenLabels, setShowHiddenLabels] = useState(false);
  const [editingLabel, setEditingLabel] = useState<{
    labelUniqueId: string;
    name: string;
  } | null>(null);
  const [editLabelName, setEditLabelName] = useState("");

  // Input dialog state
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });
  const [systemLabelsVisibility, setSystemLabelsVisibility] = useState<
    Record<string, boolean>
  >({
    inbox: true,
    starred: true,
    snoozed: true,
    important: true,
    sent: true,
    drafts: true,
    tasks: true,
    scheduled: true,
    archive: true,
    all: true,
    spam: true,
    trash: true,
    blocked:true
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const isExpanded = !collapsed || hovered;

  // Fetch labels from the API
  const { data: apiLabels = [], refetch: refetchLabels } = useQuery({
    queryKey: ["/label/getLabels", mailId],
    queryFn: async () => {
      if (!mailId) return [];
      const response = await apiRequest("POST", "/label/getLabels", {
        mail_id: mailId,
      });
      return response.data;
    },
    enabled: !!mailId,
  });

  // Fetch all emails for inbox count
  const { data: allEmails = [], isLoading: loadingEmails } = useQuery({
    queryKey: ["/email/allmails", mailId, "sidebar-inbox-count"],
    queryFn: async () => {
      if (!mailId) return [];
      const response = await apiRequest("POST", "/email/allmails", {
        mail_id: mailId,
      });
      if (Array.isArray(response.data)) return response.data;
      return response.data?.emails || [];
    },
    enabled: !!mailId,
  });

  // Calculate inbox count (exclude archived, muted, spam, trash)
  const inboxCount = allEmails.filter(
    (email: any) =>
      !email.isArchived && !email.isMute && !email.isSpam && !email.isTrash
  ).length;

  // Calculate inbox unread count (exclude archived, muted, spam, trash)
  const inboxUnreadCount = allEmails.filter(
    (email: any) =>
      email.isUnread === true &&
      !email.isArchived &&
      !email.isMute &&
      !email.isSpam &&
      !email.isTrash &&
      !email.isBlocked
  ).length;

  // Calculate all mail count (exclude only archived, spam, trash)
  const allMailCount = allEmails.filter(
    (email: any) =>
      !email.isArchived && !email.isSpam && !email.isTrash
  ).length;

  const navigationItems = [
    {
      icon: "inbox",
      label: t.inbox,
      count: inboxCount,
      unreadCount: inboxUnreadCount,
      view: "inbox",
    },
    { icon: "star", label: t.starred, view: "starred" },
    { icon: "clock", label: t.snoozed, view: "snoozed" },
    { icon: "send", label: t.sent, view: "sent" },
    { icon: "file-text", label: t.drafts, count: "12", view: "drafts" },
    { icon: "calendar", label: t.addToTasks, view: "tasks" },
  ];

  // Mutation for updating label properties
  const updateLabelMutation = useMutation({
    mutationFn: async (args: {
      mail_id: string;
      labelUniqueId: string;
      updates: any;
    }) => {
      const { mail_id, labelUniqueId, updates } = args;
      return await apiRequest("PATCH", "/label/updateLabel", {
        mail_id,
        labelUniqueId,
        ...updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
    },
  });

  const moreItems = [
    { icon: "alert-triangle", label: t.important, view: "important" },
    { icon: "calendar", label: t.scheduled, view: "scheduled" },
    { icon: "archive", label: t.archive, view: "archive" },
    { icon: "folder", label: t.allMail, view: "allmails", count: allMailCount },
    { icon: "shield", label: t.spam, view: "spam" },
    { icon: "trash-2", label: t.trash, view: "trash" },
    { icon: "ban", label: t.blocked, view: "blocked" }, // Blocked section
  ];

  const createLabelMutation = useMutation({
    mutationFn: async (args: {
      mail_id: string;
      name: string;
      color: string;
      isVisible: boolean;
      showIfUnread: boolean;
      showInMessageList: boolean;
    }) => {
      const {
        mail_id,
        name,
        color,
        isVisible,
        showIfUnread,
        showInMessageList,
      } = args;
      return await apiRequest("POST", "/label/createLabel", {
        mail_id,
        name,
        color,
        isVisible,
        showIfUnread,
        showInMessageList,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
      setNewLabelName("");
      setShowCreateLabel(false);
    },
    onError: (error) => {
      console.error("Error creating label:", error);
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (args: { mail_id: string; labelUniqueId: string }) => {
      const { mail_id, labelUniqueId } = args;
      return await apiRequest("DELETE", "/label/deleteLabel", {
        mail_id,
        labelUniqueId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
    },
    onError: (error) => {
      console.error("Error deleting label:", error);
    },
  });

  // Helper function to check if a label has unread emails
  const hasUnreadEmails = (labelName: string) => {
    // This would typically check against actual email data
    // For now, return false as a placeholder
    return false;
  };

  // Add a color palette for label colors
  const labelColors = [
    "#FFA184", // orange
    "#60a5fa", // blue
    "#4ade80", // green
    "#f87171", // red
    "#facc15", // yellow
    "#c084fc", // purple
    "#f472b6", // pink
    "#fb923c", // orange2
    "#9ca3af", // gray
    "#818cf8", // indigo
    "#2dd4bf", // teal
  ];

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    const randomColor = labelColors[Math.floor(Math.random() * labelColors.length)];
    createLabelMutation.mutate({
      mail_id: mailId || "",
      name: newLabelName,
      color: randomColor,
      isVisible: true,
      showIfUnread: false,
      showInMessageList: true,
    });
  };

  // Load system labels visibility from localStorage
  useEffect(() => {
    const defaultVisibility = {
      inbox: true,
      starred: true,
      snoozed: true,
      important: true,
      sent: true,
      drafts: true,
      tasks: true,
      scheduled: true,
      archive: true,
      all: true,
      spam: true,
      trash: true,
    };

    const savedVisibility = localStorage.getItem("systemLabelsVisibility");
    if (savedVisibility) {
      const parsed = JSON.parse(savedVisibility);
      // Merge with new defaults to ensure new labels are visible
      const mergedVisibility = { ...defaultVisibility, ...parsed };
      setSystemLabelsVisibility(mergedVisibility);
    } else {
      setSystemLabelsVisibility(defaultVisibility);
    }

    // Listen for storage changes to sync with Settings modal
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "systemLabelsVisibility" && e.newValue) {
        setSystemLabelsVisibility(JSON.parse(e.newValue));
      }
    };

    // Listen for custom events for same-tab synchronization
    const handleCustomEvent = (e: CustomEvent) => {
      setSystemLabelsVisibility(e.detail);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "systemLabelsVisibilityChanged",
      handleCustomEvent as EventListener
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "systemLabelsVisibilityChanged",
        handleCustomEvent as EventListener
      );
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveLabelMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLabelMenuClick = (labelName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (activeLabelMenu === labelName) {
      setActiveLabelMenu(null);
      return;
    }

    setActiveLabelMenu(labelName);

    // Calculate menu position after setting the active menu
    setTimeout(() => {
      const button = e.currentTarget as HTMLElement;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const menuHeight = 300; // Approximate menu height

      // Check if menu would overflow below viewport
      if (rect.bottom + menuHeight > viewportHeight) {
        setMenuPosition({ bottom: "100%" });
      } else {
        setMenuPosition({ top: "100%" });
      }
    }, 0);
  };

  const handleLabelAction = (action: string, label: Label) => {
    setActiveLabelMenu(null);

    switch (action) {
      case "edit":
        setEditingLabel({
          labelUniqueId: label.labelUniqueId,
          name: label.name,
        });
        setEditLabelName(label.name);
        break;
      case "remove":
        deleteLabelMutation.mutate({
          mail_id: mailId || "",
          labelUniqueId: label.labelUniqueId,
        });
        break;
      case "hide":
        updateLabelMutation.mutate({
          mail_id: mailId || "",
          labelUniqueId: label.labelUniqueId,
          updates: { isVisible: false },
        });
        break;
      case "show":
        updateLabelMutation.mutate({
          mail_id: mailId || "",
          labelUniqueId: label.labelUniqueId,
          updates: { isVisible: true },
        });
        break;
      case "show-unread":
        updateLabelMutation.mutate({
          mail_id: mailId || "",
          labelUniqueId: label.labelUniqueId,
          updates: { showIfUnread: true },
        });
        break;
      case "show-in-message-list":
        updateLabelMutation.mutate({
          mail_id: mailId || "",
          labelUniqueId: label.labelUniqueId,
          updates: { showInMessageList: true },
        });
        break;
      case "hide-in-message-list":
        updateLabelMutation.mutate({
          mail_id: mailId || "",
          labelUniqueId: label.labelUniqueId,
          updates: { showInMessageList: false },
        });
        break;
      case "add-sublabel":
        setInputDialog({
          isOpen: true,
          title: "Add Sublabel",
          message: `Enter sublabel name for "${label.name}":`,
          placeholder: "Enter sublabel name",
          onConfirm: (sublabelName) => {
            const randomColor = labelColors[Math.floor(Math.random() * labelColors.length)];
            createLabelMutation.mutate({
              mail_id: mailId || "",
              name: `${label.name}/${sublabelName}`,
              color: randomColor,
              isVisible: true,
              showIfUnread: false,
              showInMessageList: true,
            });
          },
        });
        break;
    }
  };

  const handleEditLabel = async () => {
    if (!editLabelName.trim() || !editingLabel) return;

    updateLabelMutation.mutate({
      mail_id: mailId || "",
      labelUniqueId: editingLabel.labelUniqueId,
      updates: { name: editLabelName.trim() },
    });

    setEditingLabel(null);
    setEditLabelName("");
  };

  const handleColorChange = (labelUniqueId: string, newColor: string) => {
    updateLabelMutation.mutate({
      mail_id: mailId || "",
      labelUniqueId: labelUniqueId,
      updates: { color: newColor },
    });
    setShowColorPicker(null);
  };

  // Add a click handler for label navigation
  const handleLabelClick = (labelUniqueId: string) => {
    if (onViewChange) {
      onViewChange(`label:${labelUniqueId}`);
    }
  };

  // After fetching allEmails and mailId
  const userEmail = allEmails[0]?.to || "";

  // When rendering or opening ComposeModal:
  // <ComposeModal
  //   isOpen={isComposeOpen}
  //   onClose={closeCompose}
  //   mail_Id={mailId}
  //   from={userEmail}
  //   // ...other props
  // />

  return (
    <aside
      className={`bg-card transition-all duration-300 ${
        isExpanded ? "w-full md:w-60" : "w-12 md:w-16"
      } ${collapsed ? "hidden md:flex" : ""} flex flex-col h-full`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-2 md:p-4 hidden md:block flex-shrink-0">
        <button
          onClick={onCompose}
          className={`flex items-center justify-center border rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#ffa184] hover:animate-pulse ${
            isExpanded
              ? "space-x-2 md:space-x-3 px-3 md:px-6 py-2 md:py-3 w-full"
              : "p-2 md:p-3 justify-center"
          }`}
        >
          <svg
            className="w-4 h-4 dark:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {isExpanded && (
            <span className="font-medium dark:text-white">{t.compose}</span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto">
          <nav className="pt-4 md:pt-0 w-full pb-4">
            {/* Mobile-only: Primary and Promotion filters */}
            {/* {currentView === "inbox" && onCategoryChange && (
              <div className="md:hidden mb-4 w-full">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2 px-4">Inbox Categories</div>
                <div className="space-y-1 w-full">
                  <div 
                    className={`sidebar-item flex items-center space-x-4 px-6 py-3 cursor-pointer transition-all duration-200 hover:bg-accent group w-full ${
                      selectedCategory === "primary" ? "bg-[#ffa184]/10" : ""
                    }`}
                    onClick={() => onCategoryChange("primary")}
                  >
                    <IconComponent 
                      name="inbox" 
                      className={`w-4 h-4 ${selectedCategory === "primary" ? "text-[#ffa184]" : "text-muted-foreground"} transition-colors`}
                    />
                    <span className={`font-medium text-sm ${selectedCategory === "primary" ? "text-[#ffa184]" : "text-muted-foreground"} transition-colors`}>
                      {t.primary}
                    </span>
                  </div>
                  <div 
                    className={`sidebar-item flex items-center space-x-4 px-6 py-3 cursor-pointer transition-all duration-200 hover:bg-accent group w-full ${
                      selectedCategory === "promotions" ? "bg-[#ffa184]/10" : ""
                    }`}
                    onClick={() => onCategoryChange("promotions")}
                  >
                    <IconComponent 
                      name="tag" 
                      className={`w-4 h-4 ${selectedCategory === "promotions" ? "text-[#ffa184]" : "text-muted-foreground"} transition-colors`}
                    />
                    <span className={`font-medium text-sm ${selectedCategory === "promotions" ? "text-[#ffa184]" : "text-muted-foreground"} transition-colors`}>
                      {t.promotions}
                    </span>
                  </div>
                </div>
              </div>
            )} */}

            {navigationItems
              .filter((item) => systemLabelsVisibility[item.view] !== false)
              .map((item, index) => {
                const isActive = currentView === item.view;
                return (
                  <div
                    key={index}
                    className={`sidebar-item flex items-center justify-between px-6 py-3 cursor-pointer transition-all duration-200 hover:bg-accent group ${
                      isActive ? "bg-[#ffa184]/10 hover:bg-[#ffa184]/20" : ""
                    }`}
                    title={item.label}
                    onClick={() => onViewChange(item.view)}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent
                        name={item.icon}
                        className={`w-4 h-4 ${
                          isActive ? "text-[#ffa184]" : "text-muted-foreground"
                        } transition-colors`}
                      />
                      <span
                        className={`font-medium text-sm ${
                          isActive ? "text-[#ffa184]" : "text-muted-foreground"
                        } transition-colors`}
                      >
                        {item.label}
                      </span>
                      {/* Unread badge for inbox only */}
                      {/* {item.view === "inbox" && item.unreadCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300">
                        {item.unreadCount}
                      </span>
                    )} */}
                    </div>
                    {item.view === "inbox" && item.unreadCount > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isActive
                            ? "bg-[#ffa184] text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })}

            <div className="sidebar-item flex items-center justify-between px-6 py-3 cursor-pointer transition-all duration-200 hover:bg-accent group">
              <div
                className="flex items-center space-x-3 w-full"
                onClick={() => setMoreExpanded(!moreExpanded)}
              >
                <IconComponent
                  name={moreExpanded ? "chevron-down" : "chevron-right"}
                  className="w-4 h-4 text-muted-foreground transition-transform duration-200"
                />
                <span className="text-muted-foreground font-medium text-sm">
                  {moreExpanded ? t.less : t.more}
                </span>
              </div>
            </div>

            {moreExpanded && (
              <div className="pl-4">
                {moreItems
                  .filter((item) => systemLabelsVisibility[item.view] !== false)
                  .map((item, index) => {
                    const isActive = currentView === item.view;
                    return (
                      <div
                        key={index}
                        className={`sidebar-item flex items-center space-x-3 px-6 py-3 cursor-pointer transition-all duration-200 hover:bg-accent group ${
                          isActive
                            ? "bg-[#ffa184]/10 hover:bg-[#ffa184]/20"
                            : ""
                        }`}
                        title={item.label}
                        onClick={() => onViewChange(item.view)}
                      >
                        <IconComponent
                          name={item.icon}
                          className={`w-4 h-4 ${
                            isActive
                              ? "text-[#ffa184]"
                              : "text-muted-foreground"
                          } transition-colors`}
                        />
                        <span
                          className={`font-medium text-sm ${
                            isActive
                              ? "text-[#ffa184]"
                              : "text-muted-foreground"
                          } transition-colors`}
                        >
                          {item.label}
                        </span>
                        {item.count && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                            {item.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Mobile: Settings in hamburger menu */}
            <div className=" md:hidden">
              <div
                className="sidebar-item flex items-center space-x-3 px-6 py-3 cursor-pointer transition-all duration-200 hover:bg-accent group"
                onClick={onShowSettings}
              >
                <svg
                  className="w-4 h-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="font-medium text-sm text-muted-foreground">
                  Settings
                </span>
              </div>
            </div>

            <div className="">
              <div className="flex items-center justify-between px-6 py-3">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {t.labels}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg p-1 transition-colors"
                    title="Show/hide hidden labels"
                    onClick={() => setShowHiddenLabels(!showHiddenLabels)}
                  >
                    <IconComponent
                      name="chevron-down"
                      className={`w-3 h-3 transition-transform ${
                        showHiddenLabels ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg p-1 transition-colors"
                    title="Create label"
                    onClick={() => setShowCreateLabel(!showCreateLabel)}
                  >
                    <IconComponent name="plus" className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {showCreateLabel && (
                <div className="mx-2 mb-2 px-2 py-2">
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder={t.labelName}
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-background text-foreground"
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleCreateLabel()
                      }
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCreateLabel}
                        disabled={createLabelMutation.isPending}
                        className="flex-1 px-2 py-1 text-xs text-primary-foreground rounded bg-[#ffa184] hover:bg-[#fd9474] disabled:opacity-50"
                      >
                        {createLabelMutation.isPending
                          ? `${t.loading}`
                          : t.createLabel}
                      </button>
                      <button
                        onClick={() => setShowCreateLabel(false)}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {editingLabel && (
              <div className="mx-2 mb-2 px-2 py-2 bg-[#ffa184]/20 dark:[#ffa184]/20 border border-[#ffa184] dark:border-[#ffa184] rounded">
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Label name"
                    value={editLabelName}
                    onChange={(e) => setEditLabelName(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded bg-background text-foreground"
                    onKeyPress={(e) => e.key === "Enter" && handleEditLabel()}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleEditLabel}
                      disabled={updateLabelMutation.isPending}
                      className="flex-1 px-2 py-1 text-xs bg-[#ffa184] text-primary-foreground rounded hover:bg-[#ffa184]/90 disabled:opacity-50"
                    >
                      {updateLabelMutation.isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingLabel(null);
                        setEditLabelName("");
                      }}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Visible Labels */}
            {apiLabels
              .filter(
                (label: Label) =>
                  label.isVisible ||
                  (label.showIfUnread && hasUnreadEmails(label.name))
              )
              .map((label: Label, index: number) => {
                const isActive = currentView === `label:${label.labelUniqueId}`;
                const isMenuOpen = activeLabelMenu === label.name;

                const labelColor = label.color;

                return (
                  <div
                    key={label.labelUniqueId}
                    className={`sidebar-item relative flex items-center justify-between px-6 py-3 transition-all duration-200 group ${
                      isActive ? "" : ""
                    }`}
                    style={{
                      backgroundColor: isActive
                        ? labelColor + "20"
                        : "transparent", // 20% opacity for active state
                      borderLeftColor: isActive ? labelColor : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor =
                          labelColor + "15"; // 15% opacity
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                    onClick={() => handleLabelClick(label.labelUniqueId)}
                  >
                    <div
                      className="flex items-center space-x-3 flex-1 cursor-pointer"
                      title={label.name}
                      onClick={() => onViewChange(`label:${label.labelUniqueId}`)}
                    >
                      <IconComponent
                        name="tag"
                        className="w-3 h-3 transition-colors"
                        style={{ color: labelColor }}
                      />
                      <span
                        className="font-medium text-sm transition-colors"
                        style={{ color: labelColor }}
                      >
                        {label.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLabelMenu(
                            activeLabelMenu === label.name ? null : label.name
                          );
                        }}
                        className={`p-1 rounded transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                          isMenuOpen ? "opacity-100" : ""
                        }`}
                        style={{
                          backgroundColor: isMenuOpen
                            ? labelColor + "20"
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            labelColor + "30";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isMenuOpen
                            ? labelColor + "20"
                            : "transparent";
                        }}
                        title="Label options"
                      >
                        <IconComponent
                          name="more-vertical"
                          className="w-3 h-3 transition-colors"
                          style={{ color: labelColor }}
                        />
                      </button>
                    </div>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 bottom-full mb-1 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
                      >
                        <div className="px-3 py-2 text-xs text-muted-foreground border-b border-gray-200 dark:border-gray-700 relative">
                          <button
                            onClick={() =>
                              setShowColorPicker(
                                showColorPicker === label.labelUniqueId
                                  ? null
                                  : label.labelUniqueId
                              )
                            }
                            className="flex items-center space-x-2 hover:text-gray-900 dark:hover:text-gray-100 w-full text-left"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: label.color }}
                            ></div>
                            <span>Label color</span>
                          </button>
                          {showColorPicker === label.labelUniqueId && (
                            <div className="absolute z-50">
                              <LabelColorPicker
                                currentColor={label.color}
                                onColorChange={(newColor) =>
                                  handleColorChange(label.labelUniqueId, newColor)
                                }
                                onClose={() => setShowColorPicker(null)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                          In label list
                        </div>
                        <button
                          onClick={() => handleLabelAction("show", label)}
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                        >
                          <span className="w-4 h-4 mr-2 text-green-600 font-bold">
                            {label.isVisible ? "✓" : ""}
                          </span>
                          Show
                        </button>
                        <button
                          onClick={() =>
                            handleLabelAction("show-unread", label)
                          }
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Show if unread
                        </button>
                        <button
                          onClick={() => handleLabelAction("hide", label)}
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Hide
                        </button>

                        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-gray-200 dark:border-gray-700 font-medium">
                          In message list
                        </div>
                        <button
                          onClick={() =>
                            handleLabelAction("show-in-message-list", label)
                          }
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                        >
                          <span className="w-4 h-4 mr-2 text-green-600 font-bold">
                            {label.showInMessageList ? "✓" : ""}
                          </span>
                          Show
                        </button>
                        <button
                          onClick={() =>
                            handleLabelAction("hide-in-message-list", label)
                          }
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Hide
                        </button>

                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <button
                          onClick={() => handleLabelAction("edit", label)}
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleLabelAction("remove", label)}
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Remove label
                        </button>
                        <button
                          onClick={() =>
                            handleLabelAction("add-sublabel", label)
                          }
                          className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Add sublabel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Hidden Labels Section */}
            {showHiddenLabels &&
              apiLabels.filter((label: Label) => !label.isVisible).length >
                0 && (
                <div className="">
                  <div className="px-6 py-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Hidden Labels
                    </span>
                  </div>
                  {apiLabels
                    .filter((label: Label) => !label.isVisible)
                    .map((label: Label, index: number) => {
                      const isActive = currentView === `label:${label.labelUniqueId}`;
                      const isMenuOpen = activeLabelMenu === label.name;

                      // Convert Tailwind color class to custom styl

                      const labelColor = label.color;

                      return (
                        <div
                          key={label.labelUniqueId}
                          className={`sidebar-item relative flex items-center justify-between px-6 py-3 cursor-pointer transition-all duration-200 group ${
                            isActive ? "border-l-4" : ""
                          }`}
                          style={{
                            backgroundColor: isActive
                              ? labelColor + "20"
                              : "transparent", // 20% opacity for active state
                            borderLeftColor: isActive
                              ? labelColor
                              : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor =
                                labelColor + "15"; // 15% opacity
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }
                          }}
                        >
                          <div
                            className="flex items-center space-x-3 flex-1 cursor-pointer"
                            title={`${label.name} (hidden)`}
                            onClick={() => onViewChange(`label:${label.labelUniqueId}`)}
                          >
                            <IconComponent
                              name="tag"
                              className="w-3 h-3 transition-colors"
                              style={{ color: labelColor }}
                            />
                            <span
                              className="font-medium text-sm transition-colors"
                              style={{
                                color: isActive
                                  ? labelColor
                                  : labelColor + "CC", // Full color when active, 80% opacity when inactive
                              }}
                            >
                              {label.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) =>
                                handleLabelMenuClick(label.name, e)
                              }
                              className="p-1 rounded hover:bg-muted transition-colors"
                              style={{
                                backgroundColor: isMenuOpen
                                  ? labelColor + "20"
                                  : "transparent",
                              }}
                              onMouseEnter={(e) => {
                                if (!isMenuOpen) {
                                  e.currentTarget.style.backgroundColor =
                                    labelColor + "20";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isMenuOpen) {
                                  e.currentTarget.style.backgroundColor =
                                    isMenuOpen
                                      ? labelColor + "20"
                                      : "transparent";
                                }
                              }}
                              title="Label options"
                            >
                              <IconComponent
                                name="more-vertical"
                                className="w-3 h-3 transition-colors"
                                style={{ color: labelColor }}
                              />
                            </button>
                          </div>

                          {/* Dropdown Menu for Hidden Labels */}
                          {isMenuOpen && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 bottom-full mb-1 z-50 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
                            >
                              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-gray-200 dark:border-gray-700 relative">
                                <button
                                  onClick={() =>
                                    setShowColorPicker(
                                      showColorPicker === label.labelUniqueId
                                        ? null
                                        : label.labelUniqueId
                                    )
                                  }
                                  className="flex items-center space-x-2 hover:text-gray-900 dark:hover:text-gray-100 w-full text-left"
                                >
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                  ></div>
                                  <span>Label color</span>
                                </button>
                                {showColorPicker === label.labelUniqueId && (
                                  <div className="absolute z-50">
                                    <LabelColorPicker
                                      currentColor={label.color}
                                      onColorChange={(newColor) =>
                                        handleColorChange(
                                          label.labelUniqueId,
                                          newColor
                                        )
                                      }
                                      onClose={() => setShowColorPicker(null)}
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                                In label list
                              </div>
                              <button
                                onClick={() => handleLabelAction("show", label)}
                                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                              >
                                <span className="w-4 h-4 mr-2 text-green-600 font-bold">
                                  ✓
                                </span>
                                Show
                              </button>

                              <div className="px-3 py-2 text-xs text-muted-foreground border-t border-gray-200 dark:border-gray-700 font-medium">
                                In message list
                              </div>
                              <button
                                onClick={() =>
                                  handleLabelAction(
                                    "show-in-message-list",
                                    label
                                  )
                                }
                                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                              >
                                <span className="w-4 h-4 mr-2 text-green-600 font-bold">
                                  {label.showInMessageList ? "✓" : ""}
                                </span>
                                Show
                              </button>
                              <button
                                onClick={() =>
                                  handleLabelAction(
                                    "hide-in-message-list",
                                    label
                                  )
                                }
                                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Hide
                              </button>

                              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                              <button
                                onClick={() => handleLabelAction("edit", label)}
                                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleLabelAction("remove", label)
                                }
                                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Remove label
                              </button>
                              <button
                                onClick={() =>
                                  handleLabelAction("add-sublabel", label)
                                }
                                className="w-full px-3 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Add sublabel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
          </nav>
        </div>
      )}

      {!isExpanded && (
        <div className="flex flex-col items-center py-4 space-y-2">
          {navigationItems.map((item, index) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={index}
                className={`p-2 rounded-lg transition-all duration-200 relative ${
                  isActive ? "bg-accent" : "hover:bg-accent"
                }`}
                title={item.label}
                onClick={() => onViewChange(item.view)}
              >
                <IconComponent
                  name={item.icon}
                  className={`w-4 h-4 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                {item.count && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {item.count.length > 3 ? "99+" : item.count}
                  </span>
                )}
              </button>
            );
          })}

          <button
            className="p-2 rounded-lg hover:bg-accent transition-colors duration-200"
            title="More"
            onClick={() => setMoreExpanded(!moreExpanded)}
          >
            <IconComponent
              name="chevron-down"
              className="w-4 h-4 text-muted-foreground"
            />
          </button>

          <div className="w-6 h-px bg-border"></div>

          <button
            className="p-2 rounded-lg hover:bg-accent transition-colors duration-200"
            title="Create new label"
          >
            <IconComponent
              name="plus"
              className="w-4 h-4 text-muted-foreground"
            />
          </button>
        </div>
      )}

      {/* Input Dialog */}
      <InputDialog
        isOpen={inputDialog.isOpen}
        onClose={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={inputDialog.onConfirm}
        title={inputDialog.title}
        message={inputDialog.message}
        placeholder={inputDialog.placeholder}
      />
    </aside>
  );
}
