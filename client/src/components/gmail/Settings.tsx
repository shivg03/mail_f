import { useState, useEffect, useRef } from "react";
import {
  Check,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Info,
  Type,
  ChevronDown,
  Palette,
} from "lucide-react";
import { useTranslation } from "../../contexts/TranslationContext";
import { useFont } from "../../contexts/FontContext";
import { useFontSize } from "../../contexts/FontSizeContext";
import { useTextColor } from "../../contexts/TextColorContext";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/custom-dialog";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";

interface SettingsProps {
  onClose: () => void;
  onOpenFilters?: () => void;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
  initialSettings?: {
    general?: any;
    labels?: any[];
    account?: any;
    forwarding?: any[];
    blockedAddresses?: any[];
  };
  mailId: string;
}

const inboxOptions = [
  { value: "default", label: "Default" },
  { value: "important", label: "Important markers" },
  { value: "unread", label: "Unread first" },
  { value: "starred", label: "Starred first" },
  { value: "priority", label: "Priority Inbox" },
  { value: "multiple", label: "Multiple Inboxes" },
];

// Add this type above the component
interface ImportMailAndContact {
  providerEmail: string;
  address: string;
  password: string;
  importStatus: string;
  lastImportDate: string | null;
  errorMessage?: string;
}
interface Account {
  importMailAndContact?: ImportMailAndContact;
  // add other account fields as needed
}

export default function Settings({
  onClose,
  onOpenFilters,
  initialTab = "General",
  onTabChange,
  initialSettings,
  mailId,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { language, setLanguage, t } = useTranslation();
  const { currentFont, setCurrentFont } = useFont();
  const { currentFontSize, setCurrentFontSize } = useFontSize();
  const { currentTextColor, setCurrentTextColor } = useTextColor();
  const { toast } = useToast();

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode was previously enabled
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  // Toggle dark mode function
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());

    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.backgroundColor = "#000000"; // pure black
      document.body.style.backgroundColor = "#000000";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    }
  };

  // Staged settings state (changes not applied until save)
  const [stagedLanguage, setStagedLanguage] = useState(language);
  const [stagedFont, setStagedFont] = useState(currentFont);
  const [stagedFontSize, setStagedFontSize] = useState(currentFontSize);
  const [stagedTextColor, setStagedTextColor] = useState(currentTextColor);
  const [enableInputTools, setEnableInputTools] = useState(true);
  const [rightToLeftSupport, setRightToLeftSupport] = useState("off");
  const [conversationsPerPage, setConversationsPerPage] = useState("50");
  const [enableDynamicEmail, setEnableDynamicEmail] = useState(true);
  const [grammarSuggestions, setGrammarSuggestions] = useState("on");
  const [spellingSuggestions, setSpellingSuggestions] = useState("on");
  const [autocorrect, setAutocorrect] = useState("on");
  const [smartCompose, setSmartCompose] = useState("on");
  const [keyboardShortcuts, setKeyboardShortcuts] = useState("off");
  const [inboxType, setInboxType] = useState("default");
  const [signature, setSignature] = useState("");
  const [enableSignature, setEnableSignature] = useState(false);

  // Unsaved changes detection - simplified approach
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [originalSettingsSnapshot, setOriginalSettingsSnapshot] =
    useState<string>("");
  const [isSnapshotReady, setIsSnapshotReady] = useState(false);

  // Blocked addresses state (from API)
  const [blockedAddresses, setBlockedAddresses] = useState<any[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [newBlockedEmail, setNewBlockedEmail] = useState("");

  // New label state
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("bg-blue-400");

  // Add state for the extra fields
  const [newLabelIsVisible, setNewLabelIsVisible] = useState(true);
  const [newLabelShowIfUnread, setNewLabelShowIfUnread] = useState(false);
  const [newLabelShowInMessageList, setNewLabelShowInMessageList] =
    useState(true);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Google Fonts state
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState("");
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);

  // Font size state
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);

  // Text color state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Import mail and contacts state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importProvider, setImportProvider] = useState("yahoo");
  const [importEmail, setImportEmail] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importInProgress, setImportInProgress] = useState(false);

  // Send mail as state
  const [sendAsEmails, setSendAsEmails] = useState([
    {
      id: 1,
      email: "user@gmail.com",
      name: "Gmail User",
      isDefault: true,
      verified: true,
    },
  ]);
  const [showAddEmailDialog, setShowAddEmailDialog] = useState(false);
  const [newSendAsEmail, setNewSendAsEmail] = useState("");
  const [newSendAsName, setNewSendAsName] = useState("");
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [hostIMAP, setHostIMAP] = useState("");
  const [portIMAP, setPortIMAP] = useState("");
  const [connectionTypeIMAP, setConnectionTypeIMAP] = useState("SSL");

  // Forwarding state
  const [forwardingAddresses, setForwardingAddresses] = useState<
    { id: number; email: string; verified: boolean; enabled: boolean }[]
  >([]);
  const [showAddForwardingDialog, setShowAddForwardingDialog] = useState(false);
  const [newForwardingEmail, setNewForwardingEmail] = useState("");
  const [forwardingOption, setForwardingOption] = useState("disable"); // disable, forward, archive

  // System labels visibility state
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
  });
  const [editingLabel, setEditingLabel] = useState<number | null>(null);

  // Add new state for each tab
  const [theme, setTheme] = useState("light");
  const [labels, setLabels] = useState<any[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [blockSenders, setBlockSenders] = useState(false);
  const [blockDomains, setBlockDomains] = useState(false);

  // Add state for custom labels
  const [customLabels, setCustomLabels] = useState<any[]>([]);

  // Initialize dark mode on mount
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.backgroundColor = "#000000";
      document.body.style.backgroundColor = "#000000";
    }
  }, []);

  // Load settings from localStorage on component mount and create original snapshot
  useEffect(() => {
    const savedSettings = localStorage.getItem("gmailSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setEnableInputTools(settings.enableInputTools ?? true);
      setRightToLeftSupport(settings.rightToLeftSupport ?? "off");
      setConversationsPerPage(settings.conversationsPerPage ?? "50");
      setStagedFont(settings.defaultTextStyle ?? "Poppins");
      setEnableDynamicEmail(settings.enableDynamicEmail ?? true);
      setGrammarSuggestions(settings.grammarSuggestions ?? "on");
      setSpellingSuggestions(settings.spellingSuggestions ?? "on");
      setAutocorrect(settings.autocorrect ?? "on");
      setSmartCompose(settings.smartCompose ?? "on");
      setKeyboardShortcuts(settings.keyboardShortcuts ?? "off");
      setInboxType(settings.inboxType ?? "default");
      setSignature(settings.signature ?? "");
      setEnableSignature(settings.enableSignature ?? false);
    }
  }, [language, currentFont, currentFontSize, currentTextColor]);

  // Create initial snapshot only once after all state is loaded
  useEffect(() => {
    if (
      stagedLanguage &&
      stagedFont &&
      stagedFontSize &&
      stagedTextColor &&
      !isSnapshotReady
    ) {
      const timer = setTimeout(() => {
        const currentSnapshot = JSON.stringify({
          stagedLanguage,
          stagedFont,
          stagedFontSize,
          stagedTextColor,
          enableInputTools,
          rightToLeftSupport,
          conversationsPerPage,
          enableDynamicEmail,
          grammarSuggestions,
          spellingSuggestions,
          autocorrect,
          smartCompose,
          keyboardShortcuts,
          signature,
          enableSignature,
          inboxType,
          forwardingOption,
          forwardingAddresses,
          blockedAddresses,
          sendAsEmails,
          systemLabelsVisibility,
        });
        setOriginalSettingsSnapshot(currentSnapshot);
        setIsSnapshotReady(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [
    stagedLanguage,
    stagedFont,
    stagedFontSize,
    stagedTextColor,
    isSnapshotReady,
  ]);

  // Track changes by comparing current state with original snapshot
  useEffect(() => {
    if (isSnapshotReady && originalSettingsSnapshot) {
      const currentSnapshot = JSON.stringify({
        stagedLanguage,
        stagedFont,
        stagedFontSize,
        stagedTextColor,
        enableInputTools,
        rightToLeftSupport,
        conversationsPerPage,
        enableDynamicEmail,
        grammarSuggestions,
        spellingSuggestions,
        autocorrect,
        smartCompose,
        keyboardShortcuts,
        signature,
        enableSignature,
        inboxType,
        forwardingOption,
        forwardingAddresses,
        blockedAddresses,
        sendAsEmails,
        systemLabelsVisibility,
      });

      setHasUnsavedChanges(currentSnapshot !== originalSettingsSnapshot);
    }
  }, [
    isSnapshotReady,
    originalSettingsSnapshot,
    stagedLanguage,
    stagedFont,
    stagedFontSize,
    stagedTextColor,
    enableInputTools,
    rightToLeftSupport,
    conversationsPerPage,
    enableDynamicEmail,
    grammarSuggestions,
    spellingSuggestions,
    autocorrect,
    smartCompose,
    keyboardShortcuts,
    signature,
    enableSignature,
    inboxType,
    forwardingOption,
    forwardingAddresses,
    blockedAddresses,
    sendAsEmails,
    systemLabelsVisibility,
  ]);

  // Load system labels visibility with new defaults
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
      // Save the merged settings back to localStorage
      localStorage.setItem(
        "systemLabelsVisibility",
        JSON.stringify(mergedVisibility)
      );
    } else {
      // Save defaults if no settings exist
      localStorage.setItem(
        "systemLabelsVisibility",
        JSON.stringify(defaultVisibility)
      );
    }
  }, []);

  // Click outside handler for font size menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fontSizeMenuRef.current &&
        !fontSizeMenuRef.current.contains(event.target as Node)
      ) {
        setShowFontSizeMenu(false);
      }
    };

    if (showFontSizeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFontSizeMenu]);

  // Click outside handler for color picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showColorPicker]);

  // Load comprehensive font list on component mount
  useEffect(() => {
    const loadFonts = () => {
      if (availableFonts.length > 0) return; // Already loaded

      setFontsLoading(true);

      // Comprehensive list of popular fonts including system fonts, web-safe fonts, and Google Fonts
      const comprehensiveFontList = [
        // System/Web-safe fonts
        "Arial",
        "Arial Black",
        "Arial Narrow",
        "Arial Rounded MT Bold",
        "Calibri",
        "Cambria",
        "Candara",
        "Century Gothic",
        "Comic Sans MS",
        "Consolas",
        "Constantia",
        "Corbel",
        "Courier New",
        "Franklin Gothic Medium",
        "Garamond",
        "Georgia",
        "Helvetica",
        "Helvetica Neue",
        "Impact",
        "Lucida Console",
        "Lucida Grande",
        "Lucida Sans Unicode",
        "Microsoft Sans Serif",
        "Palatino",
        "Segoe UI",
        "Tahoma",
        "Times",
        "Times New Roman",
        "Trebuchet MS",
        "Verdana",

        // Popular Google Fonts
        "Roboto",
        "Open Sans",
        "Lato",
        "Montserrat",
        "Source Sans Pro",
        "Oswald",
        "Raleway",
        "PT Sans",
        "Lora",
        "Merriweather",
        "Nunito Sans",
        "Poppins",
        "Playfair Display",
        "Fira Sans",
        "Inter",
        "Noto Sans",
        "Ubuntu",
        "Work Sans",
        "Libre Baskerville",
        "Crimson Text",
        "Droid Sans",
        "PT Serif",
        "Source Serif Pro",
        "Libre Franklin",
        "Nunito",
        "Quicksand",
        "Rubik",
        "Karla",
        "Hind",
        "Barlow",
        "Titillium Web",
        "Dancing Script",
        "Pacifico",
        "Lobster",
        "Great Vibes",
        "Satisfy",
        "Indie Flower",
        "Amatic SC",
        "Shadows Into Light",
        "Kaushan Script",
        "Permanent Marker",
        "Abril Fatface",
        "Bebas Neue",
        "Anton",
        "Righteous",
        "Fjalla One",
        "Passion One",
        "Exo",
        "Exo 2",
        "Cabin",
        "Muli",
        "Oxygen",
        "Source Code Pro",
        "Dosis",
        "PT Sans Narrow",
        "Bitter",
        "Arvo",
        "Vollkorn",
        "Alegreya",
        "Francois One",
        "Asap",
        "Varela Round",
        "Questrial",
        "Ropa Sans",
        "ABeeZee",
        "Acme",
        "Actor",
        "Adamina",
        "Advent Pro",
        "Aguafina Script",
        "Akronim",
        "Aladin",
        "Aldrich",
        "Alef",
        "Alegreya Sans",
        "Alex Brush",
        "Alfa Slab One",
        "Alice",
        "Alike",
        "Allan",
        "Allerta",
        "Allerta Stencil",
        "Allura",
        "Almendra",
        "Almendra Display",
        "Almendra SC",
        "Amarante",
        "Amaranth",
        "Amatic SC",
        "Amethysta",
        "Amiri",
        "Amita",
        "Anaheim",
        "Andada",
        "Andika",
        "Annie Use Your Telescope",
        "Anonymous Pro",
        "Antic",
        "Antic Didone",
        "Antic Slab",
        "Architects Daughter",
        "Archivo",
        "Archivo Black",
        "Archivo Narrow",
        "Aref Ruqaa",
        "Arima Madurai",
        "Arsenal",
        "Artifika",
        "Arvo",
        "Asap Condensed",
        "Asar",
        "Asset",
        "Assistant",
        "Astloch",
        "Asul",
        "Athiti",
        "Atma",
        "Atomic Age",
        "Aubrey",
        "Audiowide",
        "Autour One",
        "Average",
        "Average Sans",
        "Averia Gruesa Libre",
        "Averia Libre",
        "Averia Sans Libre",
        "Averia Serif Libre",
        "Bad Script",
        "Bahiana",
        "Bai Jamjuree",
        "Baloo",
        "Baloo Bhai",
        "Baloo Bhaina",
        "Baloo Chettan",
        "Baloo Da",
        "Baloo Paaji",
        "Baloo Tamma",
        "Baloo Tammudu",
        "Baloo Thambi",
        "Balthazar",
        "Bangers",
        "Barrio",
        "Basic",
        "Battambang",
        "Baumans",
        "Bayon",
        "Be Vietnam",
        "Belgrano",
        "Belleza",
        "BenchNine",
        "Bentham",
        "Berkshire Swash",
        "Bevan",
        "Bigelow Rules",
        "Bigshot One",
        "Bilbo",
        "Bilbo Swash Caps",
        "BioRhyme",
        "BioRhyme Expanded",
        "Biryani",
        "Black Ops One",
        "Bokor",
        "Bonbon",
        "Boogaloo",
        "Bowlby One",
        "Bowlby One SC",
        "Brawler",
        "Bree Serif",
        "Bubblegum Sans",
      ];

      // Remove duplicates and sort
      const uniqueFonts = Array.from(new Set(comprehensiveFontList)).sort();
      setAvailableFonts(uniqueFonts);
      setFontsLoading(false);
    };

    loadFonts();
  }, [availableFonts.length]);

  // Fetch custom labels from /label/getLabels
  async function fetchCustomLabels() {
    try {
      if (!mailId) return;
      const res = await apiRequest("POST", "/label/getLabels", {
        mail_id: mailId,
      });
      console.log("Setting Labels", res.data);
      setCustomLabels(res.data || []);
      console.log("Fetched custom labels:", res.data);
    } catch (err) {
      console.error("Error fetching custom labels:", err);
    }
  }

  useEffect(() => {
    fetchCustomLabels();
  }, [mailId]);

  // Handle close with unsaved changes check
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  // Handle confirm discard changes
  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    onClose();
  };

  // Handle cancel discard
  const handleCancelDiscard = () => {
    setShowDiscardDialog(false);
  };

  // Save settings to localStorage and apply to contexts
  const saveSettings = () => {
    // Apply staged values to actual contexts
    setLanguage(stagedLanguage);
    setCurrentFont(stagedFont);
    setCurrentFontSize(stagedFontSize);
    setCurrentTextColor(stagedTextColor);

    const settings = {
      enableInputTools,
      rightToLeftSupport,
      conversationsPerPage,
      defaultTextStyle: stagedFont,
      enableDynamicEmail,
      grammarSuggestions,
      spellingSuggestions,
      autocorrect,
      smartCompose,
      keyboardShortcuts,
      inboxType,
      signature,
      enableSignature,
    };
    localStorage.setItem("gmailSettings", JSON.stringify(settings));

    // Update original snapshot to match saved state
    const newSnapshot = JSON.stringify({
      stagedLanguage,
      stagedFont,
      stagedFontSize,
      stagedTextColor,
      enableInputTools,
      rightToLeftSupport,
      conversationsPerPage,
      enableDynamicEmail,
      grammarSuggestions,
      spellingSuggestions,
      autocorrect,
      smartCompose,
      keyboardShortcuts,
      signature,
      enableSignature,
      inboxType,
      forwardingOption,
      forwardingAddresses,
      blockedAddresses,
      sendAsEmails,
      systemLabelsVisibility,
    });
    setOriginalSettingsSnapshot(newSnapshot);
    setHasUnsavedChanges(false);
    toast({
      title: t.saveChanges,
      description: "Settings have been saved successfully.",
    });
  };

  // Remove auto-save to ensure proper unsaved changes detection

  // Create label mutation
  const createLabelMutation = useMutation({
    mutationFn: async (args: {
      mail_id: string;
      name: string;
      color: string;
      isVisible?: boolean;
      showIfUnread?: boolean;
      showInMessageList?: boolean;
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
      // Refetch custom labels after creation
      fetchCustomLabels();
      // Invalidate LeftSidebar label query
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
      setNewLabelName("");
      setNewLabelColor(hexColorOptions[0].value);
    },
    onError: (error) => {
      console.error("Error creating label:", error);
    },
  });

  // Update label mutation
  const updateLabelMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      name?: string;
      color?: string;
      isVisible?: boolean;
      showIfUnread?: boolean;
    }) => {
      return apiRequest("PATCH", `/api/labels/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/labels"] });
      setEditingLabel(null);
      toast({
        title: "Label updated",
        description: "Label has been updated successfully.",
      });
    },
  });

  // Delete label mutation
  const deleteLabelMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/labels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/labels"] });
      toast({
        title: "Label deleted",
        description: "Label has been deleted successfully.",
      });
    },
  });

  // When creating a label, pick a random color from hexColorOptions
  const getRandomHexColor = () => {
    const idx = Math.floor(Math.random() * hexColorOptions.length);
    return hexColorOptions[idx].value;
  };

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      createLabelMutation.mutate({
        mail_id: mailId,
        name: newLabelName.trim(),
        color: getRandomHexColor(), // pick random color
        isVisible: newLabelIsVisible,
        showIfUnread: newLabelShowIfUnread,
        showInMessageList: newLabelShowInMessageList,
      });
    }
  };

  const handleUpdateLabel = (
    id: number,
    updates: {
      name?: string;
      color?: string;
      isVisible?: boolean;
      showIfUnread?: boolean;
    }
  ) => {
    updateLabelMutation.mutate({ id, ...updates });
  };

  const handleDeleteLabel = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Label",
      message: "Are you sure you want to delete this label?",
      onConfirm: () => deleteLabelMutation.mutate(id),
    });
  };

  const handleSystemLabelVisibility = (key: string, isVisible: boolean) => {
    setSystemLabelsVisibility((prev) => ({
      ...prev,
      [key]: isVisible,
    }));

    // Save to localStorage for persistence
    const updatedVisibility = { ...systemLabelsVisibility, [key]: isVisible };
    localStorage.setItem(
      "systemLabelsVisibility",
      JSON.stringify(updatedVisibility)
    );

    // Dispatch custom event for same-tab synchronization
    window.dispatchEvent(
      new CustomEvent("systemLabelsVisibilityChanged", {
        detail: updatedVisibility,
      })
    );
  };

  const handleToggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setBlockedAddresses((prev) =>
      prev.map((addr) => ({ ...addr, selected: newSelectAll }))
    );
  };

  const handleToggleAddress = (id: number) => {
    setBlockedAddresses((prev) =>
      prev.map((addr) =>
        addr.id === id ? { ...addr, selected: !addr.selected } : addr
      )
    );
  };

  // Normalization helper
  const normalizeBlockedAddresses = (addresses: (string | { id: number; email: string; selected?: boolean })[]): { id: number; email: string; selected: boolean }[] => {
    return addresses.map((addr: string | { id: number; email: string; selected?: boolean }, idx: number) =>
      typeof addr === "string"
        ? { id: idx + 1, email: addr, selected: false }
        : { ...addr, selected: false }
    );
  };

  // Update handleAddBlockedEmail to always send objects
  const handleAddBlockedEmail = async () => {
    if (newBlockedEmail.trim() && newBlockedEmail.includes("@")) {
      const newId = Math.max(...blockedAddresses.map((addr) => addr.id), 0) + 1;
      const newBlocked = {
        id: newId,
        email: newBlockedEmail.trim(),
        selected: false,
      };
      const updatedAddresses = [...blockedAddresses, newBlocked];

      // Call the API with objects
      await apiRequest("POST", "/setting/blocked-addresses", {
        mail_Id: mailId,
        blockedAddresses: {
          addresses: updatedAddresses.map(addr => ({ id: addr.id, email: addr.email })),
          blockSenders: true,
          blockDomains: false,
        }
      });

      setBlockedAddresses(updatedAddresses);
      setNewBlockedEmail("");
      toast({
        title: "Email blocked",
        description: "Email address has been added to blocked list.",
      });
    }
  };

  // Update unblock logic to send objects as well
  const handleUnblockSelected = async () => {
    const selectedIds = blockedAddresses
      .filter((addr) => addr.selected)
      .map((addr) => addr.id);
    if (selectedIds.length > 0) {
      const updatedAddresses = blockedAddresses.filter((addr) => !selectedIds.includes(addr.id));
      await apiRequest("POST", "/setting/blocked-addresses", {
        mail_Id: mailId,
        blockedAddresses: {
          addresses: updatedAddresses.map(addr => ({ id: addr.id, email: addr.email })),
          blockSenders: true,
          blockDomains: false,
        }
      });
      setBlockedAddresses(updatedAddresses);
      setSelectAll(false);
      toast({
        title: "Addresses unblocked",
        description: `${selectedIds.length} address(es) have been unblocked.`,
      });
    }
  };

  // Import mail handlers
  const handleImportMail = async () => {
    if (!importEmail.trim() || !importPassword.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both email and password.",
      });
      return;
    }

    setImportInProgress(true);

    // Simulate import process
    setTimeout(() => {
      setImportInProgress(false);
      setShowImportDialog(false);
      setImportEmail("");
      setImportPassword("");
      toast({
        title: "Import completed",
        description: `Successfully imported mail and contacts from ${importProvider}.`,
      });
    }, 2000);
  };

  // Send mail as handlers
  const handleAddSendAsEmail = () => {
    if (!newSendAsEmail.trim() || !newSendAsName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both name and email address.",
      });
      return;
    }

    if (!newSendAsEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    const newId = Math.max(...sendAsEmails.map((email) => email.id), 0) + 1;
    setSendAsEmails((prev) => [
      ...prev,
      {
        id: newId,
        email: newSendAsEmail.trim(),
        name: newSendAsName.trim(),
        isDefault: false,
        verified: false,
      },
    ]);

    setNewSendAsEmail("");
    setNewSendAsName("");
    setShowAddEmailDialog(false);

    toast({
      title: "Email address added",
      description:
        "A verification email has been sent. Please check your inbox.",
    });
  };

  const handleSetDefaultSendAs = (emailId: number) => {
    setSendAsEmails((prev) =>
      prev.map((email) => ({
        ...email,
        isDefault: email.id === emailId,
      }))
    );

    toast({
      title: "Default email updated",
      description: "Default send-as email address has been changed.",
    });
  };

  const handleDeleteSendAsEmail = (emailId: number) => {
    setSendAsEmails((prev) => prev.filter((email) => email.id !== emailId));

    toast({
      title: "Email address removed",
      description: "Send-as email address has been removed.",
    });
  };

  // Forwarding handlers
  const handleAddForwardingAddress = async () => {
    if (!newForwardingEmail.trim() || !newForwardingEmail.includes("@")) return;
    const newId = Math.max(...forwardingAddresses.map(addr => addr.id), 0) + 1;
    const newAddressObj = {
      id: newId,
      email: newForwardingEmail.trim(),
      verified: false,
      enabled: false,
    };
    const updatedAddresses = [...forwardingAddresses, newAddressObj];
    setForwardingAddresses(updatedAddresses);
    await apiRequest("POST", "/setting/forwarding", {
      mail_Id: mailId,
      forwarding: { addresses: updatedAddresses },
    });
    setShowForwardingDialog(false);
    // Optionally refetch forwarding settings here
  };

  const handleDeleteForwardingAddress = (addressId: number) => {
    setForwardingAddresses((prev) =>
      prev.filter((addr) => addr.id !== addressId)
    );

    toast({
      title: "Forwarding address removed",
      description: "Forwarding address has been removed.",
    });
  };

  const handleToggleForwarding = (addressId: number) => {
    setForwardingAddresses((prev) =>
      prev.map((addr) =>
        addr.id === addressId ? { ...addr, enabled: !addr.enabled } : addr
      )
    );
  };

  const handleVerifyForwarding = (addressId: number) => {
    setForwardingAddresses((prev) =>
      prev.map((addr) =>
        addr.id === addressId ? { ...addr, verified: true } : addr
      )
    );

    toast({
      title: "Address verified",
      description: "Forwarding address has been verified successfully.",
    });
  };

  const tabs = [
    { key: "General", label: t.general },
    { key: "Labels", label: t.labels },
    { key: "Inbox", label: t.inbox },
    { key: "Accounts", label: t.accounts },
    { key: "Forwarding", label: t.forwarding },
  ];

  const languageOptions = [
    {
      group: t.defaultLanguage,
      options: [{ value: "English", label: "English" }],
    },
    {
      group: t.indianLanguages,
      options: [
        { value: "Hindi", label: "हिन्दी" },
        { value: "Marathi", label: "मराठी" },
        { value: "Gujarati", label: "ગુજરાતી" },
        { value: "Tamil", label: "தமிழ்" },
        { value: "Telugu", label: "తెలుగు" },
        { value: "Kannada", label: "ಕನ್ನಡ" },
        { value: "Malyalam", label: "മലയാളം" },
        { value: "Bengali", label: "বাংলা" },
        { value: "Punjabi", label: "ਪੰਜਾਬੀ" },
      ],
    },
    {
      group: t.otherLanguages,
      options: [
        { value: "Spanish", label: "Español" },
        { value: "German", label: "Deutsch" },
        { value: "French", label: "Français" },
        { value: "Korean", label: "한국어" },
        { value: "Japan", label: "日本語" },
      ],
    },
  ];

  const conversationOptions = [
    { value: "25", label: "25" },
    { value: "50", label: "50" },
    { value: "100", label: "100" },
  ];

  const hexColorOptions = [
    { value: "#60a5fa", label: "Blue" }, // blue-400
    { value: "#a78bfa", label: "Purple" }, // purple-400
    { value: "#f472b6", label: "Pink" }, // pink-400
    { value: "#f87171", label: "Red" }, // red-400
    { value: "#34d399", label: "Green" }, // green-400
    { value: "#fbbf24", label: "Yellow" }, // yellow-400
    { value: "#facc15", label: "Gold" }, // gold
    { value: "#818cf8", label: "Indigo" }, // indigo-400
    { value: "#a3e635", label: "Lime" }, // lime-400
    { value: "#fcd34d", label: "Amber" }, // amber-400
    { value: "#6b7280", label: "Gray" }, // gray-500
    { value: "#000000", label: "Black" }, // black
  ];

  const providerOptions = [
    { value: "yahoo", label: "Yahoo Mail" },
    { value: "outlook", label: "Outlook.com" },
    { value: "hotmail", label: "Hotmail" },
    { value: "aol", label: "AOL" },
    { value: "other", label: "Other" },
  ];

  // Call onTabChange when activeTab changes
  useEffect(() => {
    if (onTabChange) {
      onTabChange(activeTab);
    }
  }, [activeTab, onTabChange]);

  // Add this effect after all state declarations
  useEffect(() => {
    const apiSettings: any = initialSettings;
    console.log("API setting received:", apiSettings);
    if (apiSettings) {
      // General
      if (apiSettings.general) {
        // Theme (for toggle)
        setIsDarkMode(apiSettings.general.theme === "dark");
        // Language
        setStagedLanguage(apiSettings.general.language ?? "English");
        if (apiSettings.general.language) {
          setLanguage(apiSettings.general.language); // Ensure translation context matches backend
        }
        // Right-to-left editing support
        setRightToLeftSupport(
          apiSettings.general.rightToLeftEditing ? "on" : "off"
        );
        // Page size
        setConversationsPerPage(
          apiSettings.general.selectedPageSize?.toString() ?? "50"
        );
        // Default text style
        setStagedFont(
          apiSettings.general.defaultTextStyle?.fontStyle ?? "Poppins"
        );
        setCurrentFont(
          apiSettings.general.defaultTextStyle?.fontStyle ?? "Poppins"
        ); // Apply font on refresh
        setStagedTextColor(
          apiSettings.general.defaultTextStyle?.textColor ?? "#000000"
        );
        setCurrentTextColor(
          apiSettings.general.defaultTextStyle?.textColor ?? "#000000"
        ); // Apply color on refresh
        // Booleans as radio/toggle
        setGrammarSuggestions(apiSettings.general.grammar ? "on" : "off");
        setSpellingSuggestions(apiSettings.general.spelling ? "on" : "off");
        setAutocorrect(apiSettings.general.autocorrect ? "on" : "off");
        setSmartCompose(apiSettings.general.smartCompose ? "on" : "off");
        setKeyboardShortcuts(
          apiSettings.general.keyboardShortcuts ? "on" : "off"
        );
        // Signature
        setSignature(apiSettings.general.signature?.text ?? "");
        setEnableSignature(apiSettings.general.signature?.enabled ?? false);
      }
      // Labels
      if (apiSettings.labels) {
        setLabels(
          Array.isArray(apiSettings.labels)
            ? apiSettings.labels
            : Object.values(apiSettings.labels)
        );
      }
      if (apiSettings.labels && apiSettings.labels.systemLabelsVisibility) {
        setSystemLabelsVisibility(apiSettings.labels.systemLabelsVisibility);
        console.log(
          "systemLabelsVisibility set in state:",
          apiSettings.labels.systemLabelsVisibility
        ); // Debug log
      }
      // Account
      if (apiSettings.account) {
        setAccount(apiSettings.account);
      }
      // Forwarding
      if (apiSettings.forwarding) {
        if (
          typeof apiSettings.forwarding === "object" &&
          !Array.isArray(apiSettings.forwarding)
        ) {
          setForwardingAddresses(apiSettings.forwarding.addresses || []);
          setBlockSenders(apiSettings.forwarding.blockSenders || false);
          setBlockDomains(apiSettings.forwarding.blockDomains || false);
        }
      }
      // Blocked Addresses
      if (apiSettings.blockedAddresses) {
        if (Array.isArray(apiSettings.blockedAddresses)) {
          setBlockedAddresses(apiSettings.blockedAddresses);
          setBlockSenders(false);
          setBlockDomains(false);
        } else if (
          typeof apiSettings.blockedAddresses === "object" &&
          apiSettings.blockedAddresses !== null &&
          !Array.isArray(apiSettings.blockedAddresses)
        ) {
          setBlockedAddresses(apiSettings.blockedAddresses.addresses || []);
          setBlockSenders(apiSettings.blockedAddresses.blockSenders || false);
          setBlockDomains(apiSettings.blockedAddresses.blockDomains || false);
        }
      }
    }
  }, [initialSettings]);

  // Add updateSettings function
  const updateSettings = async (section: string, data: any) => {
    console.log("Calling updateSettings", section, data);
    try {
      const res = await apiRequest("PATCH", "/setting/updateSetting", {
        mail_Id: mailId,
        section,
        data,
      });
      if (section === "general") {
        if (data.language) {
          setLanguage(data.language); // update the app's language
          console.log("Language context updated to", data.language);
        }
        setCurrentFont(stagedFont); // Apply font immediately after save
        setCurrentTextColor(stagedTextColor); // Apply color immediately after save
        // Update snapshot and unsaved state after saving general settings
        const newSnapshot = JSON.stringify({
          stagedLanguage,
          stagedFont,
          stagedFontSize,
          stagedTextColor,
          enableInputTools,
          rightToLeftSupport,
          conversationsPerPage,
          enableDynamicEmail,
          grammarSuggestions,
          spellingSuggestions,
          autocorrect,
          smartCompose,
          keyboardShortcuts,
          signature,
          enableSignature,
          inboxType,
          forwardingOption,
          forwardingAddresses,
          blockedAddresses,
          sendAsEmails,
          systemLabelsVisibility,
        });
        setOriginalSettingsSnapshot(newSnapshot);
        setHasUnsavedChanges(false);
        console.log(
          "Snapshot updated and unsaved changes reset after saving general settings"
        );
      }
      toast({
        title: t.saveChanges,
        description: res.data.message || "Settings updated successfully",
      });
    } catch (err) {
      toast({
        title: t.error || "Error",
        description: (err as Error).message || "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  const handleImportSubmit = async () => {
    try {
      await apiRequest("POST", "/import/import-emails", {
        userEmail,
        password: imapPassword,
        hostIMAP,
        portIMAP,
        connectionTypeIMAP,
        mail_id: mailId,
      });
      setShowImportDialog(false);
      setUserEmail("");
      setImapPassword("");
      setHostIMAP("");
      setPortIMAP("");
      setConnectionTypeIMAP("SSL");
      // Optionally show toast or refetch
    } catch (err) {
      // Optionally show error toast
    }
  };

  // Add these state hooks near the top of the component, if not already present
  const [providerEmail, setProviderEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");

  // Prefill import dialog fields when opening
  const handleOpenImportDialog = () => {
    setProviderEmail(account?.importMailAndContact?.providerEmail || "");
    setAddress(account?.importMailAndContact?.address || "");
    setPassword(""); // Never prefill password for security
    setShowImportDialog(true);
  };

  // State for Forwarding modal and addresses
  const [showForwardingDialog, setShowForwardingDialog] = useState(false);

  // Open modal
  const handleOpenForwardingDialog = () => {
    setNewForwardingEmail("");
    setShowForwardingDialog(true);
  };

  // Add this handler
  const handleUnblockAddress = async (addressId: number) => {
    await apiRequest("DELETE", "/setting/unblocked-addresses", {
      mail_Id: mailId,
      addressId,
    });
    setBlockedAddresses(prev => prev.filter(addr => addr.id !== addressId));
    toast({
      title: "Email unblocked",
      description: "Email address has been removed from blocked list.",
    });
  };

  // Add state for new fields


  return (
    <div className="flex-1 bg-background overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-4 py-2 md:py-[9px] border-b bg-white dark:bg-black">
          <h1 className="text-lg sm:text-xl font-normal dark:text-white">
            {t.settings}
          </h1>
          <div className="flex items-center space-x-2">
            <button className="p-1 hover:bg-gray-100 dark:hover:bg-accent rounded">
              <svg
                className="w-4 h-4 text-muted-foreground dark:text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-accent rounded"
            >
              <svg
                className="w-4 h-4 text-muted-foreground dark:text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-white dark:bg-black">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors min-w-fit ${
                  activeTab === tab.key
                    ? "border-[#ffa184] text-[#ffa184] dark:text-[#ffa184]"
                    : "border-transparent dark:text-white hover:bg-gray-100 dark:hover:bg-accent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {activeTab === "General" && (
            <div className="space-y-6 sm:space-y-8 max-w-none">
              {/* Theme */}
              <div className="border-b pb-4 sm:pb-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium dark:text-white">
                    {t.Theme}:
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Animated Theme Toggle */}
                      <button
                        onClick={toggleDarkMode}
                        className="relative inline-flex items-center w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#ffa184] focus:ring-offset-2"
                        title={
                          isDarkMode
                            ? "Switch to Light Mode"
                            : "Switch to Dark Mode"
                        }
                      >
                        {/* Track */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#ffa184] via-[#ffc3a0] to-[#ff6b6b] dark:from-[#ffa184] dark:via-[#ffc3a0] dark:to-[#ff6b6b] opacity-80"></div>

                        {/* Sliding Button */}
                        <div
                          className={`relative z-10 inline-flex items-center justify-center w-6 h-6 bg-gray-800 rounded-full shadow-lg transform transition-all duration-300 ease-in-out ${
                            isDarkMode ? "translate-x-9" : "translate-x-1"
                          }`}
                        >
                          {/* Icon */}
                          <div className="relative w-4 h-4">
                            {/* Moon Icon (Light Mode) */}
                            <svg
                              className={`absolute inset-0 w-4 h-4 text-gray-100 transition-all duration-300 ${
                                isDarkMode
                                  ? "opacity-0 rotate-180 scale-0"
                                  : "opacity-100 rotate-0 scale-100"
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>

                            {/* Sun Icon (Dark Mode) */}
                            <svg
                              className={`absolute inset-0 w-4 h-4 text-yellow-500 transition-all duration-300 ${
                                isDarkMode
                                  ? "opacity-100 rotate-0 scale-100"
                                  : "opacity-0 rotate-180 scale-0"
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                              />
                            </svg>
                          </div>
                        </div>

                        {/* Background Icons for Visual Enhancement */}
                        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                          {/* Moon background */}
                          <div
                            className={`transition-opacity duration-300 ${
                              isDarkMode ? "opacity-30" : "opacity-60"
                            }`}
                          >
                            <svg
                              className="w-3 h-3 text-gray-300"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>
                          </div>

                          {/* Sun background */}
                          <div
                            className={`transition-opacity duration-300 ${
                              isDarkMode ? "opacity-60" : "opacity-30"
                            }`}
                          >
                            <svg
                              className="w-3 h-3 text-yellow-200"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                              />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t.current}:{" "}
                      <span className="font-medium dark:text-white">
                        {isDarkMode ? t.darkmode : t.lightmode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Language */}
              <div className="border-b pb-4 sm:pb-6">
                <div className="flex flex-col space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <label className="text-sm font-medium dark:text-white">
                      {t.language}:
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {t.gmailDisplayLanguage}:
                        </span>
                        {/* Language dropdown rendering (flat list) */}
                        <Listbox
                          value={stagedLanguage}
                          onChange={setStagedLanguage}
                        >
                          <div className="relative mt-1 w-56">
                            <Listbox.Button className="relative w-full cursor-default rounded border bg-white dark:bg-black py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ffa184] sm:text-sm">
                              <span className="block truncate dark:text-white">
                                {languageOptions
                                  .flatMap((group) => group.options)
                                  .find((opt) => opt.value === stagedLanguage)
                                  ?.label || stagedLanguage}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <ChevronUpDownIcon
                                  className="h-5 w-5 text-gray-400"
                                  aria-hidden="true"
                                />
                              </span>
                            </Listbox.Button>
                            <Listbox.Options className="absolute border z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-black py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-0 sm:text-sm">
                              {languageOptions.map((group) => (
                                <div key={group.group}>
                                  <div className="px-4 py-2 text-xs font-semibold dark:text-white">
                                    {group.group}
                                  </div>
                                  {group.options.map((option) => (
                                    <Listbox.Option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {({ active, selected }) => (
                                        <div
                                          className={`relative cursor-default select-none py-2 pl-10 pr-4 ${
                                            active || selected
                                              ? "bg-accent dark:text-white"
                                              : "dark:text-white"
                                          }`}
                                        >
                                          <span
                                            className={`block truncate ${
                                              selected
                                                ? "font-medium"
                                                : "font-normal"
                                            } dark:text-white`}
                                          >
                                            {option.label}
                                          </span>
                                        </div>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </div>
                              ))}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>
                      {/* <a href="#" className="text-[#ffa184] dark:text-blue-400 hover:underline text-sm break-words">Change language settings for other Google products</a> */}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex items-start space-x-2 flex-shrink-0">
                      <input
                        type="checkbox"
                        id="inputTools"
                        checked={enableInputTools}
                        onChange={(e) => setEnableInputTools(e.target.checked)}
                        className="rounded  mt-0.5 accent-[#ffa184]"
                      />
                    </div>
                    <label
                      htmlFor="inputTools"
                      className="text-sm dark:text-white flex-1"
                    >
                      <strong>{t.enableInputTools}</strong> - Use various text
                      input tools to type in the language of your choice
                      {/* <a
                        href="#"
                        className="text-[#ffa184] dark:text-[#ffa184] hover:underline"
                      >
                        {t.editTools}
                      </a>{" "}
                      -
                      <a
                        href="#"
                        className="text-[#ffa184] dark:text-[#ffa184] hover:underline"
                      >
                        {t.learnMore}
                      </a> */}
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium dark:text-white mb-2">
                      {t.rightToLeftSupport}:
                    </div>
                    <div className="space-y-2 ml-0 sm:ml-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="rightToLeft"
                          value="on"
                          checked={rightToLeftSupport === "on"}
                          onChange={(e) =>
                            setRightToLeftSupport(e.target.value)
                          }
                          className="mr-2 flex-shrink-0 accent-[#ffa184]"
                        />
                        <span className="text-sm dark:text-white">
                          {t.rightToLeftSupport} {t.on}
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="rightToLeft"
                          value="off"
                          checked={rightToLeftSupport === "off"}
                          onChange={(e) =>
                            setRightToLeftSupport(e.target.value)
                          }
                          className="mr-2 flex-shrink-0 accent-[#ffa184]"
                        />
                        <span className="text-sm dark:text-white">
                          {t.rightToLeftSupport} {t.off}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maximum page size */}
              <div className="border-b pb-4 sm:pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <label className="text-sm font-medium dark:text-white">
                    {t.maximumPageSize}:
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t.show}
                    </span>

                    {/* Listbox */}
                    <Listbox
                      value={conversationsPerPage}
                      onChange={setConversationsPerPage}
                    >
                      <div className="relative w-full sm:w-auto">
                        <Listbox.Button className="relative w-full cursor-default rounded border bg-white dark:bg-black py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ffa184] sm:text-sm">
                          <span className="block truncate dark:text-white">
                            {conversationsPerPage}
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronUpDownIcon
                              className="h-5 w-5 text-gray-400"
                              aria-hidden="true"
                            />
                          </span>
                        </Listbox.Button>

                        <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto border rounded-md bg-white dark:bg-black py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {conversationOptions.map((option) => (
                            <Listbox.Option
                              key={option.value}
                              value={option.value}
                            >
                              {({ active, selected }) => (
                                <div
                                  className={`relative cursor-default select-none py-2 pl-6 pr-4 ${
                                    active
                                      ? "bg-accent text-white"
                                      : "text-gray-900 dark:text-white"
                                  }`}
                                >
                                  <span
                                    className={`block truncate ${
                                      selected ? "font-medium" : "font-normal"
                                    } dark:text-white`}
                                  >
                                    {option.label}
                                  </span>
                                </div>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </div>
                    </Listbox>

                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t.conversationsPerPage}
                    </span>
                  </div>
                </div>
              </div>

              {/* Default text style */}
              <div className="border-b  pb-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium dark:text-white">
                    {t.defaultTextStyle}:
                  </label>
                  <p className="text-sm dark:text-white">
                    {t.useRemoveFormattingButton}
                  </p>

                  <div className="border rounded p-4 bg-gray-50 dark:bg-black">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="relative flex-1 max-w-xs">
                        {fontsLoading ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ffa184]"></div>
                            <span className="text-sm dark:text-white">
                              Loading fonts...
                            </span>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Font Selector Input */}
                            <div
                              onClick={() =>
                                setShowFontDropdown(!showFontDropdown)
                              }
                              className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white cursor-pointer flex items-center justify-between"
                            >
                              <span
                                className="dark:text-white"
                                style={{ fontFamily: stagedFont }}
                              >
                                {stagedFont}
                              </span>
                              <svg
                                className={`w-4 h-4 transform transition-transform ${
                                  showFontDropdown ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>

                            {/* Font Dropdown */}
                            {showFontDropdown && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-black border rounded shadow-lg z-50 max-h-64 overflow-hidden">
                                {/* Search Input */}
                                <div className="p-2 border-b ">
                                  <input
                                    type="text"
                                    placeholder="Search fonts..."
                                    value={fontSearchQuery}
                                    onChange={(e) =>
                                      setFontSearchQuery(e.target.value)
                                    }
                                    className="w-full border  rounded px-2 py-1 text-sm bg-white dark:bg-black dark:text-white"
                                  />
                                </div>

                                {/* Font List */}
                                <div className="max-h-48 overflow-y-auto">
                                  {availableFonts
                                    .filter(
                                      (font) =>
                                        fontSearchQuery === "" ||
                                        font
                                          .toLowerCase()
                                          .includes(
                                            fontSearchQuery.toLowerCase()
                                          )
                                    )
                                    .map((font, index) => (
                                      <div
                                        key={`${font}-${index}`}
                                        onClick={() => {
                                          setStagedFont(font);
                                          setShowFontDropdown(false);
                                          setFontSearchQuery("");
                                        }}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-accent transition-colors ${
                                          stagedFont === font
                                            ? "bg-blue-50 dark:bg-black dark:text-white"
                                            : " dark:text-white"
                                        }`}
                                        style={{ fontFamily: font }}
                                      >
                                        {font}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative" ref={fontSizeMenuRef}>
                          <button
                            onClick={() =>
                              setShowFontSizeMenu(!showFontSizeMenu)
                            }
                            className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-accent px-2 py-1 rounded border "
                            title="Font size"
                          >
                            <Type className="w-4 h-4 dark:text-white" />
                            <ChevronDown className="w-3 h-3 dark:text-white" />
                          </button>
                          {showFontSizeMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-black border rounded-md shadow-lg z-20 min-w-[120px]">
                              <div className="py-1">
                                {[
                                  { label: "Small", size: "12px" },
                                  { label: "Normal", size: "14px" },
                                  { label: "Large", size: "16px" },
                                  { label: "Huge", size: "18px" },
                                ].map((option) => (
                                  <button
                                    key={option.label}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setStagedFontSize(option.size);
                                      setShowFontSizeMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-accent flex items-center ${
                                      stagedFontSize === option.size
                                        ? "text-[#ffa184] dark:text-[#ffa184] bg-[#ffa184]/20 dark:bg-[#ffa184]/20"
                                        : "dark:text-white"
                                    }`}
                                    style={{ fontSize: option.size }}
                                  >
                                    {stagedFontSize === option.size && (
                                      <Check className="w-4 h-4 mr-2" />
                                    )}
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="relative" ref={colorPickerRef}>
                          <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-accent px-2 py-1 rounded border "
                            title="Text color"
                          >
                            <Palette className="w-4 h-4 dark:text-white" />
                            <div
                              className="w-3 h-3 rounded border border-gray-300"
                              style={{ backgroundColor: stagedTextColor }}
                            ></div>
                            <ChevronDown className="w-3 h-3 dark:text-white" />
                          </button>
                          {showColorPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-black border rounded-md shadow-lg z-20 p-3 min-w-[200px]">
                              <div className="space-y-3">
                                <div className="grid grid-cols-6 gap-2">
                                  {[
                                    "#000000",
                                    "#333333",
                                    "#666666",
                                    "#999999",
                                    "#CCCCCC",
                                    "#FFFFFF",
                                    "#FF0000",
                                    "#FF6600",
                                    "#FFFF00",
                                    "#00FF00",
                                    "#0000FF",
                                    "#6600FF",
                                    "#FF3366",
                                    "#FF9933",
                                    "#FFFF66",
                                    "#66FF66",
                                    "#3366FF",
                                    "#9966FF",
                                    "#800000",
                                    "#FF8000",
                                    "#808000",
                                    "#008000",
                                    "#000080",
                                    "#800080",
                                    "#C00000",
                                    "#FF4000",
                                    "#C0C000",
                                    "#00C000",
                                    "#0040FF",
                                    "#C000C0",
                                  ].map((color) => (
                                    <button
                                      key={color}
                                      onClick={() => {
                                        setStagedTextColor(color);
                                        setShowColorPicker(false);
                                      }}
                                      className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                                      style={{ backgroundColor: color }}
                                      title={color}
                                    >
                                      {stagedTextColor === color && (
                                        <Check
                                          className="w-4 h-4 text-white drop-shadow-lg"
                                          style={{
                                            color:
                                              color === "#FFFFFF"
                                                ? "#000000"
                                                : "#FFFFFF",
                                          }}
                                        />
                                      )}
                                    </button>
                                  ))}
                                </div>
                                <div className="border-t pt-3">
                                  <label className="block text-sm dark:text-white mb-2">
                                    Custom color:
                                  </label>
                                  <input
                                    type="color"
                                    value={stagedTextColor}
                                    onChange={(e) =>
                                      setStagedTextColor(e.target.value)
                                    }
                                    className="w-full h-8 rounded border cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setStagedFont("Poppins");
                            setStagedFontSize("14px");
                            setStagedTextColor("#000000");
                          }}
                          className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-accent px-2 py-1 rounded transition-colors"
                          title="Reset to default font settings"
                        >
                          <RotateCcw className="w-4 h-4 dark:text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Default font info */}
                    <div className="mt-2 flex items-center space-x-1 text-xs dark:text-white">
                      <Info className="w-3 h-3 dark:text-white" />
                      <span className="dark:text-white">
                        Default font is Poppins
                      </span>
                    </div>

                    <div className="mt-3 p-3 border  rounded bg-white dark:bg-black">
                      <p
                        style={{
                          fontFamily: stagedFont,
                          fontSize: stagedFontSize,
                        }}
                        className="dark:text-white"
                      >
                        {t.thisIsWhatYourBodyTextWillLookLike} - Preview text
                        using {stagedFont} font at {stagedFontSize} size with
                        selected color.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grammar */}
              <div className="border-b  pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-white">
                    {t.grammar}:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="grammar"
                        value="on"
                        checked={grammarSuggestions === "on"}
                        onChange={(e) => setGrammarSuggestions(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.grammar} {t.suggestionsOn}
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="grammar"
                        value="off"
                        checked={grammarSuggestions === "off"}
                        onChange={(e) => setGrammarSuggestions(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.grammar} {t.suggestionsOff}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Spelling */}
              <div className="border-b  pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-white">
                    {t.spelling}:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="spelling"
                        value="on"
                        checked={spellingSuggestions === "on"}
                        onChange={(e) => setSpellingSuggestions(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.spelling} {t.suggestionsOn}
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="spelling"
                        value="off"
                        checked={spellingSuggestions === "off"}
                        onChange={(e) => setSpellingSuggestions(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.spelling} {t.suggestionsOff}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Autocorrect */}
              <div className="border-b  pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-white">
                    {t.autocorrect}:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="autocorrect"
                        value="on"
                        checked={autocorrect === "on"}
                        onChange={(e) => setAutocorrect(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.autocorrect} {t.on}
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="autocorrect"
                        value="off"
                        checked={autocorrect === "off"}
                        onChange={(e) => setAutocorrect(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.autocorrect} {t.off}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Smart Compose */}
              <div className="border-b  pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-white">
                    {t.smartCompose}:
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t.predictiveWritingSuggestions}
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="smartCompose"
                        value="on"
                        checked={smartCompose === "on"}
                        onChange={(e) => setSmartCompose(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.writingSuggestionsOn}
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="smartCompose"
                        value="off"
                        checked={smartCompose === "off"}
                        onChange={(e) => setSmartCompose(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.writingSuggestionsOff}
                      </span>
                    </label>
                  </div>
                  {/* <div className="mt-2">
                    <a
                      href="#"
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      {t.feedbackOnSmartCompose}
                    </a>
                  </div> */}
                </div>
              </div>

              {/* Keyboard shortcuts */}
              <div className="border-b  pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-white">
                    {t.keyboardShortcutsLabel}:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="keyboard"
                        value="off"
                        checked={keyboardShortcuts === "off"}
                        onChange={(e) => setKeyboardShortcuts(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.keyboardShortcutsOff}
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="keyboard"
                        value="on"
                        checked={keyboardShortcuts === "on"}
                        onChange={(e) => setKeyboardShortcuts(e.target.value)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.keyboardShortcutsOn}
                      </span>
                    </label>
                  </div>
                  {/* <div className="mt-2">
                    <a
                      href="#"
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      {t.learnMore}
                    </a>
                  </div> */}
                </div>
              </div>

              {/* My picture */}
              <div className="border-b  pb-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium dark:text-white">
                    {t.myPicture}:
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ffa184] via-[#ffc3a0] to-[#ff6b6b] flex items-center justify-center text-white text-xl font-semibold">
                      JD
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm dark:text-white">
                        {t.yourGoogleProfilePicture}
                      </p>
                      {/* <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t.youCanChangeYourPicture}{" "}
                        <a
                          href="#"
                          className="text-[#ffa184] dark:text-[#ffa184] hover:underline"
                        >
                          {t.aboutMe}
                        </a>
                        .
                      </p> */}
                    </div>
                  </div>
                  {/* <div className="mt-2">
                    <a
                      href="#"
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      {t.learnMore}
                    </a>
                  </div> */}
                </div>
              </div>

              {/* Signature */}
              <div className="">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium dark:text-white">
                    {t.signature}:
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t.appendedAtEndOfMessages}
                  </p>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="signature"
                        value="none"
                        checked={!enableSignature}
                        onChange={() => setEnableSignature(false)}
                        className="mr-2 accent-[#ffa184]"
                      />
                      <span className="text-sm dark:text-white">
                        {t.noSignature}
                      </span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="signature"
                        value="custom"
                        checked={enableSignature}
                        onChange={() => setEnableSignature(true)}
                        className="mr-2 mt-1 accent-[#ffa184]"
                      />
                      <div className="flex-1">
                        <span className="text-sm dark:text-white block mb-2">
                          {t.customSignature}:
                        </span>
                        <textarea
                          value={signature}
                          onChange={(e) => setSignature(e.target.value)}
                          placeholder="Enter your signature here..."
                          disabled={!enableSignature}
                          className="w-full px-3 py-2 border  rounded-md text-sm bg-white dark:bg-accent dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-700"
                          rows={4}
                        />
                      </div>
                    </label>
                  </div>
                  {/* 
                  <div className="mt-2">
                    <a
                      href="#"
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      {t.learnMore}
                    </a>
                  </div> */}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Labels" && (
            <>
              {console.log("Rendering labels:", labels)}
              {console.log(
                "Rendering systemLabelsVisibility:",
                systemLabelsVisibility
              )}
              <div className="space-y-6 sm:space-y-8 max-w-none">
                {/* System Labels */}
                <div className="border-b pb-6">
                  <h3 className="text-sm font-medium dark:text-white mb-4">
                    {t.systemLabels}
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(systemLabelsVisibility).map(
                      ([labelKey, isVisible]) => (
                        <div
                          key={labelKey}
                          className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-accent rounded-md"
                        >
                          <span className="text-sm dark:text-white font-medium">
                            {(t as any)[labelKey] || labelKey}
                          </span>
                          <div>
                            <button
                              onClick={() =>
                                setSystemLabelsVisibility((prev) => ({
                                  ...prev,
                                  [labelKey]: true,
                                }))
                              }
                              className={`text-xs px-2 py-1 rounded ${
                                isVisible
                                  ? "bg-[#ffa184]/20 text-[#ffa184]"
                                  : "text-[#ffa184]"
                              }`}
                            >
                              {t.show}
                            </button>
                            <button
                              onClick={() =>
                                setSystemLabelsVisibility((prev) => ({
                                  ...prev,
                                  [labelKey]: false,
                                }))
                              }
                              className={`text-xs px-2 py-1 rounded ${
                                !isVisible
                                  ? "bg-gray-100 text-gray-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {t.hide}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Custom labels */}
                <div className="border-b pb-6 mt-8">
                  <h3 className="text-sm font-medium dark:text-white mb-4">
                    {t.labels}
                  </h3>
                  <div className="space-y-2">
                    {customLabels.map((label) => (
                      <div
                        key={label.id || label.name}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-accent rounded-md"
                      >
                        <span className="text-sm dark:text-white">
                          {label.name}
                        </span>
                        {/* You can add color, edit, delete, etc. here as needed */}
                      </div>
                    ))}
                  </div>
                  {/* Create new label form */}
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder={t.labelName}
                      className="flex-1 px-3 py-2 border rounded-md text-sm bg-white dark:bg-black dark:text-white"
                    />
                    <button
                      onClick={handleCreateLabel}
                      disabled={
                        !newLabelName.trim() || createLabelMutation.isPending
                      }
                      className="px-4 py-2 bg-[#ffa184] text-white rounded-md hover:bg-[#fd9474] disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      {t.createNew}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newLabelIsVisible}
                        onChange={(e) => setNewLabelIsVisible(e.target.checked)}
                      />
                      {t.show}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newLabelShowIfUnread}
                        onChange={(e) =>
                          setNewLabelShowIfUnread(e.target.checked)
                        }
                      />
                      {t.showIfUnread || "Show if unread"}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newLabelShowInMessageList}
                        onChange={(e) =>
                          setNewLabelShowInMessageList(e.target.checked)
                        }
                      />
                      {t.showInMessageList || "Show in message list"}
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "Inbox" && (
            <div className="space-y-8 max-w-4xl">
              {/* Inbox type */}
              <div className="border-b  pb-6">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium dark:text-white">
                    {t.inboxType}
                  </label>
                  <Listbox value={inboxType} onChange={setInboxType}>
                    <div className="relative mt-1 w-56">
                      <Listbox.Button className="relative w-full cursor-default rounded bg-white dark:bg-black py-2 pl-3 pr-10 text-left shadow-sm border  focus:outline-none focus:ring-2 focus:ring-[#ffa184] sm:text-sm">
                        <span className="block truncate dark:text-white ">
                          {
                            inboxOptions.find((opt) => opt.value === inboxType)
                              ?.label
                          }
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                          />
                        </span>
                      </Listbox.Button>

                      <Listbox.Options className="absolute border z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-black py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {inboxOptions.map((option) => (
                          <Listbox.Option
                            key={option.value}
                            value={option.value}
                          >
                            {({ active, selected }) => (
                              <div
                                className={`relative cursor-default select-none py-2 pl-10 pr-4 ${
                                  active || selected
                                    ? "bg-accent text-white"
                                    : "dark:text-white "
                                }`}
                              >
                                <span
                                  className={`block truncate ${
                                    selected ? "font-medium" : "font-normal"
                                  } dark:text-white `}
                                >
                                  {option.label}
                                </span>

                                {selected && (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white">
                                    {/* You can place a check icon here if desired */}
                                  </span>
                                )}
                              </div>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                  `
                </div>
              </div>
            </div>
          )}

          {activeTab === "Accounts" && (
            <div className="space-y-8 max-w-4xl">
              {/* Import mail and contacts */}
              <div className="border-b  pb-6">
                <div className="">
                  <h3 className="text-sm font-medium dark:text-white mb-4">
                    {t.importMailAndContacts}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t.importFromYahoo}
                  </p>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleOpenImportDialog}
                      className="px-4 py-2 text-sm bg-[#ffa184] text-white rounded hover:bg-[#fd9474] transition-colors"
                    >
                      {t.importMailAndContactsLink}
                    </button>
                  </div>
                  {/* Show import status and info */}
                  {account?.importMailAndContact &&
                    ["in_progress", "completed", "failed"].includes(account.importMailAndContact.importStatus) && (
                      <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                        <div>Status: {account.importMailAndContact.importStatus}</div>
                        <div>Last Import: {account.importMailAndContact.lastImportDate || "-"}</div>
                      </div>
                    )}
                </div>
                {/* Import Dialog */}
                {showImportDialog && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-black border rounded-lg p-6 w-full max-w-md mx-4">
                      <h3 className="text-lg font-medium dark:text-white  mb-4">
                        Import Mails and Contacts
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium dark:text-white mb-2">
                            Email address:
                          </label>
                          <input
                            type="email"
                            value={userEmail}
                            onChange={e => setUserEmail(e.target.value)}
                            placeholder="your-email@example.com"
                            className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium dark:text-white mb-2">
                            Password:
                          </label>
                          <input
                            type="password"
                            value={imapPassword}
                            onChange={e => setImapPassword(e.target.value)}
                            placeholder="Your account password"
                            className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium dark:text-white mb-2">
                            IMAP Host:
                          </label>
                          <input
                            value={hostIMAP}
                            onChange={e => setHostIMAP(e.target.value)}
                            placeholder="imap.example.com"
                            className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium dark:text-white mb-2">
                            IMAP Port:
                          </label>
                          <input
                            value={portIMAP}
                            onChange={e => setPortIMAP(e.target.value)}
                            placeholder="993"
                            className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium dark:text-white mb-2">
                            Connection Type:
                          </label>
                          <select
                            value={connectionTypeIMAP}
                            onChange={e => setConnectionTypeIMAP(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                          >
                            <option value="SSL">SSL</option>
                            <option value="STARTTLS">STARTTLS</option>
                            <option value="None">None</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          onClick={() => setShowImportDialog(false)}
                          className="px-4 py-2 text-sm dark:text-white bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleImportSubmit}
                          className="px-4 py-2 text-sm text-white rounded bg-[#ffa184] hover:bg-[#fd9474] transition-colors"
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Send mail as */}
              <div className="border-b  pb-6">
                <div className="">
                  <h3 className="text-sm font-medium dark:text-white mb-4">
                    {t.sendMailAs}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t.useGmailToSend}
                  </p>

                  <div className="space-y-3">
                    {sendAsEmails.map((emailData) => (
                      <div
                        key={emailData.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-accent rounded"
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="defaultEmail"
                            checked={emailData.isDefault}
                            onChange={() =>
                              handleSetDefaultSendAs(emailData.id)
                            }
                            className="accent-[#ffa184]"
                          />
                          <div>
                            <div className="text-sm dark:text-white">
                              {emailData.name} &lt;{emailData.email}&gt;
                              {emailData.isDefault && (
                                <span className="ml-2 text-xs text-[#ffa184] dark:text-[#ffa184]">
                                  {t.defaultLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {emailData.verified ? (
                                <span className="text-green-600 dark:text-green-400">
                                  ✓ {t.verified}
                                </span>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400">
                                  ⚠ Pending verification
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingEmailId(emailData.id)}
                            className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                          >
                            Edit
                          </button>
                          {!emailData.isDefault && (
                            <button
                              onClick={() =>
                                handleDeleteSendAsEmail(emailData.id)
                              }
                              className="text-red-600 dark:text-red-400 hover:underline text-sm ml-2"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center space-x-4 mt-4">
                    <button
                      onClick={() => setShowAddEmailDialog(true)}
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      Add another email address
                    </button>
                  </div>

                  {/* Add Email Dialog */}
                  {showAddEmailDialog && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white dark:bg-black border rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium dark:text-white mb-4">
                          Add another email address
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                              Name:
                            </label>
                            <input
                              type="text"
                              value={newSendAsName}
                              onChange={(e) => setNewSendAsName(e.target.value)}
                              placeholder="Your name"
                              className="w-full border  rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                              Email address:
                            </label>
                            <input
                              type="email"
                              value={newSendAsEmail}
                              onChange={(e) =>
                                setNewSendAsEmail(e.target.value)
                              }
                              placeholder="your-email@example.com"
                              className="w-full border  rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            onClick={() => {
                              setShowAddEmailDialog(false);
                              setNewSendAsEmail("");
                              setNewSendAsName("");
                            }}
                            className="px-4 py-2 text-sm dark:text-white bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAddSendAsEmail}
                            className="px-4 py-2 text-sm bg-[#ffa184] hover:bg-[#fd9474] text-white rounded transition-colors"
                          >
                            Add Email
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Forwarding" && (
            <div className="space-y-8 max-w-4xl">
              {/* Forwarding section */}
              
              {/* <div className="border-b  pb-6">
                <div className="">
                  <h3 className="text-sm font-medium dark:text-white mb-4">
                    {t.forwardingLabel2}
                  </h3> */}

                  {/* Forwarding status */}
                  {/* <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {forwardingAddresses.filter((addr) => addr.enabled)
                        .length > 0
                        ? `${t.forwardingIsEnabled} ${
                            forwardingAddresses.filter(
                              (addr) => addr.enabled
                            )[0]?.email
                          }.`
                        : t.forwardingIsDisabled}
                    </p>
                  </div> */}

                  {/* Forwarding addresses list */}
                  {/* {forwardingAddresses.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {forwardingAddresses.map((address) => (
                        <div
                          key={address.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#ffa184] rounded"
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="selectedForwardingAddress"
                              checked={address.enabled}
                              onChange={() =>
                                handleToggleForwarding(address.id)
                              }
                              disabled={!address.verified}
                              className="text-[#ffa184]"
                            />
                            <div>
                              <div className="text-sm dark:text-white">
                                {address.email}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {address.verified ? (
                                  <span className="text-green-600 dark:text-green-400">
                                    ✓ {t.verified}
                                  </span>
                                ) : (
                                  <span className="text-orange-600 dark:text-orange-400">
                                    ⚠ {t.pendingVerification}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!address.verified && (
                              <button
                                onClick={() =>
                                  handleVerifyForwarding(address.id)
                                }
                                className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                              >
                                {t.verify}
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleDeleteForwardingAddress(address.id)
                              }
                              className="text-red-600 dark:text-red-400 hover:underline text-sm"
                            >
                              {t.delete}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setShowAddForwardingDialog(true)}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-[#ffa184] dark:text-white border rounded hover:bg-gray-200 dark:hover:bg-[#fd9474]"
                    >
                      {t.addAForwardingAddress}
                    </button>
                  </div> */}

                  {/* Add Forwarding Dialog */}
                  {/* {showAddForwardingDialog && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white dark:bg-black border rounded-lg p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-medium dark:text-white mb-4">
                          {t.addAForwardingAddress}
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                              {t.emailAddressLabel}
                            </label>
                            <input
                              type="email"
                              value={newForwardingEmail}
                              onChange={(e) =>
                                setNewForwardingEmail(e.target.value)
                              }
                              placeholder="forward-to@example.com"
                              className="w-full border  rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            onClick={() => {
                              setShowAddForwardingDialog(false);
                              setNewForwardingEmail("");
                            }}
                            className="px-4 py-2 text-sm dark:text-white bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            {t.cancel}
                          </button>
                          <button
                            onClick={handleAddForwardingAddress}
                            className="px-4 py-2 text-sm text-white rounded bg-[#ffa184] hover:bg-[#fd9474] transition-colors"
                          >
                            {t.addAddress}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t.tipYouCanAlsoForward}{" "}
                      <button
                        onClick={() => {
                          onOpenFilters?.();
                        }}
                        className="text-[#ffa184] dark:text-[#ffa184] hover:underline cursor-pointer"
                      >
                        {t.creatingAFilter}
                      </button>
                      !
                    </p>
                  </div>
                </div>
              </div> */}

              {/* Add blocked email section */}
              <div className="border-b  pb-6">
                <h3 className="text-sm font-medium dark:text-white mb-4">
                  {t.blockEmailAddress}
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={newBlockedEmail}
                    onChange={(e) => setNewBlockedEmail(e.target.value)}
                    placeholder={t.enterEmailAddressToBlock}
                    className="flex-1 px-3 py-2 border  rounded-md text-sm bg-white dark:bg-black dark:text-white"
                  />
                  <button
                    onClick={handleAddBlockedEmail}
                    disabled={
                      !newBlockedEmail.trim() || !newBlockedEmail.includes("@")
                    }
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                  >
                    {t.blockEmail}
                  </button>
                </div>
              </div>

              {/* Blocked addresses section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t.followingEmailAddresses}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-sm text-[#ffa184] dark:text-[#ffa184] hover:underline"
                    >
                      {selectAll ? t.noneButton : t.selectAllButton}
                    </button>
                    {blockedAddresses.some((addr) => addr.selected) && (
                      <button
                        onClick={handleUnblockSelected}
                        className="w-full py-1 text-sm bg-[#ffa184] hover:bg-[#fd9474] text-white rounded"
                      >
                        {t.unblockSelectedAddresses}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {blockedAddresses.map((address) => (
                    <div
                      key={address.id}
                      className="flex items-center border justify-between py-2 px-3 bg-gray-50 dark:bg-black rounded-md"
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={address.selected}
                          onChange={() => handleToggleAddress(address.id)}
                          className="rounded  accent-[#ffa184]"
                        />
                        <span className="text-sm dark:text-white">
                          {address.name} &lt;{address.email}&gt;
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnblockAddress(address.id)}
                        className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                      >
                        {t.unblock}
                      </button>
                      {/* <button className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm">
                        {t.remove}
                      </button> */}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t ">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t.selectAll}:
                    </span>
                    <button
                      onClick={() => {
                        setBlockedAddresses((prev) =>
                          prev.map((addr) => ({ ...addr, selected: true }))
                        );
                        setSelectAll(true);
                      }}
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      {t.selectAllButton}
                    </button>
                    <span className="text-sm text-gray-400">|</span>
                    <button
                      onClick={() => {
                        setBlockedAddresses((prev) =>
                          prev.map((addr) => ({ ...addr, selected: false }))
                        );
                        setSelectAll(false);
                      }}
                      className="text-[#ffa184] dark:text-[#ffa184] hover:underline text-sm"
                    >
                      {t.noneButton}
                    </button>
                  </div>

                  {/* <div className="mt-3">
                    <button
                      disabled={!blockedAddresses.some(addr => addr.selected)}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border  rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      {t.unblockSelectedAddresses}
                    </button>
                  </div> */}
                </div>
              </div>
            </div>
          )}

          {/* Add more tab content as needed */}
          {activeTab !== "General" &&
            activeTab !== "Labels" &&
            activeTab !== "Inbox" &&
            activeTab !== "Accounts" &&
            activeTab !== "Forwarding" && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  {activeTab} Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure your {activeTab.toLowerCase()} settings.
                </p>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="border-t  bg-white dark:bg-black px-2 py-2">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  console.log("Footer Save Changes clicked", activeTab);
                  if (activeTab === "General") {
                    updateSettings("general", {
                      theme: isDarkMode ? "dark" : "light",
                      language: stagedLanguage,
                      rightToLeftEditing: rightToLeftSupport === "on",
                      grammar: grammarSuggestions === "on",
                      spelling: spellingSuggestions === "on",
                      autocorrect: autocorrect === "on",
                      smartCompose: smartCompose === "on",
                      keyboardShortcuts: keyboardShortcuts === "on",
                      selectedPageSize: Number(conversationsPerPage),
                      defaultTextStyle: {
                        fontStyle: stagedFont,
                        textColor: stagedTextColor,
                        // style: stagedFontSize,
                      },
                      signature: {
                        enabled: enableSignature,
                        text: signature,
                      },
                    });
                  } else if (activeTab === "Labels") {
                    updateSettings("labels", { systemLabelsVisibility });
                    // Sync to localStorage and notify LeftSidebar
                    localStorage.setItem("systemLabelsVisibility", JSON.stringify(systemLabelsVisibility));
                    window.dispatchEvent(new CustomEvent("systemLabelsVisibilityChanged", { detail: systemLabelsVisibility }));
                    // Update snapshot and unsaved state
                    const newSnapshot = JSON.stringify({
                      stagedLanguage,
                      stagedFont,
                      stagedFontSize,
                      stagedTextColor,
                      enableInputTools,
                      rightToLeftSupport,
                      conversationsPerPage,
                      enableDynamicEmail,
                      grammarSuggestions,
                      spellingSuggestions,
                      autocorrect,
                      smartCompose,
                      keyboardShortcuts,
                      signature,
                      enableSignature,
                      inboxType,
                      forwardingOption,
                      forwardingAddresses,
                      blockedAddresses,
                      sendAsEmails,
                      systemLabelsVisibility,
                    });
                    setOriginalSettingsSnapshot(newSnapshot);
                    setHasUnsavedChanges(false);
                  }
                  // Add more else if for other tabs if needed
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  hasUnsavedChanges
                    ? "bg-[#ffa184] text-primary-foreground hover:bg-[#fd9474]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                disabled={!hasUnsavedChanges}
              >
                {t.saveChanges}
              </button>
              <button
                onClick={handleClose}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                {t.cancel}
              </button>
            </div>
            {hasUnsavedChanges && (
              <div className="text-xs text-orange-600 dark:text-orange-400">
                Unsaved changes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Discard Changes Dialog */}
      {showDiscardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Confirm discard changes
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Your changes have not been saved. Discard changes?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDiscard}
                className="px-4 py-2 text-sm text-[#ffa184] hover:bg-[#ffa184]/20 dark:hover:bg-blue-900/20 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-4 py-2 text-sm text-white rounded bg-[#ffa184] hover:bg-[#fd9474] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="destructive"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
