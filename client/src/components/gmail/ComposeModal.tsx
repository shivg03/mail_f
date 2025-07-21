import { useState, useRef, useEffect } from "react";
import { ChevronDown, Minus, Square, X, MoreHorizontal } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "../../contexts/TranslationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { InputDialog } from "@/components/ui/custom-dialog";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
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
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  // Add this new state for HTML body
  const [bodyHtml, setBodyHtml] = useState("");

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  const sendOptionsRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const inputToolsRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Fetch labels from the API
  const { data: apiLabels = [] } = useQuery<
    {
      id: number;
      name: string;
      color: string;
      isVisible: boolean;
      showIfUnread: boolean;
      showInMessageList: boolean;
    }[]
  >({
    queryKey: ["/api/labels"],
  });

  // Create label mutation
  const createLabelMutation = useMutation({
    mutationFn: async (labelData: { name: string; color: string }) => {
      return apiRequest("POST", "/api/labels", labelData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/labels"] });
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

      // Pre-fill form with context data
      setTo(context.to || '');
      setCc(context.cc || '');
      setBcc(context.bcc || '');
      setSubject(context.subject || '');
      setBody(context.body || '');

      // Focus the appropriate field based on context
      setTimeout(() => {
        if (context.isForward) {
          // For forward, focus the To field since it's empty
          const toInput = document.querySelector('input[placeholder="Recipients"]') as HTMLInputElement;
          if (toInput) {
            toInput.focus();
          }
        } else if (context.isReply || context.isReplyAll) {
          // For reply/reply all, focus the body since To is pre-filled
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }
      }, 100);
    };

    window.addEventListener('openComposeWithContext', handleComposeWithContext as EventListener);

    return () => {
      window.removeEventListener('openComposeWithContext', handleComposeWithContext as EventListener);
    };
  }, []);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Debug click outside
      console.log('Click outside event', event.target);
      if (
        showFormattingDropdown &&
        formattingDropdownRef.current &&
        !formattingDropdownRef.current.contains(event.target as Node) &&
        formattingButtonRef.current &&
        !formattingButtonRef.current.contains(event.target as Node)
      ) {
        console.log('Closing formatting dropdown from click outside');
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

    if (showSendOptions || showMoreOptions || showInputTools || showFormattingDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showSendOptions, showMoreOptions, showInputTools, showFormattingDropdown]);

  // Handler for contentEditable input
  const handleBodyHtmlInput = (e: React.FormEvent<HTMLDivElement>) => {
    setBodyHtml(e.currentTarget.innerHTML);
  };

  // Utility to extract plain text from HTML
  const extractPlainText = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.innerText;
  };

  if (!isOpen) return null;

  const handleSend = () => {
    const plainText = extractPlainText(bodyHtml);
    console.log("Sending email:", { to, cc, bcc, subject, bodyHtml, plainText, attachments });
    onClose();
  };

  const handleScheduleSend = async (scheduledTime: Date) => {
    if (!to.trim() || !subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient and subject",
        variant: "destructive",
      });
      return;
    }
    try {
      const plainText = extractPlainText(bodyHtml);
      const emailData = {
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        bodyHtml: bodyHtml || "",
        plainText,
        scheduledTime: scheduledTime.toISOString(),
      };
      console.log("Sending schedule email request:", emailData);
      await scheduleEmailMutation.mutateAsync(emailData);
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBodyHtml("");
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
      setBodyHtml(textareaRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    setInputDialog({
      isOpen: true,
      title: "Insert Link",
      message: "Enter the URL:",
      placeholder: "https://example.com",
      onConfirm: (url) => {
        setInputDialog({
          isOpen: true,
          title: "Link Text",
          message: "Enter link text (optional):",
          placeholder: url,
          onConfirm: (linkText) => {
            const text = linkText.trim() || url;
            insertText(`[${text}](${url})`);
          },
        });
      },
    });
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

  const handleDiscard = () => {
    // Check if there's any content to discard
    const hasContent =
      to.trim() ||
      cc.trim() ||
      bcc.trim() ||
      subject.trim() ||
      body.trim() ||
      attachments.length > 0;

    if (hasContent) {
      // Show confirmation dialog for discarding draft
      setInputDialog({
        isOpen: true,
        title: "Discard Draft",
        message:
          "Are you sure you want to discard this draft? All content will be lost.",
        placeholder: "",
        onConfirm: () => {
          // Clear all fields
          setTo("");
          setCc("");
          setBcc("");
          setSubject("");
          setBody("");
          setAttachments([]);
          setSelectedLabels([]);
          setIsConfidential(false);

          toast({
            title: "Draft Discarded",
            description: "Your draft has been discarded.",
          });

          onClose();
        },
      });
    } else {
      // No content, just close
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
    setUndoStack((prev) => [...prev, body]);
    setRedoStack([]);
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

  // Undo handler
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const prev = undoStack[undoStack.length - 1];
      setRedoStack(r => [bodyHtml, ...r]);
      setUndoStack(u => u.slice(0, -1));
      setBodyHtml(prev);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  // Redo handler
  const handleRedo = () => {
    if (redoStack.length > 0) {
      const next = redoStack[0];
      setUndoStack(u => [...u, bodyHtml]);
      setRedoStack(r => r.slice(1));
      setBodyHtml(next);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-200 ${
        isMaximized
          ? "inset-4 max-md:inset-0"
          : "bottom-0 right-6 max-md:inset-0"
      }`}
    >
      <div
        className={`bg-card shadow-lg border transition-all duration-200 ${
          isMaximized
            ? "h-full w-full rounded-lg max-md:rounded-none"
            : isMinimized
            ? "h-12 w-80 rounded-t-lg max-md:hidden"
            : "h-[550px] w-[480px] rounded-t-lg max-md:w-full max-md:h-full max-md:rounded-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-muted px-4 py-2 rounded-t-lg border-b">
          <span className="text-sm font-medium text-foreground">
            {t.newMessage}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-accent rounded-lg max-md:hidden"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
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

        {(!isMinimized || isMobile) && (
          <div
            className={`flex flex-col ${
              isMaximized || isMobile
                ? "h-[calc(100%-3rem)]"
                : "h-[calc(550px-3rem)]"
            }`}
          >
            {/* Email Fields */}
            <div className="px-4 py-2 flex-shrink-0">
              {/* To Field */}
              <div className="flex items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground w-8">To</span>
                <div className="flex-1">
                  <input
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full py-1 text-sm text-foreground bg-transparent border-0 focus:outline-none focus:ring-0"
                    placeholder={t.recipients}
                  />
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="dark:text-white transition-colors"
                  >
                    Cc
                  </button>
                  <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="dark:text-white transition-colors"
                  >
                    Bcc
                  </button>
                </div>
              </div>

              {/* Cc/Bcc Fields */}
              {showCcBcc && (
                <>
                  <div className="flex items-center py-2 border-b border-border">
                    <span className="text-sm dark:text-white w-8 mr-2">
                      {t.cc}
                    </span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        className="w-full px-2 py-1 text-sm text-foreground bg-transparent border-0 focus:outline-none focus:ring-0"
                        placeholder={t.carbonCopyRecipients}
                      />
                    </div>
                  </div>
                  <div className="flex items-center py-2 border-b border-border">
                    <span className="text-sm dark:text-white w-8 mr-2">
                      {t.bcc}
                    </span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        className="w-full px-2 py-1 text-sm text-foreground bg-transparent border-0 focus:outline-none focus:ring-0"
                        placeholder={t.blindCarbonCopyRecipients}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Subject Field */}
              <div className="flex items-center py-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-2 py-1 text-sm dark:text-white bg-transparent border-b focus:outline-none focus:ring-0"
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
            <div className="flex-1 px-4 py-2 min-h-0 flex flex-col overflow-hidden">
              <div className="relative w-full flex-1 min-h-[120px]">
                {(!bodyHtml || bodyHtml === '<br>') && (
                  <span className="absolute left-2 top-2 text-muted-foreground pointer-events-none select-none opacity-60">
                    {t.compose}
                  </span>
                )}
                <div
                  ref={textareaRef}
                  contentEditable={!isPlainTextMode}
                  className="w-full min-h-[120px] bg-white dark:bg-black rounded px-2 resize-none focus:outline-none"
                  style={{ fontFamily: 'inherit', outline: 'none', overflowY: 'auto' }}
                  onInput={handleBodyHtmlInput}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
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
              <div className="flex items-center space-x-1">
                <div
                  className="flex items-center relative"
                  ref={sendOptionsRef}
                >
                  <button
                    onClick={handleSend}
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
                      console.log('Formatting button clicked');
                      setShowFormattingDropdown((v) => {
                        console.log('Toggling showFormattingDropdown from', v, 'to', !v);
                        return !v;
                      });
                      setShowSendOptions(false);
                      setShowMoreOptions(false);
                      setShowInputTools(false);
                      setShowEmojiPicker(false);
                      setShowDateTimePicker(false);
                    }}
                    className={`p-1.5 rounded-lg ${
                      isFormatting ? "bg-accent text-primary" : "hover:bg-accent text-muted-foreground"
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
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999] bg-white border rounded-lg shadow-lg w-[90vw] max-w-[600px] min-h-[36px] flex items-center gap-2 px-2 overflow-x-auto"
                    >
                      {/* Undo */}
                      <span style={{ opacity: 0.7, margin: "0 6px", cursor: 'pointer' }} onClick={handleUndo} title="Undo">↶</span>
                      {/* Redo */}
                      <span style={{ opacity: 0.7, margin: "0 6px", cursor: 'pointer' }} onClick={handleRedo} title="Redo">↷</span>
                      <span style={{ borderLeft: "1px solid #ddd", height: 24, margin: "0 8px" }} />
                      <span style={{ fontFamily: 'sans-serif', fontSize: 14, margin: "0 6px" }}>Sans Serif ▼</span>
                      <span style={{ borderLeft: "1px solid #ddd", height: 24, margin: "0 8px" }} />
                      <span style={{ fontWeight: 700, fontSize: 16, margin: "0 6px" }}>B</span>
                      <span style={{ fontStyle: 'italic', fontSize: 16, margin: "0 6px" }}>I</span>
                      <span style={{ textDecoration: 'underline', fontSize: 16, margin: "0 6px" }}>U</span>
                      <span style={{ borderLeft: "1px solid #ddd", height: 24, margin: "0 8px" }} />
                      <span style={{ fontSize: 16, margin: "0 6px" }}>A</span>
                      <span style={{ borderLeft: "1px solid #ddd", height: 24, margin: "0 8px" }} />
                      <span style={{ fontSize: 16, margin: "0 6px" }}>☰</span>
                      <span style={{ fontSize: 16, margin: "0 6px" }}>☰</span>
                      <span style={{ fontSize: 16, margin: "0 6px" }}>☰</span>
                      <span style={{ borderLeft: "1px solid #ddd", height: 24, margin: "0 8px" }} />
                      <span style={{ fontSize: 16, margin: "0 6px" }}>▼</span>
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
                    onClick={insertLink}
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
                      <button
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
                      </button>
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
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${
                            selectedInputLanguage === "English"
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
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${
                            selectedInputLanguage === "Spanish"
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
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${
                            selectedInputLanguage === "French"
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
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${
                            selectedInputLanguage === "German"
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
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${
                            selectedInputLanguage === "Portuguese"
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
                          className={`flex items-center space-x-3 px-4 py-2 text-sm hover:bg-accent w-full text-left transition-colors ${
                            selectedInputLanguage === "Chinese"
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
                                    .filter((label) =>
                                      label.name
                                        .toLowerCase()
                                        .includes(
                                          labelSearchQuery.toLowerCase()
                                        )
                                    )
                                    .map((label) => {
                                      // Convert Tailwind color class to custom style
                                      const getColorStyle = (
                                        colorClass: string
                                      ) => {
                                        const colorMap: Record<string, string> =
                                          {
                                            "bg-red-400": "#f87171",
                                            "bg-blue-400": "#60a5fa",
                                            "bg-green-400": "#4ade80",
                                            "bg-yellow-400": "#facc15",
                                            "bg-purple-400": "#c084fc",
                                            "bg-pink-400": "#f472b6",
                                            "bg-orange-400": "#fb923c",
                                            "bg-gray-400": "#9ca3af",
                                            "bg-indigo-400": "#818cf8",
                                            "bg-teal-400": "#2dd4bf",
                                          };
                                        return (
                                          colorMap[colorClass] || "#9ca3af"
                                        );
                                      };

                                      const labelColor = getColorStyle(
                                        label.color
                                      );

                                      return (
                                        <label
                                          key={label.id}
                                          className="flex items-center px-3 py-1.5 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-accent cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            className="mr-3 w-4 h-4 rounded border"
                                            checked={selectedLabels.includes(
                                              label.name
                                            )}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedLabels([
                                                  ...selectedLabels,
                                                  label.name,
                                                ]);
                                              } else {
                                                setSelectedLabels(
                                                  selectedLabels.filter(
                                                    (l) => l !== label.name
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
                                                color: "bg-blue-400",
                                              });
                                              setSelectedLabels([
                                                ...selectedLabels,
                                                newLabelName.trim(),
                                              ]);
                                              setNewLabelName("");
                                              setShowCreateLabelInput(false);
                                            } else if (e.key === "Escape") {
                                              setNewLabelName("");
                                              setShowCreateLabelInput(false);
                                            }
                                          }}
                                        />
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            onClick={() => {
                                              if (newLabelName.trim()) {
                                                createLabelMutation.mutate({
                                                  name: newLabelName.trim(),
                                                  color: "bg-blue-400",
                                                });
                                                setSelectedLabels([
                                                  ...selectedLabels,
                                                  newLabelName.trim(),
                                                ]);
                                                setNewLabelName("");
                                                setShowCreateLabelInput(false);
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
                            <span className="mr-2 text-red-500">📝</span>
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
                                ${
                                  enableSignature && signature
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
                                      setBodyHtml(bodyHtml + meetingProposal);
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
                                      setBodyHtml(bodyHtml + eventText);
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
                                range.setStart(range.startContainer, range.startOffset - 1);
                                range.deleteContents();
                                setBodyHtml(textareaRef.current.innerHTML);
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
                                range.setStart(range.startContainer, range.startOffset - 1);
                                range.deleteContents();
                                setBodyHtml(textareaRef.current.innerHTML);
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
                                range.setStart(range.startContainer, range.startOffset - 1);
                                range.deleteContents();
                                setBodyHtml(textareaRef.current.innerHTML);
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
                                  range.setStart(range.startContainer, range.startOffset - 1);
                                  range.deleteContents();
                                  setBodyHtml(textareaRef.current.innerHTML);
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
                              range.setStart(range.startContainer, range.startOffset - 1);
                              range.deleteContents();
                              setBodyHtml(textareaRef.current.innerHTML);
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
                              range.setStart(range.startContainer, range.startOffset - 1);
                              range.deleteContents();
                              setBodyHtml(textareaRef.current.innerHTML);
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
        />
      </div>
    </div>
  );
}