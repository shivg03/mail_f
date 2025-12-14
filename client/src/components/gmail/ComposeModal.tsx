import { useState, useRef, useEffect } from "react";
import { ChevronDown, Minus, Square, X, MoreHorizontal } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "../../contexts/TranslationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { InputDialog } from "@/components/ui/custom-dialog";
import ReactDOM from "react-dom";
import rangy from "rangy/lib/rangy-core";
import "rangy/lib/rangy-textrange";
import "rangy/lib/rangy-selectionsaverestore";
import { useFont } from "../../contexts/FontContext";
import Loader from "@/components/ui/Loader";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mail_Id: string;
  from: string;
  setSendStatus: React.Dispatch<
    React.SetStateAction<"idle" | "sending" | "sent">
  >;
  setSentMailId: React.Dispatch<React.SetStateAction<string | null>>;
  // ...other props
}

// Add FontDropdownProps interface for typing
interface FontDropdownProps {
  fontList: string[];
  selectedFont: string;
  setSelectedFont: React.Dispatch<React.SetStateAction<string>>;
  handleFontChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function FontDropdown({
  fontList,
  selectedFont,
  setSelectedFont,
  handleFontChange,
}: FontDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="border rounded px-3 py-2 text-sm bg-white dark:bg-black dark:text-white flex items-center"
        style={{ fontFamily: selectedFont, minWidth: 120 }}
        onClick={() => setOpen((v) => !v)}
        title="Font style"
      >
        {selectedFont}
        <svg
          className="w-4 h-4 ml-2"
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
      </button>
      {open && (
        <div
          className="absolute z-50 mb-1 bg-white dark:bg-black border rounded shadow-lg max-h-64 overflow-y-auto w-full"
          style={{ bottom: "100%" }}
        >
          {fontList.map((font: string) => (
            <div
              key={font}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevents selection loss
                setSelectedFont(font);
                handleFontChange({
                  target: { value: font },
                } as React.ChangeEvent<HTMLSelectElement>);
                setOpen(false);
              }}
              className={`px-3 py-2 text-sm cursor-pointer
                ${selectedFont === font
                  ? "bg-blue-50 dark:bg-black dark:text-white"
                  : "dark:text-white"
                }
                hover:bg-gray-100 dark:hover:bg-accent
              `}
              style={{ fontFamily: font }}
            >
              {font}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline SendStatusBar component (move outside ComposeModal)
type SendStatusBarProps = {
  status: "idle" | "sending" | "sent";
  onUndo: () => void;
  onView: () => void;
  onClose: () => void;
};
function SendStatusBar({
  status,
  onUndo,
  onView,
  onClose,
}: SendStatusBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white shadow-lg rounded px-4 py-2 flex items-center gap-4 border">
      {status === "sending" ? (
        <>
          <Loader />
          <span>Sending...</span>
        </>
      ) : (
        <>
          <span>Message sent</span>
          <button className="text-blue-600 hover:underline" onClick={onUndo}>
            Undo
          </button>
          <button className="text-blue-600 hover:underline" onClick={onView}>
            View message
          </button>
        </>
      )}
      <button
        className="ml-2 text-gray-400 hover:text-gray-700"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

export default function ComposeModal({
  isOpen,
  onClose,
  mail_Id,
  from,
  setSendStatus,
  setSentMailId,
  ...props
}: ComposeModalProps) {
  // Font hooks must be at the top, before any early returns
  const { currentFont } = useFont();
  const [selectedFont, setSelectedFont] = useState(currentFont || "Poppins");

  // State for color picker dropdown
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const savedColorPickerSelection = useRef<any>(null);

  // Add state for alignment dropdown and current alignment
  const [showAlignmentDropdown, setShowAlignmentDropdown] = useState(false);
  const [currentAlignment, setCurrentAlignment] = useState<
    "left" | "center" | "right" | "justify"
  >("left");
  const alignmentButtonRef = useRef<HTMLButtonElement>(null);
  const alignmentDropdownRef = useRef<HTMLDivElement>(null);

  // Add state to track if the compose area is empty
  const [isBodyEmpty, setIsBodyEmpty] = useState(true);
  const [suggestion, setSuggestion] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>([]);
  const [emailContext, setEmailContext] = useState<string>("");

  const [showHtmlTemplateDialog, setShowHtmlTemplateDialog] = useState(false);
  const [htmlTemplateInput, setHtmlTemplateInput] = useState("");

  // Add state for link modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  // Add state for link text
  const [linkText, setLinkText] = useState("");

  // State for Gmail-style badge input for To, CC, BCC
  const [toList, setToList] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [bccList, setBccList] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState("");

  // Add at the top of ComposeModal or near label logic
  const LABEL_COLORS = [
    "#60a5fa", // blue
    "#f87171", // red
    "#4ade80", // green
    "#facc15", // yellow
    "#c084fc", // purple
    "#f472b6", // pink
    "#fb923c", // orange
    "#818cf8", // indigo
    "#2dd4bf", // teal
  ];
  const getRandomLabelColor = () =>
    LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];

  const [newLabelColor, setNewLabelColor] = useState(getRandomLabelColor());

  // Add a ref for debounce timeout
  // const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveToastShown, setAutoSaveToastShown] = useState(false);

  const [draftMessageId, setDraftMessageId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  // Add state for replyToMessageId
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);

  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [modalSize, setModalSize] = useState<"normal" | "maximized" | "minimized">("normal");
  const [isFormatting, setIsFormatting] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [signature, setSignature] = useState("");
  const [enableSignature, setEnableSignature] = useState(false);
  const [emojiData, setEmojiData] = useState<string[]>([]);
  const [emojiLoading, setEmojiLoading] = useState(false);
  const [emojiCategories, setEmojiCategories] = useState<{
    [key: string]: string[];
  }>({});
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [customScheduleTime, setCustomScheduleTime] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showLabelSubmenu, setShowLabelSubmenu] = useState(false);
  const [showMeetingSubmenu, setShowMeetingSubmenu] = useState(false);
  const [isPlainTextMode, setIsPlainTextMode] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelSearchQuery, setLabelSearchQuery] = useState("");
  const [isDefaultFullScreen, setIsDefaultFullScreen] = useState(false);
  const [showCreateLabelInput, setShowCreateLabelInput] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [showInputTools, setShowInputTools] = useState(false);
  const [selectedInputLanguage, setSelectedInputLanguage] = useState("English");
  // Add state for dropdown
  const [showFormattingDropdown, setShowFormattingDropdown] = useState(false);
  const formattingDropdownRef = useRef<HTMLDivElement>(null);
  // Add this near other refs
  const formattingButtonRef = useRef<HTMLButtonElement>(null);
  // Add these state variables near other useState hooks
  // Remove: const [undoStack, setUndoStack] = useState<string[]>([]);
  // Remove: const [redoStack, setRedoStack] = useState<string[]>([]);
  // Add this new state for HTML body
  const [bodyHtml, setBodyHtml] = useState("");
  const [colorPickerPos, setColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Input dialog state
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => { },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  const sendOptionsRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const inputToolsRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Fetch labels from the API
  const { data: apiLabels = [], isLoading: labelsLoading } = useQuery({
    queryKey: ["/label/getLabels", mail_Id],
    queryFn: async () => {
      if (!mail_Id) return [];
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/label/getLabels", {
        mail_id: mail_Id,
        __headers: headers,
      });
      return response.data;
    },
    enabled: !!mail_Id,
    refetchOnMount: true,
    staleTime: 0,
  });

  const createLabelMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      if (!mail_Id) throw new Error("No mail_Id");
      return await apiRequest("POST", "/label/createLabel", {
        mail_id: mail_Id,
        name: data.name,
        color: data.color, // hex value
        isVisible: true,
        showIfUnread: true,
        showInMessageList: true,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/label/getLabels", mail_Id],
      });
      setNewLabelName("");
      setShowCreateLabelInput(false);
      // Add the new label's unique ID to selectedLabels
      if (data && data.labelUniqueId) {
        setSelectedLabels((prev) => [...prev, data.labelUniqueId]);
      }
      toast({
        title: "Label created",
        description: "New label has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create label. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scheduleEmailMutation = useMutation({
    mutationFn: async (emailData: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      bodyHtml: string;
      plainText: string;
      scheduledTime: string;
    }) => {
      const response = await fetch("/api/emails/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule email");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/scheduled"] });
    },
  });

  // Load signature from settings
  useEffect(() => {
    const savedSettings = localStorage.getItem("gmailSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setSignature(settings.signature || "");
      setEnableSignature(settings.enableSignature || false);
    }
  }, []);

  // Reload signature when modal opens and auto-maximize on mobile
  useEffect(() => {
    if (isOpen) {
      const savedSettings = localStorage.getItem("gmailSettings");
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setSignature(settings.signature || "");
        setEnableSignature(settings.enableSignature || false);
      }

      // Auto-maximize on mobile devices
      if (isMobile) {
        setIsMaximized(true);
        setIsMinimized(false);
      }
    } else {
      // Clear form when modal is closed
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setAttachments([]);
      setSelectedLabels([]);
      setIsConfidential(false);
      setShowCcBcc(false);
    }
  }, [isOpen, isMobile]);

  // Listen for compose context events (Reply, Reply All, Forward)
  useEffect(() => {
    const handleComposeWithContext = (event: CustomEvent) => {
      const context = event.detail;
      console.log("[DEBUG] Compose context received:", context); // Debug log
      setTo(context.to || "");
      if (context.to && setToList) {
        setToList(
          context.to
            .split(",")
            .map((addr: string) => extractEmail(addr.trim()))
            .filter(Boolean)
        );
      }
      setCc(context.cc || "");
      setBcc(context.bcc || "");
      setSubject(context.subject || "");
      setBody(context.body || "");
      setThreadId(context.threadId || null); // <-- set threadId from context
      setReplyToMessageId(context.replyToMessageId || null); // <-- set replyToMessageId from context
      console.log(
        "[DEBUG] Set threadId:",
        context.threadId,
        "Set replyToMessageId:",
        context.replyToMessageId
      );
      setTimeout(() => {
        if (context.isForward) {
          const toInput = document.querySelector(
            'input[placeholder="Recipients"]'
          ) as HTMLInputElement;
          if (toInput) toInput.focus();
        } else if (context.isReply || context.isReplyAll) {
          if (textareaRef.current) textareaRef.current.focus();
        }
      }, 100);
    };

    window.addEventListener(
      "openComposeWithContext",
      handleComposeWithContext as EventListener
    );

    return () => {
      window.removeEventListener(
        "openComposeWithContext",
        handleComposeWithContext as EventListener
      );
    };
  }, []);

  // Add this useEffect after the useState hooks and textareaRef definition
  useEffect(() => {
    if (textareaRef.current && body !== undefined) {
      textareaRef.current.innerHTML = body;
      // Move caret to end
      const range = document.createRange();
      range.selectNodeContents(textareaRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [body]);

  // Load emojis - WhatsApp style categories
  useEffect(() => {
    const loadEmojis = async () => {
      if (emojiData.length > 0) return; // Already loaded

      setEmojiLoading(true);
      try {
        // WhatsApp-style emoji categories with comprehensive collection
        const whatsappEmojiCategories = {
          "😊 Smileys & People": [
            "😀",
            "😃",
            "😄",
            "😁",
            "😆",
            "😅",
            "😂",
            "🤣",
            "😊",
            "😇",
            "🙂",
            "🙃",
            "😉",
            "😌",
            "😍",
            "🥰",
            "😘",
            "😗",
            "😙",
            "😚",
            "😋",
            "😛",
            "😝",
            "😜",
            "🤪",
            "🤨",
            "🧐",
            "🤓",
            "😎",
            "🤩",
            "🥳",
            "😏",
            "😒",
            "😞",
            "😔",
            "😟",
            "😕",
            "🙁",
            "☹️",
            "😣",
            "😖",
            "😫",
            "😩",
            "🥺",
            "😢",
            "😭",
            "😤",
            "😠",
            "😡",
            "🤬",
            "🤯",
            "😳",
            "🥵",
            "🥶",
            "😱",
            "😨",
            "😰",
            "😥",
            "😓",
            "🤗",
            "🤔",
            "🤭",
            "🤫",
            "🤥",
            "😶",
            "😐",
            "😑",
            "😬",
            "🙄",
            "😯",
            "😦",
            "😧",
            "😮",
            "😲",
            "🥱",
            "😴",
            "🤤",
            "😪",
            "😵",
            "🤐",
            "🥴",
            "🤢",
            "🤮",
            "🤧",
            "😷",
            "🤒",
            "🤕",
            "🤑",
            "🤠",
            "😈",
            "👿",
            "👹",
            "👺",
            "🤡",
            "💩",
            "👻",
            "💀",
            "☠️",
            "👽",
            "👾",
            "🤖",
            "🎃",
            "😺",
            "😸",
            "😹",
            "😻",
            "😼",
            "😽",
            "🙀",
            "😿",
            "😾",
          ],
          "👋 People & Body": [
            "👋",
            "🤚",
            "🖐️",
            "✋",
            "🖖",
            "👌",
            "🤌",
            "🤏",
            "✌️",
            "🤞",
            "🤟",
            "🤘",
            "🤙",
            "👈",
            "👉",
            "👆",
            "🖕",
            "👇",
            "☝️",
            "👍",
            "👎",
            "👊",
            "✊",
            "🤛",
            "🤜",
            "👏",
            "🙌",
            "👐",
            "🤲",
            "🤝",
            "🙏",
            "✍️",
            "💅",
            "🤳",
            "💪",
            "🦾",
            "🦿",
            "🦵",
            "🦶",
            "👂",
            "🦻",
            "👃",
            "🧠",
            "🫀",
            "🫁",
            "🦷",
            "🦴",
            "👀",
            "👁️",
            "👅",
            "👄",
            "💋",
            "🩸",
            "👶",
            "🧒",
            "👦",
            "👧",
            "🧑",
            "👨",
            "👩",
            "🧓",
            "👴",
            "👵",
            "🙍",
            "🙎",
            "🙅",
            "🙆",
            "💁",
            "🙋",
            "🧏",
            "🙇",
            "🤦",
            "🤷",
            "👮",
            "🕵️",
            "💂",
            "🥷",
            "👷",
            "🤴",
            "👸",
            "👳",
            "👲",
            "🧕",
            "🤵",
            "👰",
            "🤰",
            "🤱",
            "👼",
            "🎅",
            "🤶",
            "🦸",
            "🦹",
            "🧙",
            "🧚",
            "🧛",
            "🧜",
            "🧝",
            "🧞",
            "🧟",
            "💆",
            "💇",
            "🚶",
            "🧍",
            "🏃",
            "💃",
            "🕺",
            "🕴️",
            "👯",
            "🧖",
            "🧗",
            "🤺",
            "🏇",
            "⛷️",
            "🏂",
            "🏌️",
            "🏄",
            "🚣",
            "🏊",
            "⛹️",
            "🏋️",
            "🚴",
            "🚵",
            "🤸",
            "🤼",
            "🤽",
            "🤾",
            "🤹",
            "🧘",
            "🛀",
            "🛌",
            "👭",
            "👫",
            "👬",
            "💏",
            "💑",
            "👪",
            "👨‍👩‍👧",
            "👨‍👩‍👧‍👦",
            "👨‍👩‍👦‍👦",
            "👨‍👩‍👧‍👧",
          ],
          "🐶 Animals & Nature": [
            "🐶",
            "🐱",
            "🐭",
            "🐹",
            "🐰",
            "🦊",
            "🐻",
            "🐼",
            "🐨",
            "🐯",
            "🦁",
            "🐮",
            "🐷",
            "🐽",
            "🐸",
            "🐵",
            "🙈",
            "🙉",
            "🙊",
            "🐒",
            "🐔",
            "🐧",
            "🐦",
            "🐤",
            "🐣",
            "🐥",
            "🦆",
            "🦅",
            "🦉",
            "🦇",
            "🐺",
            "🐗",
            "🐴",
            "🦄",
            "🐝",
            "🐛",
            "🦋",
            "🐌",
            "🐞",
            "🐜",
            "🦟",
            "🦗",
            "🕷️",
            "🕸️",
            "🦂",
            "🐢",
            "🐍",
            "🦎",
            "🦖",
            "🦕",
            "🐙",
            "🦑",
            "🦐",
            "🦞",
            "🦀",
            "🐡",
            "🐠",
            "🐟",
            "🐬",
            "🐳",
            "🐋",
            "🦈",
            "🐊",
            "🐅",
            "🐆",
            "🦓",
            "🦍",
            "🦧",
            "🐘",
            "🦛",
            "🦏",
            "🐪",
            "🐫",
            "🦒",
            "🦘",
            "🐃",
            "🐂",
            "🐄",
            "🐎",
            "🐖",
            "🐏",
            "🐑",
            "🦙",
            "🐐",
            "🦌",
            "🐕",
            "🐩",
            "🦮",
            "🐕‍🦺",
            "🐈",
            "🐈‍⬛",
            "🐓",
            "🦃",
            "🦚",
            "🦜",
            "🦢",
            "🦩",
            "🕊️",
            "🐇",
            "🦝",
            "🦨",
            "🦡",
            "🦦",
            "🦥",
            "🐁",
            "🐀",
            "🐿️",
            "🦔",
            "🌸",
            "💮",
            "🏵️",
            "🌹",
            "🥀",
            "🌺",
            "🌻",
            "🌼",
            "🌷",
            "🌱",
            "🪴",
            "🌲",
            "🌳",
            "🌴",
            "🌵",
            "🌶️",
            "🍄",
            "🌾",
            "💐",
            "🌿",
            "🍀",
            "🍃",
            "🍂",
            "🍁",
            "🌊",
            "🌈",
            "☀️",
            "🌤️",
            "⛅",
            "🌦️",
            "🌧️",
            "⛈️",
            "🌩️",
            "🌨️",
            "❄️",
            "☃️",
            "⛄",
            "🌬️",
            "💨",
            "💧",
            "💦",
            "☔",
            "☂️",
            "🌪️",
            "🌫️",
            "🌙",
            "🌘",
            "🌗",
            "🌖",
            "🌕",
            "🌔",
            "🌓",
            "🌒",
            "🌑",
            "🌛",
            "🌜",
            "⭐",
            "🌟",
            "💫",
            "✨",
            "☄️",
            "🪐",
            "🌍",
            "🌎",
            "🌏",
            "🌐",
            "🗺️",
            "🏔️",
            "⛰️",
            "🌋",
            "🗻",
            "🏕️",
            "🏖️",
            "🏜️",
            "🏝️",
            "🏞️",
            "🔥",
            "⚡",
            "🌀",
          ],
          "🍎 Food & Drink": [
            "🍎",
            "🍏",
            "🍐",
            "🍊",
            "🍋",
            "🍌",
            "🍉",
            "🍇",
            "🍓",
            "🫐",
            "🍈",
            "🍒",
            "🍑",
            "🥭",
            "🍍",
            "🥥",
            "🥝",
            "🍅",
            "🍆",
            "🥑",
            "🥦",
            "🥬",
            "🥒",
            "🌶️",
            "🫑",
            "🌽",
            "🥕",
            "🫒",
            "🧄",
            "🧅",
            "🥔",
            "🍠",
            "🥐",
            "🥖",
            "🍞",
            "🥨",
            "🥯",
            "🍳",
            "🥞",
            "🧇",
            "🥓",
            "🥩",
            "🍗",
            "🍖",
            "🌭",
            "🍔",
            "🍟",
            "🍕",
            "🥪",
            "🥙",
            "🧆",
            "🌮",
            "🌯",
            "🫔",
            "🥗",
            "8",
            "🫕",
            "🥫",
            "🍝",
            "🍜",
            "🍲",
            "🍛",
            "🍣",
            "🍱",
            "🥟",
            "🦪",
            "🍤",
            "🍙",
            "🍚",
            "🍘",
            "🍥",
            "🥠",
            "🥮",
            "🍢",
            "🍡",
            "🍧",
            "🍨",
            "🍦",
            "🥧",
            "🧁",
            "🍰",
            "🎂",
            "🍮",
            "🍭",
            "🍬",
            "🍫",
            "🍿",
            "🍩",
            "🍪",
            "🌰",
            "🥜",
            "🍯",
            "🥛",
            "🍼",
            "☕",
            "🍵",
            "🧃",
            "🥤",
            "🍶",
            "🍺",
            "🍻",
            "🥂",
            "🍷",
            "🥃",
            "🍸",
            "🍹",
            "🧉",
            "🍾",
            "🧊",
            "🥄",
            "🍴",
            "🍽️",
            "🥣",
            "🥡",
            "🥢",
            "🧂",
          ],
          "⚽ Activities": [
            "⚽",
            "🏀",
            "🏈",
            "⚾",
            "🥎",
            "🎾",
            "🏐",
            "🏉",
            "🥏",
            "🎱",
            "🪀",
            "🏓",
            "🏸",
            "🏒",
            "🏑",
            "🥍",
            "🏏",
            "🪃",
            "🥅",
            "⛳",
            "🪁",
            "🏹",
            "🎣",
            "🤿",
            "🥊",
            "🥋",
            "🎽",
            "🛹",
            "🛼",
            "🛷",
            "⛸️",
            "🥌",
            "🎿",
            "⛷️",
            "🏂",
            "🪂",
            "🏋️",
            "🤼",
            "🤸",
            "⛹️",
            "🤺",
            "🤾",
            "🏌️",
            "🏇",
            "🧘",
            "🏄",
            "🏊",
            "🤽",
            "🚣",
            "🧗",
            "🚵",
            "🚴",
            "🏆",
            "🥇",
            "🥈",
            "🥉",
            "🏅",
            "🎖️",
            "🏵️",
            "🎗️",
            "🎫",
            "🎟️",
            "🎪",
            "🤹",
            "🎭",
            "🩰",
            "🎨",
            "🎬",
            "🎤",
            "🎧",
            "🎼",
            "🎵",
            "🎶",
            "🎹",
            "🥁",
            "🎷",
            "🎺",
            "🎸",
            "🪕",
            "🎻",
            "🎲",
            "♠️",
            "♥️",
            "♦️",
            "♣️",
            "♟️",
            "🃏",
            "🀄",
            "🎴",
            "🎯",
            "🎳",
          ],
          "🚗 Travel & Places": [
            "🚗",
            "🚕",
            "🚙",
            "🚌",
            "🚎",
            "🏎️",
            "🚓",
            "🚑",
            "🚒",
            "🚐",
            "🛻",
            "🚚",
            "🚛",
            "🚜",
            "🏍️",
            "🛵",
            "🚲",
            "🛴",
            "🛹",
            "🛼",
            "🚁",
            "🛸",
            "✈️",
            "🛫",
            "🛬",
            "🪂",
            "💺",
            "🚀",
            "🛰️",
            "🚉",
            "🚞",
            "🚝",
            "🚄",
            "🚅",
            "🚈",
            "🚂",
            "🚆",
            "🚇",
            "🚊",
            "🚃",
            "🚋",
            "🚎",
            "🚌",
            "🚍",
            "🎡",
            "🎢",
            "🎠",
            "🏗️",
            "🌁",
            "🗼",
            "🏭",
            "⛲",
            "🎡",
            "🎢",
            "🏰",
            "🏯",
            "🏟️",
            "🎪",
            "🎭",
            "🖼️",
            "🎨",
            "🏛️",
            "🕌",
            "🛕",
            "⛪",
            "💒",
            "🏘️",
            "🏚️",
            "🏠",
            "🏡",
            "🏢",
            "🏣",
            "🏤",
            "🏥",
            "🏦",
            "🏧",
            "🏨",
            "🏩",
            "🏪",
            "🏫",
            "🏬",
            "🏭",
            "🏮",
            "🏯",
            "🏰",
            "🗻",
            "🗽",
            "⛪",
            "🕌",
            "🛕",
            "🕍",
            "⛩️",
            "🕋",
            "⛲",
            "⛱️",
            "🌋",
            "⛰️",
            "🏔️",
            "🗻",
            "🏕️",
            "⛺",
            "🏖️",
            "🏝️",
            "🏜️",
            "🏞️",
            "🛣️",
            "🛤️",
            "🌉",
            "🌁",
            "🌃",
            "🏙️",
            "🌇",
            "🌆",
            "🌄",
            "🌅",
            "🌠",
            "🎇",
            "🎆",
            "🌌",
            "🌉",
            "🌁",
          ],
          "📱 Objects": [
            "⌚",
            "📱",
            "📲",
            "💻",
            "⌨️",
            "🖥️",
            "🖨️",
            "🖱️",
            "🖲️",
            "🕹️",
            "🗜️",
            "💽",
            "💾",
            "💿",
            "📀",
            "📼",
            "📷",
            "📸",
            "📹",
            "🎥",
            "📽️",
            "🎞️",
            "📞",
            "☎️",
            "📟",
            "📠",
            "📺",
            "📻",
            "🎙️",
            "🎚️",
            "🎛️",
            "🧭",
            "⏱️",
            "⏲️",
            "⏰",
            "🕰️",
            "⌛",
            "⏳",
            "📡",
            "🔋",
            "🔌",
            "💡",
            "🔦",
            "🕯️",
            "🪔",
            "🧯",
            "🛢️",
            "💸",
            "💵",
            "💴",
            "💶",
            "💷",
            "💰",
            "💳",
            "💎",
            "⚖️",
            "🧰",
            "🔧",
            "🔨",
            "⚒️",
            "🛠️",
            "⛏️",
            "🔩",
            "⚙️",
            "🧱",
            "⛓️",
            "🧲",
            "🔫",
            "💣",
            "🧨",
            "🪓",
            "🔪",
            "🗡️",
            "⚔️",
            "🛡️",
            "🚬",
            "⚰️",
            "⚱️",
            "🏺",
            "🔮",
            "📿",
            "🧿",
            "💈",
            "⚗️",
            "🔭",
            "🔬",
            "🕳️",
            "🩹",
            "🩺",
            "💊",
            "💉",
            "🧬",
            "🦠",
            "🧫",
            "🧪",
            "🌡️",
            "🧹",
            "🧺",
            "🧻",
            "🚽",
            "🚰",
            "🚿",
            "🛁",
            "🛀",
            "🧼",
            "🪒",
            "🧴",
            "🧷",
            "🧹",
            "🧺",
            "🧻",
            "🪣",
            "🧽",
            "🧯",
            "🛒",
            "🚬",
            "💣",
            "🔫",
            "🧨",
            "🪓",
            "🔪",
            "🗡️",
            "⚔️",
            "🛡️",
            "🚬",
            "⚰️",
            "⚱️",
            "🏺",
          ],
          "🔤 Symbols": [
            "❤️",
            "🧡",
            "💛",
            "💚",
            "💙",
            "💜",
            "🖤",
            "🤍",
            "🤎",
            "💔",
            "❣️",
            "💕",
            "💞",
            "💓",
            "💗",
            "💖",
            "💘",
            "💝",
            "💟",
            "☮️",
            "✝️",
            "☪️",
            "🕉️",
            "☸️",
            "✡️",
            "🔯",
            "🕎",
            "☯️",
            "☦️",
            "🛐",
            "⛎",
            "♈",
            "♉",
            "♊",
            "♋",
            "♌",
            "♍",
            "♎",
            "♏",
            "♐",
            "♑",
            "♒",
            "♓",
            "🆔",
            "⚛️",
            "🉑",
            "☢️",
            "☣️",
            "📴",
            "📳",
            "🈶",
            "🈚",
            "🈸",
            "🈺",
            "🈷️",
            "✴️",
            "🆚",
            "💮",
            "🉐",
            "㊙️",
            "㊗️",
            "🈴",
            "🈵",
            "🈹",
            "🈲",
            "🅰️",
            "🅱️",
            "🆎",
            "🆑",
            "🅾️",
            "🆘",
            "❌",
            "⭕",
            "🛑",
            "⛔",
            "📛",
            "🚫",
            "💯",
            "💢",
            "♨️",
            "🚷",
            "🚯",
            "🚳",
            "🚱",
            "🔞",
            "📵",
            "🚭",
            "❗",
            "❕",
            "❓",
            "❔",
            "‼️",
            "⁉️",
            "🔅",
            "🔆",
            "〽️",
            "⚠️",
            "🚸",
            "🔱",
            "⚜️",
            "🔰",
            "♻️",
            "✅",
            "🈯",
            "💹",
            "❇️",
            "✳️",
            "❎",
            "🌐",
            "💠",
            "Ⓜ️",
            "🌀",
            "💤",
            "🏧",
            "🚾",
            "♿",
            "🅿️",
            "🈳",
            "🈂️",
            "🛂",
            "🛃",
            "🛄",
            "🛅",
            "🚹",
            "🚺",
            "🚼",
            "🚻",
            "🚮",
            "🎦",
            "📶",
            "🈁",
            "🔣",
            "ℹ️",
            "🔤",
            "🔡",
            "🔠",
            "🆖",
            "🆗",
            "🆙",
            "🆒",
            "🆕",
            "🆓",
            "0️⃣",
            "1️⃣",
            "2️⃣",
            "3️⃣",
            "4️⃣",
            "5️⃣",
            "6️⃣",
            "7️⃣",
            "8️⃣",
            "9️⃣",
            "🔟",
            "🔢",
            "#️⃣",
            "*️⃣",
            "⏏️",
            "▶️",
            "⏸️",
            "⏯️",
            "⏹️",
            "⏺️",
            "⏭️",
            "⏮️",
            "⏩",
            "⏪",
            "⏫",
            "⏬",
            "◀️",
            "🔼",
            "🔽",
            "➡️",
            "⬅️",
            "⬆️",
            "⬇️",
            "↗️",
            "↘️",
            "↙️",
            "↖️",
            "↕️",
            "↔️",
            "↪️",
            "↩️",
            "⤴️",
            "⤵️",
            "🔀",
            "🔁",
            "🔂",
            "🔄",
            "🔃",
            "🎵",
            "🎶",
            "➕",
            "➖",
            "➗",
            "✖️",
            "♾️",
            "💲",
            "💱",
            "™️",
            "©️",
            "®️",
            "〰️",
            "➰",
            "➿",
            "🔚",
            "🔙",
            "🔛",
            "🔝",
            "🔜",
            "✔️",
            "☑️",
            "🔘",
            "🔴",
            "🟠",
            "🟡",
            "🟢",
            "🔵",
            "🟣",
            "⚫",
            "⚪",
            "🟤",
            "🔺",
            "🔻",
            "🔸",
            "🔹",
            "🔶",
            "🔷",
            "🔳",
            "🔲",
            "▪️",
            "▫️",
            "◾",
            "◽",
            "◼️",
            "◻️",
            "🟥",
            "🟧",
            "🟨",
            "🟩",
            "🟦",
            "🟪",
            "⬛",
            "⬜",
            "🟫",
            "🔈",
            "🔇",
            "🔉",
            "🔊",
            "🔔",
            "🔕",
            "📣",
            "📢",
            "👁️‍🗨️",
            "💬",
            "💭",
            "🗯️",
            "♠️",
            "♣️",
            "♥️",
            "♦️",
            "🃏",
            "🎴",
            "🀄",
            "🕐",
            "🕑",
            "🕒",
            "🕓",
            "🕔",
            "🕕",
            "🕖",
            "🕗",
            "🕘",
            "🕙",
            "🕚",
            "🕛",
            "🕜",
            "🕝",
            "🕞",
            "🕟",
            "🕠",
            "🕡",
            "🕢",
            "🕣",
            "🕤",
            "🕥",
            "🕦",
            "🕧",
          ],
          "🏁 Flags": [
            "🏁",
            "🚩",
            "🎌",
            "🏴",
            "🏳️",
            "🏳️‍🌈",
            "🏳️‍⚧️",
            "🏴‍☠️",
            "🇦🇫",
            "🇦🇽",
            "🇦🇱",
            "🇩🇿",
            "🇦🇸",
            "🇦🇩",
            "🇦🇴",
            "🇦🇮",
            "🇦🇶",
            "🇦🇬",
            "🇦🇷",
            "🇦🇲",
            "🇦🇼",
            "🇦🇺",
            "🇦🇹",
            "🇦🇿",
            "🇧🇸",
            "🇧🇭",
            "🇧🇩",
            "🇧🇧",
            "🇧🇾",
            "🇧🇪",
            "🇧🇿",
            "🇧🇯",
            "🇧🇲",
            "🇧🇹",
            "🇧🇴",
            "🇧🇦",
            "🇧🇼",
            "🇧🇷",
            "🇮🇴",
            "🇻🇬",
            "🇧🇳",
            "🇧🇬",
            "🇧🇫",
            "🇧🇮",
            "🇰🇭",
            "🇨🇲",
            "🇨🇦",
            "🇮🇨",
            "🇨🇻",
            "🇧🇶",
            "🇰🇾",
            "🇨🇫",
            "🇹🇩",
            "🇨🇱",
            "🇨🇳",
            "🇨🇽",
            "🇨🇨",
            "🇨🇴",
            "🇰🇲",
            "🇨🇬",
            "🇨🇩",
            "🇨🇰",
            "🇨🇷",
            "🇨🇮",
            "🇭🇷",
            "🇨🇺",
            "🇨🇼",
            "🇨🇾",
            "🇨🇿",
            "🇩🇰",
            "🇩🇯",
            "🇩🇲",
            "🇩🇴",
            "🇪🇨",
            "🇪🇬",
            "🇸🇻",
            "🇬🇶",
            "🇪🇷",
            "🇪🇪",
            "🇪🇹",
            "🇪🇺",
            "🇫🇰",
            "🇫🇴",
            "🇫🇯",
            "🇫🇮",
            "🇫🇷",
            "🇬🇫",
            "🇵🇫",
            "🇹🇫",
            "🇬🇦",
            "🇬🇲",
            "🇬🇪",
            "🇩🇪",
            "🇬🇭",
            "🇬🇮",
            "🇬🇷",
            "🇬🇱",
            "🇬🇩",
            "🇬🇵",
            "🇬🇺",
            "🇬🇹",
            "🇬🇬",
            "🇬🇳",
            "🇬🇼",
            "🇬🇾",
            "🇭🇹",
            "🇭🇳",
            "🇭🇰",
            "🇭🇺",
            "🇮🇸",
            "🇮🇳",
            "🇮🇩",
            "🇮🇷",
            "🇮🇶",
            "🇮🇪",
            "🇮🇲",
            "🇮🇱",
            "🇮🇹",
            "🇯🇲",
            "🇯🇵",
            "🎌",
            "🇯🇪",
            "🇯🇴",
            "🇰🇿",
            "🇰🇪",
            "🇰🇮",
            "🇽🇰",
            "🇰🇼",
            "🇰🇬",
            "🇱🇦",
            "🇱🇻",
            "🇱🇧",
            "🇱🇸",
            "🇱🇷",
            "🇱🇾",
            "🇱🇮",
            "🇱🇹",
            "🇱🇺",
            "🇲🇴",
            "🇲🇰",
            "🇲🇬",
            "🇲🇼",
            "🇲🇾",
            "🇲🇻",
          ],
        };

        // Flatten all emojis for the main array
        const allEmojis = Object.values(whatsappEmojiCategories).flat();
        setEmojiData(allEmojis);
        setEmojiCategories(whatsappEmojiCategories);
      } catch (error) {
        console.error("Failed to load emojis:", error);
      } finally {
        setEmojiLoading(false);
      }
    };

    if (showEmojiPicker) {
      loadEmojis();
    }
  }, [showEmojiPicker, emojiData.length]);

  useEffect(() => {
    loadGoogleFont(selectedFont);
  }, [selectedFont]);

  // function triggerAutoSaveDraft() {
  //   if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
  //   autoSaveTimeout.current = setTimeout(() => {
  //     handleSaveDraft({ showToast: false });
  //   }, 3000);
  // }

  // // Call triggerAutoSaveDraft in relevant onChange handlers
  // // For toList, ccList, bccList, subject, and body
  // useEffect(() => {
  //   triggerAutoSaveDraft();
  // }, [toList, ccList, bccList, subject, body]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Debug click outside
      console.log("Click outside event", event.target);
      if (
        showFormattingDropdown &&
        formattingDropdownRef.current &&
        !formattingDropdownRef.current.contains(event.target as Node) &&
        formattingButtonRef.current &&
        !formattingButtonRef.current.contains(event.target as Node)
      ) {
        console.log("Closing formatting dropdown from click outside");
        setShowFormattingDropdown(false);
      }
      if (
        sendOptionsRef.current &&
        !sendOptionsRef.current.contains(event.target as Node)
      ) {
        setShowSendOptions(false);
      }
      if (
        moreOptionsRef.current &&
        !moreOptionsRef.current.contains(event.target as Node)
      ) {
        setShowMoreOptions(false);
        setShowLabelSubmenu(false);
        setShowMeetingSubmenu(false);
      }
      if (
        inputToolsRef.current &&
        !inputToolsRef.current.contains(event.target as Node)
      ) {
        setShowInputTools(false);
      }
    }

    if (
      showSendOptions ||
      showMoreOptions ||
      showInputTools ||
      showFormattingDropdown
    ) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [
    showSendOptions,
    showMoreOptions,
    showInputTools,
    showFormattingDropdown,
  ]);

  // Close color picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showColorPicker &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node) &&
        colorButtonRef.current &&
        !colorButtonRef.current.contains(event.target as Node)
      ) {
        setShowColorPicker(false);
      }
    }
    if (showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showColorPicker]);

  // Close alignment dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showAlignmentDropdown &&
        alignmentDropdownRef.current &&
        !alignmentDropdownRef.current.contains(event.target as Node) &&
        alignmentButtonRef.current &&
        !alignmentButtonRef.current.contains(event.target as Node)
      ) {
        setShowAlignmentDropdown(false);
      }
    }
    if (showAlignmentDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAlignmentDropdown]);

  // Formatting state for toolbar
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Helper to update formatting state
  function updateFormattingState() {
    setIsBold(document.queryCommandState("bold"));
    setIsItalic(document.queryCommandState("italic"));
    setIsUnderline(document.queryCommandState("underline"));
  }

  // Listen for selection change and input in contentEditable
  useEffect(() => {
    function handleSelectionChange() {
      if (document.activeElement === textareaRef.current) {
        updateFormattingState();
      }
    }
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  // Save/restore selection helpers
  let savedSelection: Range | null = null;
  function saveSelectionRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelectionRange() {
    if (savedSelection) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelection);
      }
    }
  }

  // Formatting function for execCommand
  function format(command: string, value?: string) {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand(command, false, value);
      updateFormattingState(); // Ensure toolbar updates immediately
    }
  }

  // Add event listeners for mouseup and keyup to update formatting state
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = () => updateFormattingState();
    el.addEventListener("mouseup", handler);
    el.addEventListener("keyup", handler);
    return () => {
      el.removeEventListener("mouseup", handler);
      el.removeEventListener("keyup", handler);
    };
  }, []);

  // Native undo/redo handlers
  function handleUndo() {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand("undo");
    }
  }
  function handleRedo() {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand("redo");
    }
  }

  // Utility to extract plain text from HTML
  const extractPlainText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.innerText;
  };

  if (!isOpen) return null;

  // Helper to convert File to base64
  function fileToBase64(
    file: File
  ): Promise<{ filename: string; content: string; contentType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          filename: file.name,
          content: (reader.result as string).split(",")[1], // Remove data:...;base64,
          contentType: file.type,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Update handleSend to POST to /mails/sendmail
  async function handleSend(scheduledAt?: string) {
    setSendStatus("sending");
    onClose(); // close modal immediately
    const html = textareaRef.current?.innerHTML || "";
    const files = attachments || [];
    const attachmentsPayload = await Promise.all(files.map(fileToBase64));
    const payload: any = {
      mail_Id,
      from,
      to: toList.join(","),
      cc: ccList.join(","),
      bcc: bccList.join(","),
      subject,
      content: html,
      contentType: "text/html",
      attachments: attachmentsPayload,
      ...(threadId ? { threadId } : {}),
      ...(replyToMessageId ? { replyToMessageId } : {}),
      labelUniqueId: selectedLabels, // Array of labelUniqueId
      scheduledAt,
    };
    if (scheduledAt) {
      payload.scheduledAt = scheduledAt;
    }
    console.log("[DEBUG] Sending payload:", payload);
    try {
      const result = await apiRequest("POST", "/mails/sendmail", payload);
      if (
        (result && result.status === 200) ||
        result?.mailSent ||
        result?.mailsent
      ) {
        setSendStatus("sent");
        setSentMailId(result.record?.sendMail_Id || null);
      } else {
        setSendStatus("idle");
      }
    } catch (err) {
      setSendStatus("idle");
    }
  }

  // Modified handleSaveDraft to accept showToast param
  async function handleSaveDraft({ showToast = true } = {}) {
    const html = textareaRef.current?.innerHTML || "";
    const files = attachments || [];
    const attachmentsPayload = await Promise.all(files.map(fileToBase64));
    const payload = {
      mail_Id,
      from,
      to: toList.join(","),
      cc: ccList.join(","),
      bcc: bccList.join(","),
      subject,
      content: html,
      contentType: "text/html",
      attachments: attachmentsPayload,
      status: "draft",
      ...(draftMessageId ? { messageId: draftMessageId } : {}),
      ...(threadId ? { threadId } : {}),
    };
    try {
      const result = await apiRequest("POST", "/mails/sendmail", payload);
      // If this is the first save, store the messageId returned by backend
      if (!draftMessageId && result?.record?.messageId) {
        setDraftMessageId(result.record.messageId);
      }
      if (result && result.success !== false) {
        if (showToast && !autoSaveToastShown) {
          toast({ title: "Draft saved!", description: result.message });
          setAutoSaveToastShown(true);
        }
        if (showToast) onClose();
      } else {
        if (showToast)
          toast({
            title: "Save draft failed",
            description: result.message || "Failed to save draft",
            variant: "destructive",
          });
      }
    } catch (err: any) {
      if (showToast)
        toast({
          title: "Save draft failed",
          description: err.message,
          variant: "destructive",
        });
    }
  }

  // Debounced auto-save function

  const handleScheduleSend = async (scheduledTime: Date) => {
    if (toList.length === 0 || !subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient and subject",
        variant: "destructive",
      });
      return;
    }
    try {
      await handleSend(scheduledTime.toISOString());
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setAttachments([]);
      onClose();
      setShowSendOptions(false);
      setShowDateTimePicker(false);
    } catch (error) {
      console.error("Failed to schedule email:", error);
      toast({
        title: "Scheduling Failed",
        description: "Failed to schedule email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCustomSchedule = () => {
    if (!customScheduleDate || !customScheduleTime) {
      toast({
        title: "Incomplete Selection",
        description: "Please select both date and time",
        variant: "destructive",
      });
      return;
    }

    const scheduledDateTime = new Date(
      `${customScheduleDate}T${customScheduleTime}`
    );
    const now = new Date();

    if (scheduledDateTime <= now) {
      toast({
        title: "Invalid Time",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    handleScheduleSend(scheduledDateTime);
  };

  const showCustomDateTimePicker = () => {
    setShowDateTimePicker(true);
    setShowSendOptions(false);

    // Set default values to tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    setCustomScheduleDate(dateStr);
    setCustomScheduleTime("09:00");
  };

  const getScheduleOptions = () => {
    const now = new Date();
    const options = [];

    // Tomorrow 8 AM
    const tomorrow8AM = new Date();
    tomorrow8AM.setDate(now.getDate() + 1);
    tomorrow8AM.setHours(8, 0, 0, 0);
    options.push({
      label: "Tomorrow 8:00 AM",
      time: tomorrow8AM,
    });

    // Monday 8 AM (if today is not Monday)
    const nextMonday = new Date();
    nextMonday.setDate(now.getDate() + ((7 - now.getDay() + 1) % 7 || 7));
    nextMonday.setHours(8, 0, 0, 0);
    if (nextMonday.getTime() > now.getTime()) {
      options.push({
        label: "Monday 8:00 AM",
        time: nextMonday,
      });
    }

    // This afternoon (2 PM today if it's before 2 PM)
    if (now.getHours() < 14) {
      const thisAfternoon = new Date();
      thisAfternoon.setHours(14, 0, 0, 0);
      options.push({
        label: "This afternoon 2:00 PM",
        time: thisAfternoon,
      });
    }

    return options;
  };

  const handleAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to insert text at caret in contentEditable div
  function insertTextAtCaret(text: string) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    // Move caret after inserted text
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Update insertText to use the helper
  const insertText = (text: string) => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      insertTextAtCaret(text);
      // Update bodyHtml state after insertion
      // setBodyHtml(textareaRef.current.innerHTML);
    }
  };

  // Promise-based dialog utility
  // function showInputDialog({ title, message, placeholder, defaultValue = "" }) {
  //   return new Promise<string>((resolve) => {
  //     setInputDialog({
  //       isOpen: true,
  //       title,
  //       message,
  //       placeholder,
  //       defaultValue,
  //       onConfirm: (value) => resolve(value),
  //     });
  //   });
  // }

  // Refactored insertLink with full console logging
  const insertLink = () => {
    const url = window.prompt("Enter the URL (include https://):");
    if (!url) return;
    let safeUrl = url.trim();
    if (safeUrl && !/^https?:\/\//i.test(safeUrl)) {
      safeUrl = "https://" + safeUrl;
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
      const sel = window.getSelection();
      let text =
        sel && sel.rangeCount > 0 && !sel.isCollapsed
          ? sel.toString()
          : safeUrl;
      const html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      document.execCommand("insertHTML", false, html);
    }
  };

  const toggleFormatting = () => {
    setIsFormatting(!isFormatting);
  };

  const addEmoji = (emoji: string) => {
    insertText(emoji);
    setShowEmojiPicker(false);
  };

  const toggleConfidential = () => {
    setIsConfidential(!isConfidential);
  };

  const insertSignature = () => {
    if (enableSignature && signature.trim()) {
      // Add signature at the end of the body with proper formatting
      const signatureText = `\n\n${signature}`;
      setBody((prev) => prev + signatureText);

      // Focus the textarea after inserting signature
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      // If no signature is set, provide a helpful message
      toast({
        title: "No Signature Found",
        description:
          "Please set up your signature in Settings > General > Signature.",
        variant: "destructive",
      });
    }
  };

  // Update handleDiscard to call handleSaveDraft if there is content
  const handleDiscard = async () => {
    const hasContent =
      toList.length > 0 ||
      ccList.length > 0 ||
      bccList.length > 0 ||
      subject.trim() ||
      (textareaRef.current && textareaRef.current.innerText.trim()) ||
      attachments.length > 0;

    if (hasContent) {
      await handleSaveDraft({ showToast: true });
    } else {
      onClose();
    }
  };

  const commonEmojis = [
    "😊",
    "😂",
    "❤️",
    "👍",
    "👏",
    "🎉",
    "🔥",
    "💯",
    "😎",
    "🤔",
    "😍",
    "🙏",
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Update body change handler to push to undo stack
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
  };

  // Selection API helpers for contentEditable div
  function saveSelection(containerEl: HTMLDivElement | null) {
    if (!containerEl) return null;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Only save if selection is inside the container
      if (containerEl.contains(range.startContainer)) {
        return {
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset,
        };
      }
    }
    return null;
  }

  function restoreSelection(containerEl: HTMLDivElement | null, saved: any) {
    if (!containerEl || !saved) return;
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      try {
        range.setStart(saved.startContainer, saved.startOffset);
        range.setEnd(saved.endContainer, saved.endOffset);
        selection.addRange(range);
      } catch (e) {
        // fallback: focus the div
        containerEl.focus();
      }
    }
  }

  // Color palette (Google style)
  const colorPalette = [
    [
      "#000000",
      "#444444",
      "#666666",
      "#999999",
      "#cccccc",
      "#efefef",
      "#f7f7f7",
      "#ffffff",
    ],
    [
      "#ff0000",
      "#ff9900",
      "#ffff00",
      "#00ff00",
      "#00ffff",
      "#0000ff",
      "#9900ff",
      "#ff00ff",
    ],
    [
      "#f4cccc",
      "#fce5cd",
      "#fff2cc",
      "#d9ead3",
      "#d0e0e3",
      "#cfe2f3",
      "#d9d2e9",
      "#ead1dc",
    ],
    [
      "#ea9999",
      "#f9cb9c",
      "#ffe599",
      "#b6d7a8",
      "#a2c4c9",
      "#9fc5e8",
      "#b4a7d6",
      "#d5a6bd",
    ],
    [
      "#e06666",
      "#f6b26b",
      "#ffd966",
      "#93c47d",
      "#76a5af",
      "#6fa8dc",
      "#8e7cc3",
      "#c27ba0",
    ],
    [
      "#cc0000",
      "#e69138",
      "#f1c232",
      "#6aa84f",
      "#45818e",
      "#3d85c6",
      "#674ea7",
      "#a64d79",
    ],
    [
      "#990000",
      "#b45f06",
      "#bf9000",
      "#38761d",
      "#134f5c",
      "#0b5394",
      "#351c75",
      "#741b47",
    ],
    [
      "#660000",
      "#783f04",
      "#7f6000",
      "#274e13",
      "#0c343d",
      "#073763",
      "#20124d",
      "#4c1130",
    ],
  ];

  // Show color picker and set its position, saving selection with rangy
  function handleShowColorPicker() {
    if (colorButtonRef.current) {
      // Save selection using rangy
      savedColorPickerSelection.current = rangy.saveSelection();
      const rect = colorButtonRef.current.getBoundingClientRect();
      setColorPickerPos({
        top: rect.top + window.scrollY - 16,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setShowColorPicker(true);
    }
  }

  // Restore selection before applying color using rangy
  function restoreColorPickerSelection() {
    if (savedColorPickerSelection.current) {
      rangy.restoreSelection(savedColorPickerSelection.current);
    }
  }

  // Handle color pick (with selection restore and fallback for background)
  function handleColorPick(type: "foreColor" | "hiliteColor", color: string) {
    if (textareaRef.current) {
      rangy.restoreSelection(savedColorPickerSelection.current);
      textareaRef.current.focus();

      // Double-check selection is inside contentEditable
      const sel = window.getSelection();
      if (
        !sel ||
        !sel.rangeCount ||
        !textareaRef.current.contains(sel.anchorNode)
      ) {
        const range = document.createRange();
        range.selectNodeContents(textareaRef.current);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      // Use setTimeout to ensure focus/selection before execCommand
      setTimeout(() => {
        if (type === "hiliteColor") {
          document.execCommand("hiliteColor", false, color);
          document.execCommand("backColor", false, color);
        } else {
          document.execCommand(type, false, color);
        }
        updateFormattingState();
        setShowColorPicker(false);
      }, 0);
    }
  }

  // Alignment icons
  const alignmentIcons = {
    left: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="2" rx="1" />
        <rect x="3" y="10" width="12" height="2" rx="1" />
        <rect x="3" y="14" width="18" height="2" rx="1" />
        <rect x="3" y="18" width="12" height="2" rx="1" />
      </svg>
    ),
    center: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="2" rx="1" />
        <rect x="3" y="10" width="18" height="2" rx="1" />
        <rect x="6" y="14" width="12" height="2" rx="1" />
        <rect x="3" y="18" width="18" height="2" rx="1" />
      </svg>
    ),
    right: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="2" rx="1" />
        <rect x="9" y="10" width="12" height="2" rx="1" />
        <rect x="3" y="14" width="18" height="2" rx="1" />
        <rect x="9" y="18" width="12" height="2" rx="1" />
      </svg>
    ),
    justify: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="2" rx="1" />
        <rect x="3" y="10" width="18" height="2" rx="1" />
        <rect x="3" y="14" width="18" height="2" rx="1" />
        <rect x="3" y="18" width="18" height="2" rx="1" />
      </svg>
    ),
  };

  // Alignment command mapping
  const alignmentCommands = {
    left: "justifyLeft",
    center: "justifyCenter",
    right: "justifyRight",
    justify: "justifyFull",
  };

  // Handle alignment change
  function handleAlignmentChange(
    alignment: "left" | "center" | "right" | "justify"
  ) {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand(alignmentCommands[alignment]);
      setCurrentAlignment(alignment);
      setShowAlignmentDropdown(false);
    }
  }

  // Sort fontList alphabetically
  const fontList = [
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
  ].sort();

  // Helper to dynamically load Google Fonts
  function loadGoogleFont(fontName: string) {
    const systemFonts = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Georgia",
      "Verdana",
      "Comic Sans MS",
      "Trebuchet MS",
      "Arial Black",
      "Impact",
    ];
    if (systemFonts.includes(fontName)) return;
    const existingLink = document.querySelector(
      `link[href*="${fontName.replace(/\s+/g, "+")}"]`
    );
    if (existingLink) return;
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(
      /\s+/g,
      "+"
    )}:wght@300;400;500;600;700&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  // When font changes, load it

  // Font dropdown handler
  function handleFontChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const font = e.target.value;
    setSelectedFont(font);
    loadGoogleFont(font);
    if (textareaRef.current) {
      textareaRef.current.focus();
      const sel = window.getSelection();
      console.log("[DEBUG] handleFontChange called");
      if (sel) {
        console.log(
          "[DEBUG] Selection:",
          sel.toString(),
          "Range count:",
          sel.rangeCount,
          "Is collapsed:",
          sel.isCollapsed
        );
        if (sel.anchorNode) {
          console.log(
            "[DEBUG] anchorNode:",
            sel.anchorNode,
            "parent:",
            sel.anchorNode.parentElement
          );
        }
      }
      if (
        sel &&
        sel.rangeCount > 0 &&
        !sel.isCollapsed &&
        textareaRef.current.contains(sel.anchorNode)
      ) {
        // --- Detect if selection covers the entire editor ---
        const range = sel.getRangeAt(0);
        // --- Detect if selection covers the entire editor ---
        const editor = textareaRef.current;
        const isSelectAll =
          range.startContainer === editor &&
          range.endContainer === editor &&
          range.startOffset === 0 &&
          range.endOffset === editor.childNodes.length;
        if (isSelectAll) {
          // Wrap all content in a new span with the selected font
          const span = document.createElement("span");
          span.style.fontFamily = font;
          // Move all children into the span
          while (editor.firstChild) {
            span.appendChild(editor.firstChild);
          }
          editor.appendChild(span);
          // Place caret at the end of the new span
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          // --- Robust Range API solution with cleanup ---
          const selectedContents = range.extractContents();
          const cleanedContents = cleanFontNodes(selectedContents);
          const span = document.createElement("span");
          span.style.fontFamily = font;
          if (cleanedContents) {
            span.appendChild(cleanedContents);
          }
          range.insertNode(span);
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          newRange.collapse(false); // place caret at end
          sel.removeAllRanges();
          sel.addRange(newRange);
          // --- Remove zero-width space if present at the start ---
          if (
            span.firstChild &&
            span.firstChild.nodeType === Node.TEXT_NODE &&
            span.firstChild.textContent &&
            span.firstChild.textContent.charAt(0) === "\u200B"
          ) {
            span.firstChild.textContent = span.firstChild.textContent.replace(
              /^\u200B+/, ""
            );
          }
          // --- End robust solution ---
        }
        // --- End robust solution ---
      } else if (
        sel &&
        sel.rangeCount > 0 &&
        sel.isCollapsed &&
        textareaRef.current.contains(sel.anchorNode)
      ) {
        // --- No selection: Insert a styled span at the caret for future typing and pasting ---
        const range = sel.getRangeAt(0);
        const span = document.createElement("span");
        span.style.fontFamily = font;
        span.appendChild(document.createTextNode("\u200B")); // zero-width space
        range.insertNode(span);
        // Move caret inside the span, after the zero-width space
        range.setStart(span.firstChild || span, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        textareaRef.current.focus();
        // --- End no-selection span insertion ---
      } else {
        // No selection or selection not in textarea, fallback
        console.log(
          '[DEBUG] No selection or selection not in textarea, using execCommand("fontName")'
        );
        document.execCommand("fontName", false, font);
      }
    }
  }

  // Helper function to check if content already contains the suggestion or is sufficiently complete
  function isContentComplete(content: string, suggestionType: string): boolean {
    const lowerContent = content.toLowerCase();

    switch (suggestionType) {
      case 'meeting':
        return lowerContent.includes('looking forward to our meeting') ||
          lowerContent.includes('meeting details') ||
          lowerContent.includes('about our meeting');
      case 'report':
        return lowerContent.includes('attached the report') ||
          lowerContent.includes('report is attached') ||
          lowerContent.includes('review the report');
      case 'update':
        return lowerContent.includes('latest update') ||
          lowerContent.includes('project update') ||
          lowerContent.includes('status update');
      case 'question':
        return lowerContent.includes('hope this email finds you well') ||
          lowerContent.includes('regarding my question') ||
          lowerContent.includes('follow up on my question');
      case 'thank':
        return lowerContent.includes('thank you for your time') ||
          lowerContent.includes('thanks for your time') ||
          lowerContent.includes('for your time and consideration');
      case 'best':
        return lowerContent.includes('best regards') ||
          lowerContent.includes('regards') ||
          lowerContent.includes('best wishes');
      default:
        return false;
    }
  }

  // Handler to update isBodyEmpty on input and generate suggestions
  function handleBodyInput() {
    if (textareaRef.current) {
      const content = textareaRef.current.innerText.trim();
      setIsBodyEmpty(!content);

      // Update email context for contextual relevance checking
      const newContext = subject.toLowerCase();
      if (newContext !== emailContext) {
        setEmailContext(newContext);
      }

      // Check if we already have an inline suggestion displayed
      const existingSuggestions = textareaRef.current.querySelectorAll('.inline-suggestion');
      if (existingSuggestions && existingSuggestions.length > 0) {
        // Don't generate a new suggestion if one is already displayed
        return;
      }

      // Generate suggestions only if we have a subject and content
      if (subject && content) {
        let newSuggestion = "";
        let shouldShowSuggestion = false;
        let suggestionType = "";

        // Generate suggestion based on subject
        if (subject.toLowerCase().includes("meeting") && !isContentComplete(content, 'meeting')) {
          newSuggestion = " I'm looking forward to our meeting. Please let me know if you need any additional information.";
          shouldShowSuggestion = true;
          suggestionType = "meeting";
        } else if (subject.toLowerCase().includes("report") && !isContentComplete(content, 'report')) {
          newSuggestion = " I've attached the report for your review. Please let me know if you have any questions.";
          shouldShowSuggestion = true;
          suggestionType = "report";
        } else if (subject.toLowerCase().includes("update") && !isContentComplete(content, 'update')) {
          newSuggestion = " Here's the latest update on the project. Let me know your thoughts.";
          shouldShowSuggestion = true;
          suggestionType = "update";
        } else if (subject.toLowerCase().includes("question") && !isContentComplete(content, 'question')) {
          newSuggestion = " I hope this email finds you well. I wanted to follow up on my question.";
          shouldShowSuggestion = true;
          suggestionType = "question";
        } else if (content.endsWith("Thank") && !isContentComplete(content, 'thank')) {
          newSuggestion = " you for your time and consideration.";
          shouldShowSuggestion = true;
          suggestionType = "thank";
        } else if (content.endsWith("Best") && !isContentComplete(content, 'best')) {
          newSuggestion = " regards,";
          shouldShowSuggestion = true;
          suggestionType = "best";
        }

        // Check if this suggestion has already been accepted
        if (shouldShowSuggestion && acceptedSuggestions.includes(newSuggestion)) {
          shouldShowSuggestion = false;
        }

        // If we have a suggestion, display it inline at the cursor position
        if (shouldShowSuggestion) {
          // First, remove any existing inline suggestion spans
          if (textareaRef.current) {
            const existingSuggestions = textareaRef.current.querySelectorAll('.inline-suggestion');
            existingSuggestions.forEach(span => span.remove());
          }

          // Get the current selection
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            // Store the current selection range
            const range = selection.getRangeAt(0);

            // Create a temporary span for the suggestion
            const suggestionSpan = document.createElement('span');
            suggestionSpan.className = 'inline-suggestion';
            suggestionSpan.style.color = 'rgba(100, 100, 100, 0.5)';
            suggestionSpan.style.pointerEvents = 'none';
            suggestionSpan.style.position = 'static'; // Use static positioning to stay in text flow
            suggestionSpan.style.display = 'inline'; // Use inline display to ensure it stays on the same line

            // Create the suggestion text
            const suggestionText = document.createTextNode(newSuggestion);
            suggestionSpan.appendChild(suggestionText);

            // Add a small visual indicator for Tab key
            const tabIndicator = document.createElement('span');
            tabIndicator.textContent = ' [Tab]';
            tabIndicator.style.fontSize = '0.8em';
            tabIndicator.style.backgroundColor = 'rgba(200, 200, 200, 0.3)';
            tabIndicator.style.padding = '0 3px';
            tabIndicator.style.borderRadius = '2px';
            tabIndicator.style.marginLeft = '2px';
            suggestionSpan.appendChild(tabIndicator);

            // Insert the suggestion span at the current cursor position
            try {
              range.insertNode(suggestionSpan);

              // Move the cursor back to before the suggestion
              range.setEndBefore(suggestionSpan);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (error) {
              console.error('Error inserting suggestion:', error);
            }
          }
        }

        // Update suggestion state
        if (shouldShowSuggestion) {
          setSuggestion(newSuggestion);
          setShowSuggestion(true);
        } else {
          setSuggestion("");
          setShowSuggestion(false);

          // Remove any existing inline suggestion spans
          if (textareaRef.current) {
            const suggestionSpans = textareaRef.current.querySelectorAll('.inline-suggestion');
            suggestionSpans.forEach(span => span.remove());
          }
        }
      } else {
        setShowSuggestion(false);
      }
    }
  }

  // Add state for HTML template dialog at the top of the component

  function handleInsertHtmlTemplate() {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand("insertHTML", false, htmlTemplateInput);
      setShowHtmlTemplateDialog(false);
      setHtmlTemplateInput("");
    }
  }

  const handleInsertLinkClick = () => {
    const sel = window.getSelection();
    const selectedText =
      sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.toString() : "";
    setLinkUrl("");
    setLinkError("");
    setLinkText(selectedText);
    setShowLinkModal(true);
  };

  const handleLinkModalOk = () => {
    let safeUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(safeUrl)) {
      safeUrl = "https://" + safeUrl;
    }
    let text = linkText.trim();
    if (textareaRef.current) {
      textareaRef.current.focus();
      const sel = window.getSelection();
      if (!text && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        text = sel.toString();
      }
      if (!text) text = safeUrl;

      if (
        sel &&
        sel.rangeCount > 0 &&
        !sel.isCollapsed &&
        textareaRef.current.contains(sel.anchorNode)
      ) {
        // Try direct DOM manipulation
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const a = document.createElement("a");
        a.href = safeUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.textDecoration = "underline";
        a.textContent = text;
        range.insertNode(a);

        // Remove any duplicate text node after the link (browser quirk workaround)
        if (
          a.parentNode &&
          a.nextSibling &&
          a.nextSibling.nodeType === Node.TEXT_NODE &&
          a.nextSibling.textContent === text
        ) {
          a.parentNode.removeChild(a.nextSibling);
        }

        // Move caret after the link
        range.setStartAfter(a);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        // Check if the link is clickable, otherwise fallback
        if (!a.href || a.href === window.location.href) {
          // Fallback: use execCommand
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("createLink", false, safeUrl);
          // Style the link
          const links = textareaRef.current.querySelectorAll(
            'a[href="' + safeUrl + '"]'
          );
          links.forEach((link) => {
            const a = link as HTMLAnchorElement;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.style.textDecoration = "underline";
          });
        }
      } else {
        // No selection, just insert the link at the caret
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">${text}</a>`
        );
      }
    }
    setShowLinkModal(false);
    setLinkUrl("");
    setLinkError("");
    setLinkText("");
  };

  const isValidEmail = (email: string) =>
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const addEmail = (
    input: string,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    const trimmed = input.trim();
    if (trimmed && isValidEmail(trimmed) && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
  };

  const handleInputChange =
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setter(e.target.value);
  const handleInputKeyDown =
    (
      input: string,
      list: string[],
      setList: (l: string[]) => void,
      setInput: (v: string) => void
    ) =>
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
          e.preventDefault();
          addEmail(input, list, setList);
          setInput("");
        }
      };
  const handleInputBlur =
    (
      input: string,
      list: string[],
      setList: (l: string[]) => void,
      setInput: (v: string) => void
    ) =>
      () => {
        addEmail(input, list, setList);
        setInput("");
      };
  const removeEmail = (
    email: string,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    setList(list.filter((e) => e !== email));
  };

  // Add a handleClose function to reset all fields and draftMessageId
  function handleClose() {
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setAttachments([]);
    setSelectedLabels([]);
    setIsConfidential(false);
    setShowCcBcc(false);
    setDraftMessageId(null);
    setAutoSaveToastShown(false);
    onClose();
  }

  // Helper function to extract only the email address
  function extractEmail(address: string): string {
    const match = address.match(/<([^>]+)>/);
    return match ? match[1] : address;
  }

  // Move this helper function to the top-level scope (outside handleFontChange)
  function cleanFontNodes(node: Node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // Remove <font> tags or <span style="font-family: ...">
      if (
        el.tagName === "FONT" ||
        (el.tagName === "SPAN" && el.style.fontFamily)
      ) {
        // Recursively clean children and flatten
        const fragment = document.createDocumentFragment();
        Array.from(el.childNodes).forEach((child) => {
          const cleaned = cleanFontNodes(child as Node);
          if (cleaned) fragment.appendChild(cleaned);
        });
        return fragment;
      } else {
        // Clean children in place
        Array.from(el.childNodes).forEach((child) => {
          const cleaned = cleanFontNodes(child as Node);
          if (cleaned && cleaned !== child) {
            el.replaceChild(cleaned, child);
          }
        });
        return el;
      }
    }
    // For text nodes or others, return as is
    return node;
  }

  // Add this handler inside ComposeModal
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    // Try to use execCommand for insertText (widely supported)
    if (
      document.queryCommandSupported &&
      document.queryCommandSupported("insertText")
    ) {
      document.execCommand("insertText", false, text);
    } else {
      // Fallback: insert at caret using Range API
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.deleteFromDocument();
        sel.getRangeAt(0).insertNode(document.createTextNode(text));
      }
    }
  }

  return (
    <div
      className={`
    fixed z-50 transition-all duration-200 overflow-visible
    ${modalSize === "maximized"
          ? "inset-4 max-md:inset-0"
          : "bottom-0 right-6 max-md:inset-0"
        }
  `}
    >
      <div
        className={`
      bg-card shadow-lg border transition-all duration-200 overflow-visible
      ${modalSize === "maximized"
            ? "h-[40rem] md:h-[38rem] lg:h-[44rem] w-full rounded-lg max-md:rounded-none [@media(min-width:2560px)]:h-[90rem]"
            : modalSize === "minimized"
              ? "h-12 w-80 rounded-t-lg max-md:hidden"
              : "h-[550px] w-[480px] rounded-t-lg max-md:w-full max-md:h-full max-md:rounded-none"
          }
    `}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-muted px-4 py-2 rounded-t-lg border-b">
          <span className="text-sm font-medium text-foreground">
            {t.newMessage}
          </span>
          <div className="flex items-center space-x-1">
            {/* Minimize Button */}
            <button
              onClick={() => setModalSize("minimized")}
              className="p-1.5 hover:bg-accent rounded-lg max-md:hidden"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Toggle Maximize / Restore */}
            <button
              onClick={() =>
                setModalSize(modalSize === "maximized" ? "normal" : "maximized")
              }
              className="p-1.5 hover:bg-accent rounded-lg max-md:hidden"
            >
              <Square className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-accent rounded-lg"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {(modalSize !== "minimized" || isMobile) && (
          <div
            className={`flex flex-col ${modalSize === "maximized" || isMobile
                ? "h-full" // use full height when maximized
                : "h-[calc(550px-3rem)]" // same as before for normal size
              }`}
          >
            {/* Email Fields */}
            <div className="px-4 pt-2 flex-shrink-0">
              {/* To Field */}
              <div className="flex items-center py-[3px] border-b border-border">
                <span className="text-sm text-muted-foreground w-6">To</span>
                <div className="flex-1 flex flex-wrap items-center gap-1 rounded py-1 border-0">
                  {toList.map((email) => (
                    <span
                      key={email}
                      className="flex items-center bg-gray-100 rounded-full px-2 py-1 mr-1 mb-1"
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-700 text-white text-xs font-bold mr-1">
                        {email[0].toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-800">{email}</span>
                      <button
                        onClick={() => removeEmail(email, toList, setToList)}
                        className="ml-1 text-gray-400 hover:text-gray-700 focus:outline-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={toInput}
                    onChange={handleInputChange(setToInput)}
                    onKeyDown={handleInputKeyDown(
                      toInput,
                      toList,
                      setToList,
                      setToInput
                    )}
                    onBlur={handleInputBlur(
                      toInput,
                      toList,
                      setToList,
                      setToInput
                    )}
                    className="flex-1 min-w-0 w-auto py-1 text-sm border-0 dark:bg-[#000] dark:text-white focus:outline-none"
                    placeholder="Recipients"
                  />
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  {/* <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="dark:text-white transition-colors"
                  >
                    Cc/Bcc
                  </button> */}
                  <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="dark:text-white transition-colors"
                  >
                    Cc/Bcc
                  </button>
                </div>
              </div>

              {/* Cc/Bcc Fields */}
              {showCcBcc && (
                <>
                  <div className="flex items-center py-[3px] border-b border-border">
                    <span className="text-sm text-muted-foreground w-5">Cc</span>
                    <div className="flex-1 flex flex-wrap items-center gap-1 rounded px-2 py-1 border-0">
                      {ccList.map((email) => (
                        <span
                          key={email}
                          className="flex items-center bg-gray-100 rounded-full mr-1 mb-1"
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold mr-1">
                            {email[0].toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-800">{email}</span>
                          <button
                            onClick={() =>
                              removeEmail(email, ccList, setCcList)
                            }
                            className="ml-1 text-gray-400 hover:text-gray-700 focus:outline-none"
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={ccInput}
                        onChange={handleInputChange(setCcInput)}
                        onKeyDown={handleInputKeyDown(
                          ccInput,
                          ccList,
                          setCcList,
                          setCcInput
                        )}
                        onBlur={handleInputBlur(
                          ccInput,
                          ccList,
                          setCcList,
                          setCcInput
                        )}
                        className="flex-1 min-w-0 w-auto py-1 text-sm border-0 dark:bg-[#000] dark:text-white focus:outline-none"
                        placeholder="Cc"
                      />
                    </div>
                  </div>
                  <div className="flex items-center py-[3px] border-b border-border">
                    <span className="text-sm text-muted-foreground w-7">
                      Bcc
                    </span>
                    <div className="flex-1 flex flex-wrap items-center gap-1 rounded px-2 py-1 border-0">
                      {bccList.map((email) => (
                        <span
                          key={email}
                          className="flex items-center bg-gray-100 rounded-full px-2 py-1 mr-1 mb-1"
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-700 text-white text-xs font-bold mr-1">
                            {email[0].toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-800">{email}</span>
                          <button
                            onClick={() =>
                              removeEmail(email, bccList, setBccList)
                            }
                            className="ml-1 text-gray-400 hover:text-gray-700 focus:outline-none"
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={bccInput}
                        onChange={handleInputChange(setBccInput)}
                        onKeyDown={handleInputKeyDown(
                          bccInput,
                          bccList,
                          setBccList,
                          setBccInput
                        )}
                        onBlur={handleInputBlur(
                          bccInput,
                          bccList,
                          setBccList,
                          setBccInput
                        )}
                        className="flex-1 min-w-0 w-auto py-1 text-sm dark:bg-[#000] dark:text-white border-0 focus:outline-none"
                        placeholder="Bcc"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Subject Field */}
              <div className="flex items-center py-3">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    const newSubject = e.target.value;
                    setSubject(newSubject);

                    // Reset accepted suggestions when subject changes
                    if (newSubject.toLowerCase() !== subject.toLowerCase()) {
                      setAcceptedSuggestions([]);
                      setEmailContext(newSubject.toLowerCase());
                    }
                  }}
                  className="w-full py-1 text-sm dark:text-white bg-transparent border-b focus:outline-none focus:ring-0"
                  placeholder={t.subject}
                />
              </div>

              {/* Confidential Mode Indicator */}
              {isConfidential && (
                <div className="flex items-center py-1 text-xs text-primary">
                  <span>🔒 {t.confidentialModeIsOn}</span>
                </div>
              )}
            </div>

            {/* Email Body */}
            <div className="flex-1 px-4 pb-2 min-h-0 flex flex-col overflow-hidden">
              <div className="relative w-full flex-1 min-h-[120px]">
                {isBodyEmpty && (!body || !body.trim()) && (
                  <span className="absolute text-muted-foreground pointer-events-none select-none opacity-60">
                    {t.compose}
                  </span>
                )}
                <div className="relative w-full">
                  <div
                    ref={textareaRef}
                    contentEditable={!isPlainTextMode}
                    className="w-full min-h-[120px] bg-white dark:bg-black rounded resize-none focus:outline-none"
                    style={{
                      fontFamily: "inherit",
                      outline: "none",
                      minHeight: 120,
                      maxHeight: 300,
                      overflowY: "auto",
                    }}
                    onInput={(e) => {
                      // Preserve any existing inline suggestions when typing
                      const existingSuggestions = textareaRef.current?.querySelectorAll('.inline-suggestion');
                      const hasSuggestion = existingSuggestions && existingSuggestions.length > 0;

                      // Only call handleBodyInput if there's no suggestion yet
                      if (!hasSuggestion) {
                        handleBodyInput();
                      }
                    }}
                    onKeyUp={(e) => {
                      // Only call handleBodyInput on keyUp if there's no suggestion yet
                      const existingSuggestions = textareaRef.current?.querySelectorAll('.inline-suggestion');
                      const hasSuggestion = existingSuggestions && existingSuggestions.length > 0;

                      if (!hasSuggestion) {
                        handleBodyInput();
                      }
                    }}
                    onKeyDown={(e) => {
                      // Handle Tab key to accept suggestion
                      if (e.key === 'Tab' && showSuggestion) {
                        e.preventDefault();
                        if (textareaRef.current) {
                          try {
                            // First, remove any inline suggestion spans
                            const suggestionSpans = textareaRef.current.querySelectorAll('.inline-suggestion');
                            suggestionSpans.forEach(span => span.remove());

                            // Get current content and determine if we need to remove any starting text
                            const content = textareaRef.current.innerText;

                            // Check for common starting text patterns that might be redundant with the suggestion
                            let textToInsert = suggestion;

                            // Handle cases where we need to remove redundant text
                            // First, try to match specific known patterns
                            const redundantPairs = [
                              { end: "Thank", start: " you", length: 5 },
                              { end: "Best", start: " regards", length: 4 },
                              { end: "I", start: " hope", length: 1 },
                              { end: "I", start: " am", length: 1 },
                              { end: "I", start: " have", length: 1 },
                              { end: "I", start: " will", length: 1 },
                              { end: "I", start: " would", length: 1 },
                              { end: "I", start: "'m", length: 1 },
                              { end: "I", start: "'ve", length: 1 },
                              { end: "I", start: "'ll", length: 1 },
                              { end: "Here", start: "'s", length: 4 },
                              { end: "Here", start: " is", length: 4 },
                              { end: "dsc", start: " I'm", length: 3 },
                              { end: "br", start: " ", length: 2 },
                            ];

                            let handled = false;

                            // Check if we need to remove redundant text based on known patterns
                            for (const pair of redundantPairs) {
                              if (content.trim().endsWith(pair.end) && suggestion.startsWith(pair.start)) {
                                console.log(`Matched pattern: ${pair.end} + ${pair.start}`);
                                // Remove the redundant text from the end of the content
                                const selection = window.getSelection();
                                if (selection && selection.rangeCount > 0) {
                                  const range = selection.getRangeAt(0);

                                  // Get the text node and its content
                                  const textNode = range.startContainer;
                                  const nodeText = textNode.textContent || '';

                                  // Find the position of the last occurrence of pair.end
                                  const lastIndex = nodeText.lastIndexOf(pair.end);
                                  if (lastIndex >= 0) {
                                    // Set range to delete from the start of the pattern to the current position
                                    range.setStart(textNode, lastIndex);
                                    range.deleteContents();
                                  }
                                }
                                handled = true;
                                break; // Only handle one redundancy at a time
                              }
                            }

                            // If no specific pattern was matched, try a more general approach
                            // This will handle cases where the user types any text that appears at the beginning of a suggestion
                            if (!handled) {
                              // Get the user's last input (could be a word or phrase)
                              const userText = content.trim();

                              if (userText) {
                                // Check if the suggestion starts with the user's text (ignoring case)
                                // First, normalize the suggestion by removing leading space if present
                                const normalizedSuggestion = suggestion.startsWith(" ") ? suggestion.substring(1) : suggestion;

                                // Check if the suggestion starts with what the user typed (case insensitive)
                                if (normalizedSuggestion.toLowerCase().startsWith(userText.toLowerCase())) {
                                  console.log(`Matched user text: "${userText}" at start of suggestion: "${normalizedSuggestion}"`);
                                  // Remove the user's text since it's redundant with the suggestion
                                  const selection = window.getSelection();
                                  if (selection && selection.rangeCount > 0) {
                                    const range = selection.getRangeAt(0);

                                    // Get the text node and its content
                                    const textNode = range.startContainer;
                                    const nodeText = textNode.textContent || '';

                                    // Find the position of the last occurrence of userText
                                    const lastIndex = nodeText.lastIndexOf(userText);
                                    if (lastIndex >= 0) {
                                      // Set range to delete from the start of the user text to the current position
                                      range.setStart(textNode, lastIndex);
                                      range.deleteContents();
                                    } else {
                                      // If we can't find the exact text, try to delete the current selection
                                      // This handles cases where the text might have slight differences
                                      try {
                                        document.execCommand('delete');
                                      } catch (e) {
                                        console.error('Failed to delete current selection:', e);
                                      }
                                    }
                                  }

                                  // Adjust the suggestion to include the leading space if it was there
                                  textToInsert = suggestion.startsWith(" ") ? " " + normalizedSuggestion : normalizedSuggestion;
                                  handled = true; // Mark as handled so we don't process it further
                                } else if (suggestion.startsWith(" ")) {
                                  // Fall back to just removing the last word if the suggestion starts with a space
                                  // This handles cases where the suggestion doesn't start with user text
                                  const words = content.trim().split(/\s+/);
                                  const lastWord = words[words.length - 1];

                                  if (lastWord && lastWord.length > 0) {
                                    console.log(`Removing last word: "${lastWord}" before adding suggestion`);
                                    // Check if this word should be removed before adding the suggestion
                                    const selection = window.getSelection();
                                    if (selection && selection.rangeCount > 0) {
                                      const range = selection.getRangeAt(0);

                                      // Get the text node and its content
                                      const textNode = range.startContainer;
                                      const nodeText = textNode.textContent || '';

                                      // Find the position of the last occurrence of lastWord
                                      const lastIndex = nodeText.lastIndexOf(lastWord);
                                      if (lastIndex >= 0) {
                                        // Set range to delete from the start of the last word to the current position
                                        range.setStart(textNode, lastIndex);
                                        range.deleteContents();
                                      } else {
                                        // If we can't find the exact word, try to delete the current selection
                                        // or the last character if there's no selection
                                        try {
                                          if (range.collapsed) {
                                            // If cursor is just a point (no selection), delete the last character
                                            document.execCommand('delete');
                                          } else {
                                            // Delete the current selection
                                            document.execCommand('delete');
                                          }
                                        } catch (e) {
                                          console.error('Failed to delete before suggestion:', e);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }

                            // If we still have content and it's just a single character, try to remove it
                            // This handles cases where a single character wasn't caught by other conditions
                            if (!handled && content.trim().length === 1) {
                              try {
                                const selection = window.getSelection();
                                if (selection && selection.rangeCount > 0) {
                                  const range = selection.getRangeAt(0);
                                  if (range.collapsed) {
                                    // Move one character back and delete it
                                    range.setStart(range.startContainer, range.startOffset - 1);
                                    range.deleteContents();
                                  }
                                }
                              } catch (e) {
                                console.error('Failed to remove single character:', e);
                              }
                            }

                            // Insert the suggestion at the current cursor position
                            document.execCommand('insertText', false, textToInsert);

                            // Add to accepted suggestions to prevent duplicates
                            setAcceptedSuggestions(prev => [...prev, suggestion]);

                            // Clear the suggestion
                            setSuggestion("");
                            setShowSuggestion(false);
                          } catch (error) {
                            console.error('Error handling Tab key suggestion:', error);
                            // Ensure we still clear the suggestion state even if there's an error
                            setSuggestion("");
                            setShowSuggestion(false);
                          }
                        }
                      }
                    }}
                    onPaste={handlePaste}
                  />
                  {/* We no longer need a separate suggestion display since we're showing it inline */}
                </div>
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    Attachments:
                  </div>
                  <div className="space-y-1">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-muted rounded px-2 py-1"
                      >
                        <span className="text-xs text-foreground truncate">
                          {file.name} ({formatFileSize(file.size)})
                        </span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-destructive hover:text-destructive/80 text-xs ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Footer Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted">
              <div className="flex items-center space-x-1 relative">
                <div
                  className="flex items-center relative"
                  ref={sendOptionsRef}
                >
                  <button
                    onClick={() => handleSend()}
                    className="text-white rounded-md bg-[#ffa184] hover:bg-[#fd9474] px-4 py-1.5 text-sm"
                  >
                    {t.send}
                  </button>
                  <button
                    onClick={() => setShowSendOptions(!showSendOptions)}
                    className="p-1.5 hover:bg-[#ffa184]/10 rounded-lg transition-colors"
                  >
                    <ChevronDown className="w-3 h-3 text-[#ffa184]" />
                  </button>

                  {/* Schedule Send Dropdown */}
                  {showSendOptions && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-black border rounded-lg shadow-lg z-50 w-56">
                      <div className="py-2">
                        <div className="px-4 py-2 text-xs dark:text-white font-medium border-b">
                          {t.scheduleSend}
                        </div>
                        {getScheduleOptions().map((option, index) => (
                          <button
                            key={index}
                            onClick={() => handleScheduleSend(option.time)}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                        <button
                          onClick={showCustomDateTimePicker}
                          className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors border-t"
                        >
                          Pick date & time
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Date/Time Picker */}
                  {showDateTimePicker && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-black border rounded-lg shadow-lg z-50 w-80">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium dark:text-white">
                            {t.scheduleSend}
                          </h3>
                          <button
                            onClick={() => setShowDateTimePicker(false)}
                            className="hover:text-gray-100 dark:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium dark:text-white mb-2">
                              Date
                            </label>
                            <input
                              type="date"
                              value={customScheduleDate}
                              onChange={(e) =>
                                setCustomScheduleDate(e.target.value)
                              }
                              min={new Date().toISOString().split("T")[0]}
                              className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ffa184]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium dark:text-white mb-2">
                              Time
                            </label>
                            <input
                              type="time"
                              value={customScheduleTime}
                              onChange={(e) =>
                                setCustomScheduleTime(e.target.value)
                              }
                              className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ffa184]"
                            />
                          </div>

                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              onClick={() => setShowDateTimePicker(false)}
                              className="px-3 py-1.5 text-xs rounded-md dark:text-white dark:hover:text-slate-600 hover:bg-gray-100 dark:hover:bg-slate-300 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCustomSchedule}
                              className="px-3 py-1.5 text-xs text-white rounded-md bg-[#ffa184] hover:bg-[#fd9474] transition-colors"
                            >
                              {t.scheduleSend}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-0.5 ml-2 relative">
                  {/* Text formatting (A with underline) */}
                  <button
                    ref={formattingButtonRef}
                    onClick={() => {
                      console.log("Formatting button clicked");
                      setShowFormattingDropdown((v) => {
                        console.log(
                          "Toggling showFormattingDropdown from",
                          v,
                          "to",
                          !v
                        );
                        return !v;
                      });
                      setShowSendOptions(false);
                      setShowMoreOptions(false);
                      setShowInputTools(false);
                      setShowEmojiPicker(false);
                      setShowDateTimePicker(false);
                    }}
                    className={`p-1.5 rounded-lg ${isFormatting
                      ? "bg-accent text-primary"
                      : "hover:bg-accent text-muted-foreground"
                      }`}
                    title="Text formatting"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 4v3h5.5v12h3V7H19V4z" />
                      <path d="M3 20h18v2H3z" />
                    </svg>
                  </button>
                  {showFormattingDropdown && (
                    <div
                      ref={formattingDropdownRef}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[99999] bg-white dark:bg-black border rounded-lg shadow-lg w-[90vw] max-w-[580px] min-h-[45px] flex items-center space-x-2 px-2 overflow-visible"
                    >
                      {/* Undo */}
                      <span
                        style={{
                          opacity: 0.7,
                          margin: "0 6px",
                          cursor: "pointer",
                        }}
                        onClick={handleUndo}
                        title="Undo"
                      >
                        ↶
                      </span>
                      {/* Redo */}
                      <span
                        style={{
                          opacity: 0.7,
                          margin: "0 6px",
                          cursor: "pointer",
                        }}
                        onClick={handleRedo}
                        title="Redo"
                      >
                        ↷
                      </span>
                      <span
                        style={{
                          borderLeft: "1px solid #ddd",
                          height: 24,
                          margin: "0 8px",
                        }}
                      />
                      <FontDropdown
                        fontList={fontList}
                        selectedFont={selectedFont}
                        setSelectedFont={setSelectedFont}
                        handleFontChange={handleFontChange}
                      />
                      <span
                        style={{
                          borderLeft: "1px solid #ddd",
                          height: 24,
                          margin: "0 8px",
                        }}
                      />
                      {/* Bold */}
                      <button
                        type="button"
                        onClick={() => format("bold")}
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          margin: "0 6px",
                          border: "none",
                          cursor: "pointer",
                          color: isBold ? "#ffa184" : undefined,
                        }}
                        title="Bold"
                        aria-pressed={isBold}
                      >
                        B
                      </button>
                      {/* Italic */}
                      <button
                        type="button"
                        onClick={() => format("italic")}
                        style={{
                          fontStyle: "italic",
                          fontSize: 16,
                          margin: "0 6px",
                          border: "none",
                          cursor: "pointer",
                          color: isItalic ? "#ffa184" : undefined,
                        }}
                        title="Italic"
                        aria-pressed={isItalic}
                      >
                        I
                      </button>
                      {/* Underline */}
                      <button
                        type="button"
                        onClick={() => format("underline")}
                        style={{
                          textDecoration: "underline",
                          fontSize: 16,
                          margin: "0 6px",
                          border: "none",
                          cursor: "pointer",
                          color: isUnderline ? "#ffa184" : undefined,
                        }}
                        title="Underline"
                        aria-pressed={isUnderline}
                      >
                        U
                      </button>
                      <span
                        style={{
                          borderLeft: "1px solid #ddd",
                          height: 24,
                          margin: "0 8px",
                        }}
                      />
                      {/* Color Picker (A icon) */}
                      <button
                        type="button"
                        ref={colorButtonRef}
                        onClick={handleShowColorPicker}
                        style={{
                          fontSize: 16,
                          margin: "0 6px",
                          border: "none",
                          cursor: "pointer",
                          color: "#222",
                          background: "none",
                        }}
                        title="Text and background color"
                        aria-haspopup="true"
                        aria-expanded={showColorPicker}
                      >
                        A
                      </button>
                      <span
                        style={{
                          borderLeft: "1px solid #ddd",
                          height: 24,
                          margin: "0 8px",
                        }}
                      />
                      {/* <span style={{ fontSize: 16, margin: "0 6px" }}>▼</span> */}
                      {/* Alignment button and dropdown */}
                      <div className="relative">
                        <button
                          ref={alignmentButtonRef}
                          onClick={() => setShowAlignmentDropdown((v) => !v)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground flex items-center"
                          title="Text alignment"
                          aria-haspopup="true"
                          aria-expanded={showAlignmentDropdown}
                        >
                          {alignmentIcons[currentAlignment]}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 20 20"
                            className="ml-1"
                          >
                            <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.293l3.71-3.06a.75.75 0 1 1 .98 1.14l-4.25 3.5a.75.75 0 0 1-.98 0l-4.25-3.5a.75.75 0 0 1 .02-1.06z" />
                          </svg>
                        </button>
                      </div>
                      {/* Numbered list button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            setTimeout(() => {
                              if (textareaRef.current) {
                                try {
                                  document.execCommand("insertOrderedList");
                                } catch (e) {
                                  console.error("execCommand error:", e);
                                }
                              }
                            }, 0);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground flex items-center"
                        title="Numbered list"
                      >
                        {/* Numbered list SVG: 3 lines with numbers */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <text x="2" y="8" fontSize="6" fill="currentColor">
                            1.
                          </text>
                          <rect
                            x="8"
                            y="5"
                            width="12"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <text x="2" y="14" fontSize="6" fill="currentColor">
                            2.
                          </text>
                          <rect
                            x="8"
                            y="11"
                            width="12"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <text x="2" y="20" fontSize="6" fill="currentColor">
                            3.
                          </text>
                          <rect
                            x="8"
                            y="17"
                            width="12"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      {/* Decorative bullet (unordered list) button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            setTimeout(() => {
                              if (textareaRef.current) {
                                try {
                                  document.execCommand("insertUnorderedList");
                                } catch (e) {
                                  console.error("execCommand error:", e);
                                }
                              }
                            }, 0);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground flex items-center"
                        title="Bullet list"
                      >
                        {/* Bullet list SVG: 3 lines with dots */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle cx="4" cy="6" r="1.5" fill="currentColor" />
                          <rect
                            x="8"
                            y="5"
                            width="12"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                          <rect
                            x="8"
                            y="11"
                            width="12"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <circle cx="4" cy="18" r="1.5" fill="currentColor" />
                          <rect
                            x="8"
                            y="17"
                            width="12"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      {/* Left indent (increase indent) button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            setTimeout(() => {
                              if (textareaRef.current) {
                                try {
                                  document.execCommand("indent");
                                } catch (e) {
                                  console.error("execCommand error:", e);
                                }
                              }
                            }, 0);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground flex items-center"
                        title="Increase indent"
                      >
                        {/* Indent SVG: right arrow with lines */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <rect
                            x="4"
                            y="6"
                            width="10"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <rect
                            x="4"
                            y="11"
                            width="6"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <rect
                            x="4"
                            y="16"
                            width="10"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <polygon
                            points="18,12 14,9 14,15"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      {/* Right indent (decrease indent) button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            setTimeout(() => {
                              if (textareaRef.current) {
                                try {
                                  document.execCommand("outdent");
                                } catch (e) {
                                  console.error("execCommand error:", e);
                                }
                              }
                            }, 0);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground flex items-center"
                        title="Decrease indent"
                      >
                        {/* Outdent SVG: left arrow with lines */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <rect
                            x="6"
                            y="6"
                            width="10"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <rect
                            x="10"
                            y="11"
                            width="6"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <rect
                            x="6"
                            y="16"
                            width="10"
                            height="2"
                            rx="1"
                            fill="currentColor"
                          />
                          <polygon
                            points="6,12 10,9 10,15"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      {/* Quote button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            setTimeout(() => {
                              if (textareaRef.current) {
                                // Try execCommand first
                                let success = false;
                                try {
                                  success =
                                    document.execCommand &&
                                    document.execCommand(
                                      "formatBlock",
                                      false,
                                      "blockquote"
                                    );
                                } catch (e) {
                                  success = false;
                                }
                                // Fallback: manually insert blockquote if execCommand fails
                                if (!success) {
                                  const sel = window.getSelection();
                                  if (sel && sel.rangeCount > 0) {
                                    const range = sel.getRangeAt(0);
                                    const blockquote =
                                      document.createElement("blockquote");
                                    blockquote.innerHTML = "&nbsp;";
                                    range.deleteContents();
                                    range.insertNode(blockquote);
                                    // Move caret inside the blockquote
                                    range.setStart(blockquote, 0);
                                    range.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(range);
                                  }
                                }
                              }
                            }, 0);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground flex items-center"
                        title="Quote"
                      >
                        {/* Quote SVG: double quotation marks */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M7 9h4v6H7zM13 9h4v6h-4z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                  )}

                  {showColorPicker && (
                    <div
                      ref={colorPickerRef}
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-1/4 mb-2 z-[99999] bg-white dark:bg-black border rounded-lg shadow-lg p-4 flex gap-8"
                      style={{ minWidth: 320 }}
                    >
                      {/* Background color grid */}
                      <div>
                        <div className="text-xs font-medium mb-2">
                          Background color
                        </div>
                        <div className="grid grid-cols-8 gap-0.5">
                          {colorPalette.flat().map((color, idx) => (
                            <button
                              key={"bg-" + color + idx}
                              type="button"
                              title={color}
                              style={{
                                background: color,
                                width: 20,
                                height: 20,
                                border: "1px solid #ccc",
                                margin: 1,
                                borderRadius: 2,
                              }}
                              onClick={() =>
                                handleColorPick("hiliteColor", color)
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {/* Text color grid */}
                      <div>
                        <div className="text-xs font-medium mb-2">
                          Text color
                        </div>
                        <div className="grid grid-cols-8 gap-0.5">
                          {colorPalette.flat().map((color, idx) => (
                            <button
                              key={"fg-" + color + idx}
                              type="button"
                              title={color}
                              style={{
                                background: color,
                                width: 20,
                                height: 20,
                                border: "1px solid #ccc",
                                margin: 1,
                                borderRadius: 2,
                              }}
                              onClick={() =>
                                handleColorPick("foreColor", color)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {showAlignmentDropdown && (
                    <div
                      ref={alignmentDropdownRef}
                      className="absolute bottom-full -right-1/2 -translate-x-1/2 -translate-y-1/4 mb-2 z-[99999] bg-white dark:bg-black border rounded-lg shadow-lg p-2 flex flex-col min-w-[120px]"
                    >
                      {(["left", "center", "right", "justify"] as const).map(
                        (align) => (
                          <button
                            key={align}
                            onClick={() => handleAlignmentChange(align)}
                            className={`flex items-center px-3 py-2 text-sm hover:bg-accent rounded transition-colors ${currentAlignment === align ? "bg-accent" : ""
                              }`}
                          >
                            {alignmentIcons[align]}
                            <span className="ml-2 capitalize">{align}</span>
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {/* Attach file (paperclip) */}
                  <button
                    onClick={handleAttachment}
                    className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground"
                    title={t.attachFiles}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49" />
                    </svg>
                  </button>

                  {/* Link */}
                  <button
                    onClick={handleInsertLinkClick}
                    className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground"
                    title={t.insertLink}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </button>

                  {/* Emoji */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground"
                      title={t.insertEmoji}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="m9 9 1.5 1.5L9 12" />
                        <path d="m15 9-1.5 1.5L15 12" />
                        <path d="M8 15s1.5 2 4 2 4-2 4-2" />
                      </svg>
                    </button>

                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-card border rounded-lg shadow-lg z-10 w-[380px] max-h-[350px] overflow-hidden">
                        {emojiLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <span className="ml-2 text-sm text-muted-foreground">
                              Loading emojis...
                            </span>
                          </div>
                        ) : Object.keys(emojiCategories).length > 0 ? (
                          <div className="flex flex-col">
                            {/* Header */}
                            <div className="px-4 py-2 border-b bg-muted/50">
                              <h3 className="text-sm font-medium text-foreground">
                                Emojis
                              </h3>
                            </div>

                            {/* Emoji Content */}
                            <div className="overflow-y-auto max-h-[280px] p-3">
                              <div className="space-y-4">
                                {Object.entries(emojiCategories).map(
                                  ([category, emojis]) => (
                                    <div key={category}>
                                      {/* Category Header */}
                                      <div className="sticky top-0 bg-card py-1 mb-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                          {category}
                                        </h4>
                                      </div>

                                      {/* Emoji Grid */}
                                      <div className="grid grid-cols-9 gap-1">
                                        {emojis.map((emoji, index) => (
                                          <button
                                            key={index}
                                            onClick={() => addEmoji(emoji)}
                                            className="w-9 h-9 flex items-center justify-center hover:bg-accent rounded-md text-xl transition-all duration-150 hover:scale-110"
                                            style={{
                                              fontFamily:
                                                "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
                                            }}
                                            title={emoji}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4">
                            <div className="grid grid-cols-8 gap-2">
                              {commonEmojis.map((emoji, index) => (
                                <button
                                  key={index}
                                  onClick={() => addEmoji(emoji)}
                                  className="w-9 h-9 flex items-center justify-center hover:bg-accent rounded-md text-xl transition-all duration-150 hover:scale-110"
                                  style={{
                                    fontFamily:
                                      "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
                                  }}
                                  title={emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Virtual Keyboard and Input Tools */}
                  <div className="relative" ref={inputToolsRef}>
                    <div className="flex items-center bg-background hover:bg-accent rounded-lg transition-colors duration-200">
                      {/* <button
                        className="p-1.5 rounded-l-lg text-muted-foreground hover:text-foreground"
                        title={t.virtualKeyboard}
                        onClick={() => setShowVirtualKeyboard(true)}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                          />
                        </svg>
                      </button> */}
                      {/* <div className="w-px h-4 bg-border"></div> */}
                      {/* <button
                        className="p-1.5 rounded-r-lg text-muted-foreground hover:text-foreground"
                        title={t.inputToolsOptions}
                        onClick={() => setShowInputTools(!showInputTools)}
                      >
                        <svg
                          className="w-2.5 h-2.5"
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
                      </button> */}
                    </div>

                    {/* Input Tools Dropdown */}
                    {showInputTools && (
                      <div className="absolute bottom-full right-0 mb-2 bg-card border rounded-lg shadow-lg py-2 w-48 z-20">
                        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border mb-2">
                          INPUT LANGUAGES
                        </div>

                        <button
                          onClick={() => {
                            setSelectedInputLanguage("English");
                            setShowInputTools(false);
                          }}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${selectedInputLanguage === "English"
                            ? "bg-accent"
                            : ""
                            }`}
                        >
                          <div className="w-6 h-4 bg-blue-500 text-white text-xs flex items-center justify-center rounded">
                            EN
                          </div>
                          <span>English</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedInputLanguage("Spanish");
                            setShowInputTools(false);
                          }}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${selectedInputLanguage === "Spanish"
                            ? "bg-accent"
                            : ""
                            }`}
                        >
                          <div className="w-6 h-4 bg-red-500 text-white text-xs flex items-center justify-center rounded">
                            ES
                          </div>
                          <span>Spanish</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedInputLanguage("French");
                            setShowInputTools(false);
                          }}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${selectedInputLanguage === "French"
                            ? "bg-accent"
                            : ""
                            }`}
                        >
                          <div className="w-6 h-4 bg-blue-600 text-white text-xs flex items-center justify-center rounded">
                            FR
                          </div>
                          <span>French</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedInputLanguage("German");
                            setShowInputTools(false);
                          }}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${selectedInputLanguage === "German"
                            ? "bg-accent"
                            : ""
                            }`}
                        >
                          <div className="w-6 h-4 bg-gray-800 text-white text-xs flex items-center justify-center rounded">
                            DE
                          </div>
                          <span>German</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedInputLanguage("Portuguese");
                            setShowInputTools(false);
                          }}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${selectedInputLanguage === "Portuguese"
                            ? "bg-accent"
                            : ""
                            }`}
                        >
                          <div className="w-6 h-4 bg-green-500 text-white text-xs flex items-center justify-center rounded">
                            PT
                          </div>
                          <span>Portuguese</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedInputLanguage("Chinese");
                            setShowInputTools(false);
                          }}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${selectedInputLanguage === "Chinese"
                            ? "bg-accent"
                            : ""
                            }`}
                        >
                          <div className="w-6 h-4 bg-red-600 text-white text-xs flex items-center justify-center rounded">
                            中
                          </div>
                          <span>Chinese</span>
                        </button>

                        <div className="border-t border-border mt-2 pt-2">
                          <button className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors">
                            Input Tools Settings
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* More options (3 dots with blue indicator) */}
                  <div className="relative" ref={moreOptionsRef}>
                    <button
                      onClick={() => setShowMoreOptions(!showMoreOptions)}
                      className="relative p-1.5 hover:bg-accent rounded-lg text-muted-foreground"
                      title={t.moreOptions}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {/* More Options Dropdown */}
                    {showMoreOptions && (
                      <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-black border rounded-lg shadow-lg z-50 w-64">
                        <div className="py-2">
                          <button
                            onClick={() => {
                              insertText("⚠️ Important: ");
                              setShowMoreOptions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            Insert warning
                          </button>

                          <button
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*";
                              input.onchange = (e) =>
                                handleFileChange(e as any);
                              input.click();
                              setShowMoreOptions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            Insert image
                          </button>

                          <button
                            onClick={() => {
                              toggleConfidential();
                              setShowMoreOptions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            {t.confidentialMode}
                            {isConfidential && (
                              <svg
                                className="w-4 h-4 text-green-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              insertSignature();
                              setShowMoreOptions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            Insert signature
                          </button>

                          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                          <button
                            onClick={() => {
                              setIsDefaultFullScreen(!isDefaultFullScreen);
                              setIsMaximized(!isMaximized);
                              setShowMoreOptions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            Default to full screen
                            {isDefaultFullScreen && (
                              <svg
                                className="w-4 h-4 text-green-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>

                          {/* Label with submenu */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                setShowLabelSubmenu(!showLabelSubmenu);
                                setShowMeetingSubmenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors flex items-center justify-between"
                            >
                              Label
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>

                            {/* Label Submenu */}
                            {showLabelSubmenu && (
                              <div className="absolute right-full bottom-0 bg-white dark:bg-black border rounded-md shadow-xl w-72 mr-3 z-60">
                                <div className="py-1">
                                  <div className="px-3 py-2 text-xs dark:text-white font-medium">
                                    Label as:
                                  </div>
                                  <div className="px-3 pb-2">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="Search labels..."
                                        value={labelSearchQuery}
                                        onChange={(e) =>
                                          setLabelSearchQuery(e.target.value)
                                        }
                                        className="w-full pl-3 pr-8 py-1.5 text-sm border-b-2 border-[#ffa184] bg-transparent dark:text-white rounded-md focus:outline-none"
                                      />
                                      <svg
                                        className="absolute right-2 top-1.5 w-4 h-4 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                      </svg>
                                    </div>
                                  </div>

                                  {apiLabels
                                    .filter((label: any) =>
                                      label.name
                                        .toLowerCase()
                                        .includes(
                                          labelSearchQuery.toLowerCase()
                                        )
                                    )
                                    .map((label: any) => {
                                      const labelColor =
                                        label.color || "#9ca3af"; // Use hex color directly
                                      return (
                                        <label
                                          key={label.id}
                                          className="flex items-center px-3 py-1.5 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-accent cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            className="mr-3 w-4 h-4 rounded border"
                                            checked={selectedLabels.includes(
                                              label.labelUniqueId
                                            )}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedLabels([
                                                  ...selectedLabels,
                                                  label.labelUniqueId,
                                                ]);
                                              } else {
                                                setSelectedLabels(
                                                  selectedLabels.filter(
                                                    (l) =>
                                                      l !== label.labelUniqueId
                                                  )
                                                );
                                              }
                                            }}
                                          />
                                          <div
                                            className="w-3 h-3 rounded-full mr-2"
                                            style={{
                                              backgroundColor: labelColor,
                                            }}
                                          ></div>
                                          {label.name}
                                        </label>
                                      );
                                    })}

                                  <div className="border-t mt-1 pt-1">
                                    <button
                                      onClick={() => {
                                        if (
                                          !selectedLabels.includes("Starred")
                                        ) {
                                          setSelectedLabels([
                                            ...selectedLabels,
                                            "Starred",
                                          ]);
                                        }
                                      }}
                                      className="flex items-center w-full px-3 py-1.5 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-accent"
                                    >
                                      <svg
                                        className="w-4 h-4 mr-3 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-.181h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                        />
                                      </svg>
                                      Add star
                                    </button>
                                    {!showCreateLabelInput ? (
                                      <button
                                        onClick={() =>
                                          setShowCreateLabelInput(true)
                                        }
                                        className="w-full text-left px-3 py-1.5 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-accent"
                                      >
                                        Create new
                                      </button>
                                    ) : (
                                      <div className="px-3 py-2">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div
                                            className="w-4 h-4 rounded-full inline-block border"
                                            style={{
                                              backgroundColor: newLabelColor,
                                            }}
                                            title={newLabelColor}
                                          />
                                          <button
                                            type="button"
                                            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                            onClick={() =>
                                              setNewLabelColor(
                                                getRandomLabelColor()
                                              )
                                            }
                                          >
                                            Shuffle Color
                                          </button>
                                        </div>
                                        <input
                                          type="text"
                                          placeholder="Enter label name"
                                          value={newLabelName}
                                          onChange={(e) =>
                                            setNewLabelName(e.target.value)
                                          }
                                          className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-black dark:text-white focus:outline-none focus:border-[#ffa184]"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" &&
                                              newLabelName.trim()
                                            ) {
                                              createLabelMutation.mutate({
                                                name: newLabelName.trim(),
                                                color: newLabelColor,
                                              });
                                              // Do NOT add label name to selectedLabels here
                                              setNewLabelName("");
                                              setShowCreateLabelInput(false);
                                              setNewLabelColor(
                                                getRandomLabelColor()
                                              );
                                            } else if (e.key === "Escape") {
                                              setNewLabelName("");
                                              setShowCreateLabelInput(false);
                                              setNewLabelColor(
                                                getRandomLabelColor()
                                              );
                                            }
                                          }}
                                        />
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            onClick={() => {
                                              if (newLabelName.trim()) {
                                                createLabelMutation.mutate({
                                                  name: newLabelName.trim(),
                                                  color: newLabelColor,
                                                });
                                                // Do NOT add label name to selectedLabels here
                                                setNewLabelName("");
                                                setShowCreateLabelInput(false);
                                                setNewLabelColor(
                                                  getRandomLabelColor()
                                                );
                                              }
                                            }}
                                            className="px-3 py-1 text-xs text-white rounded bg-[#ffa184] hover:bg-[#fd9474] transition-colors"
                                          >
                                            Create
                                          </button>
                                          <button
                                            onClick={() => {
                                              setNewLabelName("");
                                              setShowCreateLabelInput(false);
                                              setNewLabelColor(
                                                getRandomLabelColor()
                                              );
                                            }}
                                            className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => {
                                        // Just close the submenu and show current labels
                                        setShowLabelSubmenu(false);
                                        setShowMoreOptions(false);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-accent"
                                    >
                                      Manage labels
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setShowMoreOptions(false);
                              setIsPlainTextMode(!isPlainTextMode);
                              setIsFormatting(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors flex items-center"
                          >
                            {/* <span className="mr-2 text-red-500">📝</span> */}
                            {isPlainTextMode
                              ? t.richFormatting
                              : t.plainTextMode}
                          </button>

                          <button
                            onClick={() => {
                              setShowMoreOptions(false);
                              const printContent = `
                                To: ${to}
                                ${cc ? `CC: ${cc}` : ""}
                                ${bcc ? `BCC: ${bcc}` : ""}
                                Subject: ${subject}

                                ${bodyHtml}
                                ${enableSignature && signature
                                  ? `\n\n${signature}`
                                  : ""
                                }
                              `;
                              const printWindow = window.open("", "_blank");
                              if (printWindow) {
                                printWindow.document.write(`
                                  <html>
                                    <head><title>Print Email</title></head>
                                    <body style="font-family: Arial, sans-serif; padding: 20px;">
                                      <pre style="white-space: pre-wrap;">${printContent}</pre>
                                    </body>
                                  </html>
                                `);
                                printWindow.document.close();
                                printWindow.print();
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-sm  dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            Print
                          </button>

                          <button
                            onClick={() => {
                              setShowMoreOptions(false);
                              const textToCheck = `${subject} ${bodyHtml}`;
                              if (textToCheck.trim()) {
                                // Simple spell check simulation - in real app would use a spell check API
                                const commonMisspellings = {
                                  teh: "the",
                                  recieve: "receive",
                                  seperate: "separate",
                                  occured: "occurred",
                                  definately: "definitely",
                                };

                                let foundIssues = false;
                                for (const [wrong, right] of Object.entries(
                                  commonMisspellings
                                )) {
                                  if (
                                    textToCheck.toLowerCase().includes(wrong)
                                  ) {
                                    foundIssues = true;
                                    break;
                                  }
                                }

                                if (foundIssues) {
                                  toast({
                                    title: "Spelling Check",
                                    description:
                                      "Potential spelling issues found. Please review your text.",
                                    variant: "destructive",
                                  });
                                } else {
                                  toast({
                                    title: "Spelling Check",
                                    description:
                                      "No obvious spelling errors detected.",
                                  });
                                }
                              } else {
                                toast({
                                  title: "No Text Found",
                                  description:
                                    "Please enter some text to check spelling.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-sm  dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors"
                          >
                            {t.checkSpelling}
                          </button>

                          {/* Set up a time to meet with submenu */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                setShowMeetingSubmenu(!showMeetingSubmenu);
                                setShowLabelSubmenu(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center">
                                <svg
                                  className="w-4 h-4 mr-3 dark:text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <div className="w-full text-left py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors flex items-center justify-between">
                                  {t.setUpTimeToMeet}
                                </div>
                                <div className="ml-2 w-2 h-2 bg-[#ffa184] rounded-full"></div>
                              </div>
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>

                            {/* Meeting Submenu */}
                            {showMeetingSubmenu && (
                              <div className="absolute right-full bottom-0 bg-white dark:bg-black border rounded-lg shadow-lg w-56 mr-1">
                                <div className="py-2">
                                  <button
                                    onClick={() => {
                                      setShowMoreOptions(false);
                                      setShowMeetingSubmenu(false);
                                      // Add meeting times proposal to email body
                                      const meetingProposal = `\n\nI'd like to schedule a meeting. Here are some times that work for me:\n\n• Tomorrow at 2:00 PM\n• ${new Date(
                                        Date.now() + 2 * 24 * 60 * 60 * 1000
                                      ).toLocaleDateString()} at 10:00 AM\n• ${new Date(
                                        Date.now() + 3 * 24 * 60 * 60 * 1000
                                      ).toLocaleDateString()} at 3:00 PM\n\nPlease let me know which time works best for you, or suggest alternative times.`;
                                      if (textareaRef.current) {
                                        textareaRef.current.focus();
                                        insertTextAtCaret(meetingProposal);
                                      }
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors flex items-center justify-between"
                                  >
                                    Propose times you're free
                                    <span className="text-xs bg-[#ffa184] text-white px-2 py-1 rounded">
                                      New
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowMoreOptions(false);
                                      setShowMeetingSubmenu(false);
                                      // Add calendar event creation to email
                                      const eventText = `\n\nMeeting Details:\n📅 Date: ${new Date(
                                        Date.now() + 24 * 60 * 60 * 1000
                                      ).toLocaleDateString()}\n🕒 Time: 2:00 PM\n📍 Location: To be determined\n📝 Agenda: [Please add agenda items]\n\nI'll send a calendar invitation once we confirm the details.`;
                                      if (textareaRef.current) {
                                        textareaRef.current.focus();
                                        insertTextAtCaret(eventText);
                                      }
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-gray-100 dark:hover:bg-accent transition-colors flex items-center justify-between"
                                  >
                                    Create an event
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-2 shrink-0">
              <button
                onClick={handleDiscard}
                className="p-1.5 hover:bg-gray-900 rounded"
                title="Discard draft"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              <button
                onClick={() => handleSaveDraft({ showToast: true })}
                className="text-[#ffa184] hover:bg-[#ffa184] hover:text-white border border-[#ffa184] rounded-md px-4 py-1.5 text-sm ml-2"
              >
                Save as Draft
              </button>
              </div>
            </div>
          </div>
        )}

        {/* Virtual Keyboard Modal */}
        {showVirtualKeyboard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] border overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-foreground">
                  Virtual Keyboard
                  {/* {selectedInputLanguage} */}
                </h3>
                <button
                  onClick={() => setShowVirtualKeyboard(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                {/* <div className="flex items-center space-x-4">
                  <select
                    className="border border-border rounded px-3 py-1 text-sm focus:outline-none focus:border-primary bg-background text-foreground"
                    value={selectedInputLanguage}
                    onChange={(e) => setSelectedInputLanguage(e.target.value)}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Chinese">Chinese</option>
                  </select>
                  <button
                    onClick={() => setShowVirtualKeyboard(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
</div> */}
              </div>

              <div className="bg-muted border rounded-lg p-6">
                <div className="space-y-3">
                  {/* Number Row */}
                  <div className="flex justify-center space-x-1">
                    {[
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "0",
                      "-",
                      "=",
                    ].map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            // Simulate backspace at caret using Selection API
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount) {
                              const range = sel.getRangeAt(0);
                              if (range.collapsed && range.startOffset > 0) {
                                range.setStart(
                                  range.startContainer,
                                  range.startOffset - 1
                                );
                                range.deleteContents();
                                // setBodyHtml(textareaRef.current.innerHTML);
                              }
                            }
                          }
                        }}
                        className="w-10 h-10 bg-background dark:bg-white border border-border rounded text-sm font-medium hover:bg-accent transition-colors"
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  {/* Top Row (QWERTY) */}
                  <div className="flex justify-center space-x-1">
                    {[
                      "q",
                      "w",
                      "e",
                      "r",
                      "t",
                      "y",
                      "u",
                      "i",
                      "o",
                      "p",
                      "[",
                      "]",
                    ].map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            // Simulate backspace at caret using Selection API
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount) {
                              const range = sel.getRangeAt(0);
                              if (range.collapsed && range.startOffset > 0) {
                                range.setStart(
                                  range.startContainer,
                                  range.startOffset - 1
                                );
                                range.deleteContents();
                                // setBodyHtml(textareaRef.current.innerHTML);
                              }
                            }
                          }
                        }}
                        className="w-10 h-10 bg-background dark:bg-white border border-border rounded text-sm font-medium hover:bg-accent transition-colors"
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  {/* Middle Row (ASDF) */}
                  <div className="flex justify-center space-x-1">
                    {[
                      "a",
                      "s",
                      "d",
                      "f",
                      "g",
                      "h",
                      "j",
                      "k",
                      "l",
                      ";",
                      "'",
                    ].map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            // Simulate backspace at caret using Selection API
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount) {
                              const range = sel.getRangeAt(0);
                              if (range.collapsed && range.startOffset > 0) {
                                range.setStart(
                                  range.startContainer,
                                  range.startOffset - 1
                                );
                                range.deleteContents();
                                // setBodyHtml(textareaRef.current.innerHTML);
                              }
                            }
                          }
                        }}
                        className="w-10 h-10 bg-background dark:bg-white border border-border rounded text-sm font-medium hover:bg-accent transition-colors"
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  {/* Bottom Row (ZXCV) */}
                  <div className="flex justify-center space-x-1">
                    {["z", "x", "c", "v", "b", "n", "m", ",", "."].map(
                      (key) => (
                        <button
                          key={key}
                          onClick={() => {
                            if (textareaRef.current) {
                              textareaRef.current.focus();
                              // Simulate backspace at caret using Selection API
                              const sel = window.getSelection();
                              if (sel && sel.rangeCount) {
                                const range = sel.getRangeAt(0);
                                if (range.collapsed && range.startOffset > 0) {
                                  range.setStart(
                                    range.startContainer,
                                    range.startOffset - 1
                                  );
                                  range.deleteContents();
                                  // setBodyHtml(textareaRef.current.innerHTML);
                                }
                              }
                            }
                          }}
                          className="w-10 h-10 bg-background dark:bg-white border border-border rounded text-sm font-medium hover:bg-accent transition-colors"
                        >
                          {key}
                        </button>
                      )
                    )}
                  </div>

                  {/* Space Bar Row */}
                  <div className="flex justify-center space-x-1">
                    <button
                      onClick={() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                          // Simulate backspace at caret using Selection API
                          const sel = window.getSelection();
                          if (sel && sel.rangeCount) {
                            const range = sel.getRangeAt(0);
                            if (range.collapsed && range.startOffset > 0) {
                              range.setStart(
                                range.startContainer,
                                range.startOffset - 1
                              );
                              range.deleteContents();
                              // setBodyHtml(textareaRef.current.innerHTML);
                            }
                          }
                        }
                      }}
                      className="w-[300px] h-10 bg-background dark:bg-white border border-border rounded text-sm font-medium hover:bg-accent transition-colors"
                    >
                      Space
                    </button>
                    <button
                      onClick={() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                          // Simulate backspace at caret using Selection API
                          const sel = window.getSelection();
                          if (sel && sel.rangeCount) {
                            const range = sel.getRangeAt(0);
                            if (range.collapsed && range.startOffset > 0) {
                              range.setStart(
                                range.startContainer,
                                range.startOffset - 1
                              );
                              range.deleteContents();
                              // setBodyHtml(textareaRef.current.innerHTML);
                            }
                          }
                        }
                      }}
                      className="w-10 h-10 bg-background dark:bg-white border border-border rounded text-sm font-medium hover:bg-accent transition-colors"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
          defaultValue={inputDialog.defaultValue || ""}
        />

        {showLinkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[999999]">
            <div className="bg-white dark:bg-black p-6 rounded-lg shadow-lg max-w-lg w-full">
              <h2 className="text-lg font-semibold mb-2">Insert Link</h2>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError(
                    e.target.value.trim() ? "" : "Please enter a URL"
                  );
                }}
                placeholder="https://example.com"
                className="w-full border rounded p-2 mb-2 dark:bg-black dark:text-white"
                autoFocus
              />
              {!linkText && (
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Link text"
                  className="w-full border rounded p-2 mb-2 dark:bg-black dark:text-white"
                />
              )}
              {linkError && (
                <div className="text-red-500 text-xs mb-2">{linkError}</div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkModalOk}
                  className="px-4 py-2 rounded bg-[#ffa184] text-white hover:bg-[#fd9474]"
                  disabled={
                    !linkUrl.trim() ||
                    (!linkText && !window.getSelection()?.toString())
                  }
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
