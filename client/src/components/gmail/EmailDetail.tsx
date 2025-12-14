import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { Email } from "@shared/schema";
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  Flag,
  Mail,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckSquare,
  Calendar,
  Tag,
  Filter,
  VolumeX,
  Search,
  ChevronRight,
  Printer,
  Shield,
  Languages,
  Download,
  FileText,
  MoreHorizontal,
  BookOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, updateConversationMessages } from "../../lib/queryClient";
import linkifyHtml from 'linkify-html';
import Loader from "@/components/ui/Loader";
import { jwtDecode } from "jwt-decode";

interface mainMessageProps {
  mailId: string;
  emailUniqueId: string | null;
  threadId: string | null; // <-- add this
  onBack: () => void;
  onOpenFilters?: () => void;
  currentView?: string;
}

// Helper to extract name and address for display
function getDisplayName(fromObj: any, fallback: string) {
  if (fromObj?.value?.[0]) {
    let { name, address } = fromObj.value[0];
    if (name) {
      // Remove all quotes (single or double) from the name, even if embedded
      name = name.replace(/['"]/g, "").trim();
      return name ? `${name} <${address}>` : address;
    }
    return address;
  }
  return fallback;
}

// Helper to extract avatar letter from sender name or address
function getAvatarLetter(fromObj: any, fallback: string) {
  if (fromObj?.value?.[0]) {
    let { name, address } = fromObj.value[0];
    if (name) {
      // Remove all quotes and trim, then take the first character
      const cleanName = name.replace(/['"]/g, "").trim();
      if (cleanName.length > 0) {
        return cleanName.charAt(0).toUpperCase();
      }
    }
    if (address && address.length > 0) {
      return address.charAt(0).toUpperCase();
    }
  }
  if (typeof fromObj === "string" && fromObj.length > 0) {
    return fromObj.replace(/['"]/g, "").trim().charAt(0).toUpperCase();
  }
  if (fallback && fallback.length > 0) {
    return fallback.replace(/['"]/g, "").trim().charAt(0).toUpperCase();
  }
  return "U";
}

function preprocessLinks(text: string) {
  // Replace <www.example.com> with www.example.com
  return text.replace(/<([^>]+)>/g, '$1');
}

// Utility to ensure all <a> tags in HTML have absolute hrefs and open in new tab
function fixLinksInHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return html;
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const anchors = doc.querySelectorAll('a[href]');
  anchors.forEach((a) => {
    let href = a.getAttribute('href') || '';
    // If href does not start with http, https, or mailto, prepend https://
    if (!/^(https?:|mailto:)/i.test(href)) {
      href = 'https://' + href.replace(/^\/+/, '');
      a.setAttribute('href', href);
    }
    // Always open in new tab securely
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
}

// Remove empty <div><br></div> blocks that cause extra gaps
function cleanEmailHtml(html: string): string {
  // Remove <div ...><br></div> (with any attributes, whitespace, or self-closing br)
  return html.replace(/<div[^>]*>\s*<br\s*\/?>(\s*)<\/div>/gi, '');
}

interface ShowMoreMenuDropdownProps {
  open: boolean;
  onClose: () => void;
  handleSnoozeClick: () => void;
  handleAddToTasksClick: () => void;
  handleLabelSelect: (labelId: string) => void;
  handleCreateLabel: () => void;
  handleMuteClick: () => void;
  handlePrintClick: () => void;
  handleBlockClick: () => void;
  handleTranslateClick: (msg: any) => void;
  handleDownloadClick: () => void;
  labelSearchQuery: string;
  setLabelSearchQuery: (v: string) => void;
  labelsLoading: boolean;
  apiLabels: any[];
  assignLabelsMutation: any;
  removeLabelsMutation: any;
  showCreateLabel: boolean;
  setShowCreateLabel: (v: boolean) => void;
  newLabelName: string;
  setNewLabelName: (v: string) => void;
  createLabelMutation: { isPending: boolean };
  onOpenFilters?: () => void;
  setShowOriginalModal: (v: boolean) => void;
  mailId: string;
  mainMessage: any;
  emailUniqueId: string;
  sendMail_Id?: string;
}

const ShowMoreMenuDropdown: React.FC<ShowMoreMenuDropdownProps> = ({
  open,
  onClose,
  handleSnoozeClick,
  handleAddToTasksClick,
  handleLabelSelect,
  handleCreateLabel,
  handleMuteClick,
  handlePrintClick,
  handleBlockClick,
  handleTranslateClick,
  handleDownloadClick,
  labelSearchQuery,
  setLabelSearchQuery,
  labelsLoading,
  apiLabels,
  assignLabelsMutation,
  removeLabelsMutation,
  showCreateLabel,
  setShowCreateLabel,
  newLabelName,
  setNewLabelName,
  createLabelMutation,
  onOpenFilters,
  setShowOriginalModal,
  mailId,
  mainMessage, // <-- this is the message for this dropdown
  emailUniqueId,
  sendMail_Id,
}) => {
  if (!open) return null;
  const labelSubmenuHoverRef = useRef(false);
  const submenuCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Add ref and state for submenu positioning
  const labelAsButtonRef = useRef<HTMLButtonElement>(null);
  const [showLabelSubmenu, setShowLabelSubmenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);

  const handleLabelParentEnter = () => {
    if (labelAsButtonRef.current) {
      const rect = labelAsButtonRef.current.getBoundingClientRect();
      const submenuWidth = 256; // 16rem in px
      let left = rect.right;
      // If not enough space on the right, open to the left
      if (left + submenuWidth > window.innerWidth) {
        left = rect.left - submenuWidth;
      }
      setSubmenuPosition({
        top: rect.top,
        left,
      });
    }
    setShowLabelSubmenu(true);
  };
  const handleLabelParentLeave = () => {
    submenuCloseTimeoutRef.current = setTimeout(() => {
      setShowLabelSubmenu(false);
    }, 200);
  };

  const handleLabelSubmenuEnter = () => {
    if (submenuCloseTimeoutRef.current) {
      clearTimeout(submenuCloseTimeoutRef.current);
      submenuCloseTimeoutRef.current = null;
    }
    setShowLabelSubmenu(true);
  };

  const handleLabelSubmenuLeave = () => {
    setShowLabelSubmenu(false);
  };

  const labelQueryId =
    mainMessage?.emailUniqueId || mainMessage?.sendMail_Id || "";

  const { data: emailLabelsData, isLoading: emailLabelsLoading } = useQuery({
    queryKey: [
      "/email/getEmailLabels",
      mainMessage?.emailUniqueId
        ? { emailUniqueId: mainMessage.emailUniqueId }
        : { sendmail_id: sendMail_Id || mainMessage?.sendMail_Id }
    ],
    queryFn: async () => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const body = mainMessage?.emailUniqueId
        ? { emailUniqueId: mainMessage.emailUniqueId, __headers: headers }
        : { sendmail_id: sendMail_Id || mainMessage?.sendMail_Id, __headers: headers };
      const response = await apiRequest("POST", "/email/getEmailLabels", body);
      const labels = response.data?.labels || response.data?.data?.labels || [];
      return { labels };
    },
    enabled: !!labelQueryId,
    refetchOnMount: true,
    staleTime: 0,
  });

  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  useEffect(() => {
    if (emailLabelsData && Array.isArray(emailLabelsData.labels)) {
      setSelectedLabels(emailLabelsData.labels.map((l: any) => l.labelUniqueId));
    } else {
      setSelectedLabels([]);
    }
  }, [emailLabelsData]);

  if (!open) return null;
  const handleLabelSelectLocal = (labelUniqueId: string) => {
    const isCurrentlySelected = selectedLabels.includes(labelUniqueId);
    if (isCurrentlySelected) {
      setSelectedLabels(selectedLabels.filter(id => id !== labelUniqueId));
      removeLabelsMutation.mutate({
        labelUniqueId,
        emailUniqueId: mainMessage.emailUniqueId,
        sendMail_Id: sendMail_Id,
      });
    } else {
      setSelectedLabels([...selectedLabels, labelUniqueId]);
      assignLabelsMutation.mutate({
        labelUniqueId,
        emailUniqueId: mainMessage.emailUniqueId,
        sendMail_Id: sendMail_Id,
      });
    }
  };
  return (
    <div className="fixed md:right-16 right-6 top-25 w-64 bg-white dark:bg-black border rounded-lg shadow-lg z-[9999]"
      style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      <div className="py-2">
        <button
          onClick={() => {
            handleSnoozeClick();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Clock className="w-4 h-4" />
          Snooze
        </button>
        <button
          onClick={() => {
            handleAddToTasksClick();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <CheckSquare className="w-4 h-4" />
          Add to Tasks
        </button>
        <button
          onClick={onClose}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Create event
        </button>
        <hr className="my-2" />
        <div
          className="relative"
          onMouseEnter={handleLabelParentEnter}
          onMouseLeave={handleLabelParentLeave}
        >
          <button
            ref={labelAsButtonRef}
            className="w-full flex items-center justify-between px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3 dark:text-white hover:bg-accent">
              <Tag className="w-4 h-4" />
              Label as
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>
          {showLabelSubmenu && submenuPosition && (
            <div
              onMouseEnter={handleLabelSubmenuEnter}
              onMouseLeave={handleLabelSubmenuLeave}
              style={{
                position: 'fixed',
                top: submenuPosition.top,
                left: submenuPosition.left,
                zIndex: 10000,
                width: '16rem',
                background: 'white',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
              }}
            >
              <div className="p-3">
                <div className="text-sm font-medium dark:text-white mb-2">Label as:</div>
                <div className="">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search labels..."
                      value={labelSearchQuery}
                      onChange={(e) => setLabelSearchQuery(e.target.value)}
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
                <div className="space-y-1 mb-3">
                  {(labelsLoading || emailLabelsLoading) && (
                    <div className="text-sm text-gray-500 px-2">
                      Loading labels...
                    </div>
                  )}
                  {!labelsLoading && !emailLabelsLoading && (!Array.isArray(apiLabels) || apiLabels.length === 0) && (
                    <div className="text-sm text-gray-500 px-2">
                      No labels found.
                    </div>
                  )}
                  {!labelsLoading && !emailLabelsLoading && Array.isArray(apiLabels) &&
                    apiLabels.map((label) => {
                      const isChecked = selectedLabels.includes(label.labelUniqueId);
                      const isUpdating = assignLabelsMutation.isPending || removeLabelsMutation.isPending;
                      return (
                        <label
                          key={label.id}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-[#ffa184]"
                            checked={isChecked}
                            disabled={isUpdating}
                            onChange={() => handleLabelSelectLocal(label.labelUniqueId)}
                          />
                          <span className="text-sm dark:text-white">
                            {label.name}
                          </span>
                        </label>
                      );
                    })}
                </div>
                <div className="border-t pt-2 space-y-1">
                  {!showCreateLabel ? (
                    <button
                      onClick={() => setShowCreateLabel(true)}
                      className="w-full text-left px-2 py-1 text-sm dark:text-white hover:bg-accent rounded"
                    >
                      Create new
                    </button>
                  ) : (
                    <div className="px-2 py-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Enter label name"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background text-foreground"
                        onKeyPress={(e) => e.key === "Enter" && handleCreateLabel()}
                        autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCreateLabel}
                          disabled={createLabelMutation.isPending}
                          className="flex-1 px-2 py-1 text-xs text-primary-foreground rounded bg-[#ffa184] hover:bg-[#fd9474] disabled:opacity-50"
                        >
                          {createLabelMutation.isPending ? "Creating..." : "Create"}
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateLabel(false);
                            setNewLabelName("");
                          }}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(
                        new CustomEvent("openSettingsWithTab", {
                          detail: { tab: "Labels" },
                        })
                      );
                    }}
                    className="w-full text-left px-2 py-1 text-sm dark:text-white hover:bg-accent rounded"
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
            onClose();
            onOpenFilters?.();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filter messages like these
        </button>
        <button
          onClick={() => {
            handleMuteClick();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <VolumeX className="w-4 h-4" />
          Mute
        </button>
        <hr className="my-2" />
        <button
          onClick={() => {
            handlePrintClick();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={() => {
            handleBlockClick();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Shield className="w-4 h-4" />
          Block sender
        </button>
        <button
          onClick={() => {
            handleTranslateClick(mainMessage);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Languages className="w-4 h-4" />
          Translate message
        </button>
        <button
          onClick={() => {
            handleDownloadClick();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <Download className="w-4 h-4" />
          Download message
        </button>
        <button
          onClick={() => {
            setShowOriginalModal(true);
            onClose();
            // Use mainMessage.emailUniqueId or mainMessage.sendMail_Id for the URL
            const id = mainMessage?.emailUniqueId || mainMessage?.sendMail_Id || emailUniqueId;
            if (id) {
              // Store rawEml in localStorage if present
              if (mainMessage.rawEml) {
                try {
                  localStorage.setItem(`rawEml_${id}`, mainMessage.rawEml);
                } catch (e) { /* ignore quota errors */ }
              }
              window.open(`/mailbox/m/${mailId}/${mainMessage?.mailbox || 'inbox'}/email/${id}/original`, '_blank');
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
        >
          <FileText className="w-4 h-4" />
          Show original
        </button>
      </div>
    </div>
  );
};

// Utility function to get the correct payload for updating mail attributes
function getMailUpdatePayload(message: any, updates: any) {
  if (message.sendMail_Id) {
    return { sendmail_id: message.sendMail_Id, ...updates };
  } else if (message.emailUniqueId) {
    return { emailUniqueId: message.emailUniqueId, ...updates };
  }
  return updates;
}

function getUserEmailFromToken() {
  const token = localStorage.getItem("authtoken");
  if (!token) return "";
  try {
    const decoded = jwtDecode(token) as any;
    return decoded.userEmail || "";
  } catch {
    return "";
  }
}

// Helper to decode RFC 2047 encoded-words (Q and B encoding)
function decodeRFC2047(str: string): string {
  if (!str) return "";
  return str.replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (
    _match: string,
    charset: string,
    encoding: string,
    encodedText: string
  ): string => {
    if (/^q$/i.test(encoding)) {
      return decodeURIComponent(
        encodedText.replace(/_/g, " ").replace(/=([A-Fa-f0-9]{2})/g, "%$1")
      );
    } else if (/^b$/i.test(encoding)) {
      try {
        return new TextDecoder(charset).decode(Uint8Array.from(atob(encodedText.replace(/\s/g, "")), c => c.charCodeAt(0)));
      } catch {
        return encodedText;
      }
    }
    return encodedText;
  });
}

// Helper to decode quoted-printable encoding
function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/=\r?\n/g, ''); // Remove soft line breaks
}

// Helper to extract and decode the first text/plain part from rawEml
function extractPlainTextFromRawEml(raw: string): string {
  // Find the first text/plain part with quoted-printable encoding
  const match = raw.match(/Content-Type: text\/plain;[\s\S]*?Content-Transfer-Encoding: quoted-printable[\s\S]*?\n\n([\s\S]*?)(?:\n--|$)/i);
  if (match && match[1]) {
    return decodeQuotedPrintable(match[1].trim());
  }
  // Fallback: just return the whole body
  return raw;
}

export default function mainMessage({
  mailId,
  emailUniqueId,
  threadId, // <-- add this
  onBack,
  onOpenFilters,
  currentView,
}: mainMessageProps) {
  console.log('DEBUG: mainMessage props', { mailId, emailUniqueId, threadId });
  const [hasMarkedAsRead, setHasMarkedAsRead] = React.useState(false);
  const [showDetailsIdx, setShowDetailsIdx] = useState<number | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [labelSearchQuery, setLabelSearchQuery] = useState("");
  // Use string[] for selectedLabels
  const [selectedLabels, setSelectedLabels] = React.useState<string[]>([]);
  const [showCreateLabel, setShowCreateLabel] = React.useState(false);
  const [newLabelName, setNewLabelName] = React.useState("");
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [modalAttachment, setModalAttachment] = useState<any | null>(null);
  const [showOriginalModal, setShowOriginalModal] = useState(false);
  const linkifyOptions = {
    defaultProtocol: 'https',
    target: {
      url: '_blank'
    }
  };

  // 1. Add state for per-message menu and submenu hover delay
  const [showMoreMenuIdx, setShowMoreMenuIdx] = useState<number | null>(null);
  // 1. At the parent component level (mainMessage), manage label submenu hover and timeout globally:


  // Add these in mainMessage (replace any old handleLabelSubmenuMouseEnter/handleLabelSubmenuMouseLeave):
  // const handleLabelParentEnter = () => {
  //   if (labelSubmenuCloseTimeoutRef.current) clearTimeout(labelSubmenuCloseTimeoutRef.current);
  //   labelSubmenuHoverRef.current = true;
  //   setShowLabelSubmenu(true);
  // };

  // Fetch labels for this mailId
  const { data: apiLabels = [], isLoading: labelsLoading } = useQuery({
    queryKey: ["/label/getLabels", mailId],
    queryFn: async () => {
      if (!mailId) return [];
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/label/getLabels", {
        mail_id: mailId,
        __headers: headers,
      });
      console.log('DEBUG: Labels API response:', response.data);
      return response.data;
    },
    enabled: !!mailId,
    refetchOnMount: true, // Force refetch when component mounts
    staleTime: 0, // Consider data stale immediately
  });

  // Fetch conversation for this thread
  const { data: conversationData, isLoading, refetch } = useQuery({
    queryKey: ["/mails/conversation", mailId, threadId],
    queryFn: async () => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/mails/conversation", {
        mail_id: mailId,
        threadId,
        __headers: headers,
      });
      // Support both data.conversation and data.data.conversation
      console.log('DEBUG: Conversation API response:', response.data);
      console.log('DEBUG: Conversation API response:', response.data?.conversation);
      console.log('DEBUG: Conversation API response:', response.data?.data?.conversation);
      return response.data?.conversation || response.data?.data?.conversation || [];
    },
    enabled: !!mailId && !!threadId,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Use the first message as the main message for header display
  const mainMessage = conversationData && conversationData.length > 0 ? conversationData[0] : null;
  // Add state for the message being labeled, after mainMessage is defined
  const [labelTargetMessage, setLabelTargetMessage] = useState<any>(mainMessage);

  // Update the /email/getEmailLabels query to use the correct ID
  const labelQueryId =
    labelTargetMessage?.emailUniqueId ||
    labelTargetMessage?.sendMail_Id ||
    "";

  // Fetch email's assigned labels using the new backend endpoint
  // const { data: emailLabelsData, isLoading: emailLabelsLoading } = useQuery({
  //   queryKey: [
  //     "/email/getEmailLabels",
  //     labelTargetMessage?.emailUniqueId
  //       ? { emailUniqueId: labelTargetMessage.emailUniqueId }
  //       : { sendmail_id: labelTargetMessage?.sendMail_Id }
  //   ],
  //   queryFn: async () => {
  //     console.log("Fetching labels for", labelTargetMessage);
  //     const authtoken = localStorage.getItem("authtoken");
  //     const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
  //     const body = labelTargetMessage?.emailUniqueId
  //       ? { emailUniqueId: labelTargetMessage.emailUniqueId, __headers: headers }
  //       : { sendmail_id: labelTargetMessage?.sendMail_Id, __headers: headers };
  //     const response = await apiRequest("POST", "/email/getEmailLabels", body);
  //     const labels = response.data?.labels || response.data?.data?.labels || [];
  //     return { labels };
  //   },
  //   enabled: !!labelQueryId,
  //   refetchOnMount: true,
  //   staleTime: 0,
  // });

  // Create label mutation
  const createLabelMutation = useMutation({
    mutationFn: async ({ name, color, isVisible, showIfUnread, showInMessageList }: {
      name: string;
      color: string;
      isVisible: boolean;
      showIfUnread: boolean;
      showInMessageList: boolean;
    }) => {
      if (!mailId) throw new Error("No mailId");
      return await apiRequest("POST", "/label/createLabel", {
        mail_id: mailId,
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
      toast({
        title: "Label created",
        description: "New label has been created successfully.",
      });
    },
    onError: (error) => {
      console.error("Error creating label:", error);
      toast({
        title: "Error",
        description: "Failed to create label. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating email attributes (seen, starred, etc.)
  const updateEmailAttributesMutation = useMutation({
    mutationFn: async (attributes: any) => {
      console.log('DEBUG: Calling /email/updateEmail with', attributes);
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      return apiRequest("POST", "/email/updateEmail", {
        ...attributes,
        __headers: headers,
      });
    },
    onSuccess: () => {
      // Explicitly invalidate conversation and mail detail queries
      queryClient.invalidateQueries({ queryKey: ["/mails/conversation", mailId, threadId] });
      queryClient.invalidateQueries({ queryKey: ["/mails/getMailDetailFromStorage", mailId, emailUniqueId] });
      queryClient.invalidateQueries({ queryKey: ["/email/allmails"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update email attributes.",
        variant: "destructive",
      });
    },
  });

  const assignLabelsMutation = useMutation({
    mutationFn: async ({ labelUniqueId, emailUniqueId, sendMail_Id }: { labelUniqueId: string; emailUniqueId?: string; sendMail_Id?: string }) => {
      console.log('DEBUG: Calling assignLabelsToEmail API with:', { labelUniqueId, emailUniqueId, mailId });
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/email/assignLabelsToEmail", {
        labelUniqueId,
        emailUniqueId,
        sendmail_id: sendMail_Id,
        replace: false, // Add labels without removing existing ones
        __headers: headers,
      });
      console.log('DEBUG: assignLabelsToEmail API response:', response);
      return response;
    },
    onSuccess: (data) => {
      console.log('DEBUG: assignLabelsMutation onSuccess called with:', data);
      toast({ title: "Labels updated", description: "Labels assigned to email." });
      // Invalidate email labels query to refresh the assigned labels
      queryClient.invalidateQueries({
        queryKey: ["/email/getEmailLabels", labelQueryId]
      });
      queryClient.refetchQueries({ queryKey: ["/email/getEmailLabels", labelQueryId] });
      // Invalidate email detail query to refresh the email data
      queryClient.invalidateQueries({
        queryKey: ["/mails/getMailDetailFromStorage", mailId, labelQueryId]
      });
      // Also invalidate labels query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
    },
    onError: (err) => {
      console.error('DEBUG: assignLabelsMutation onError:', err);
      toast({ title: "Error", description: "Failed to update labels", variant: "destructive" });
    }
  });

  const removeLabelsMutation = useMutation({
    mutationFn: async ({ labelUniqueId, emailUniqueId, sendMail_Id }: { labelUniqueId: string; emailUniqueId?: string; sendMail_Id?: string }) => {
      console.log('DEBUG: Calling removeLabelsFromEmail API with:', { labelUniqueId, emailUniqueId, mailId });
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/email/removeLabelsFromEmail", {
        labelUniqueId,
        emailUniqueId,
        sendmail_id: sendMail_Id,
        __headers: headers,
      });
      console.log('DEBUG: removeLabelsFromEmail API response:', response);
      return response;
    },
    onSuccess: (data) => {
      console.log('DEBUG: removeLabelsMutation onSuccess called with:', data);
      toast({ title: "Labels updated", description: "Labels removed from email." });
      // Invalidate email labels query to refresh the assigned labels
      queryClient.invalidateQueries({
        queryKey: ["/email/getEmailLabels", labelQueryId]
      });
      queryClient.refetchQueries({ queryKey: ["/email/getEmailLabels", labelQueryId] });
      // Invalidate email detail query to refresh the email data
      queryClient.invalidateQueries({
        queryKey: ["/mails/getMailDetailFromStorage", mailId, labelQueryId]
      });
      // Also invalidate labels query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
    },
    onError: (err) => {
      console.error('DEBUG: removeLabelsMutation onError:', err);
      toast({ title: "Error", description: "Failed to remove labels", variant: "destructive" });
    }
  });

  // Update selectedLabels effect to use the correct message's labels
  // React.useEffect(() => {
  //   if (emailLabelsData && Array.isArray(emailLabelsData.labels)) {
  //     const selectedLabelIds = emailLabelsData.labels.map((emailLabel: any) => emailLabel.labelUniqueId);
  //     setSelectedLabels(selectedLabelIds);
  //   } else {
  //     setSelectedLabels([]);
  //   }
  // }, [emailLabelsData]);

  const userEmail = getUserEmailFromToken();
  // Mark as read logic for received messages only
  React.useEffect(() => {
    if (Array.isArray(conversationData)) {
      conversationData.forEach((msg) => {
        // Only mark as read if:
        // - isUnread is true
        // - The message is received by the current user
        if (
          msg.isUnread &&
          (msg.to === userEmail || msg.recipient === userEmail)
        ) {
          updateEmailAttributesMutation.mutate(getMailUpdatePayload(msg, {
            emailUniqueId: msg.emailUniqueId,
            seen: true,
          }));
        }
      });
    }
  }, [conversationData, userEmail]);

  // Remove old per-action mutations (starMutation, archiveMutation, spamMutation, taskMutation, muteMutation, snoozeMutation, deleteMutation, importantMutation)

  // Handlers using the new mutation:
  const handleStarClick = async (msg: any) => {
    if (msg && (msg.emailUniqueId || msg.sendMail_Id)) {
      const newStarValue = !msg.isStarred;
      // Star/unstar the clicked message
      await updateEmailAttributesMutation.mutateAsync(getMailUpdatePayload(msg, {
        emailUniqueId: msg.emailUniqueId,
        sendmail_id: msg.sendMail_Id,
        isStarred: newStarValue,
      }));

      // Star/unstar the main message if it's not the same as the clicked message
      if (
        mainMessage &&
        (mainMessage.emailUniqueId !== msg.emailUniqueId || mainMessage.sendMail_Id !== msg.sendMail_Id)
      ) {
        await updateEmailAttributesMutation.mutateAsync(getMailUpdatePayload(mainMessage, {
          emailUniqueId: mainMessage.emailUniqueId,
          sendmail_id: mainMessage.sendMail_Id,
          isStarred: newStarValue,
        }));
      }

      // If un-starring, also unstar all conversation messages
      if (!newStarValue && Array.isArray(conversationData)) {
        await Promise.all(
          conversationData.map(async (convMsg: any) => {
            if (convMsg.isStarred) {
              await updateEmailAttributesMutation.mutateAsync(getMailUpdatePayload(convMsg, {
                emailUniqueId: convMsg.emailUniqueId,
                sendmail_id: convMsg.sendMail_Id,
                isStarred: false,
              }));
            }
          })
        );
      }
    }
  };

  const handleArchiveClick = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { isArchived: !mainMessage.isArchived }, authtoken);
      toast({
        title: !mainMessage.isArchived ? "Email archived" : "Email unarchived",
        description: !mainMessage.isArchived ? "The email has been moved to archive." : "The email has been removed from archive.",
      });
      onBack();
    }
  };

  const handleReportSpam = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { isSpam: !mainMessage.isSpam }, authtoken);
      toast({
        title: !mainMessage.isSpam ? "Reported as spam" : "Removed from spam",
        description: !mainMessage.isSpam ? "The email has been moved to spam." : "The email has been removed from spam.",
      });
      onBack();
    }
  };

  const handleDeleteClick = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { isTrash: !mainMessage.isTrash }, authtoken);
      toast({
        title: !mainMessage.isTrash ? "Email deleted" : "Email restored",
        description: !mainMessage.isTrash ? "The email has been moved to trash." : "The email has been restored from trash.",
      });
      onBack();
    }
  };

  const handleMarkAsUnread = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { seen: false }, authtoken);
      toast({
        title: "Marked as unread",
        description: "The email has been marked as unread.",
      });
    }
  };

  const handleSnoozeClick = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { isSnoozed: !mainMessage.isSnoozed }, authtoken);
      toast({
        title: !mainMessage.isSnoozed ? "Email snoozed" : "Snooze removed",
        description: !mainMessage.isSnoozed ? "Email has been snoozed." : "Snooze removed from email.",
      });
      onBack && onBack();
    }
  };

  const handleAddToTasksClick = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { isAddToTask: !mainMessage.isAddToTask }, authtoken);
      toast({
        title: !mainMessage.isAddToTask ? "Added to tasks" : "Removed from tasks",
        description: !mainMessage.isAddToTask ? "Email has been added to tasks." : "Email has been removed from tasks.",
      });
      onBack && onBack();
    }
  };

  const handleMuteClick = async () => {
    if (mainMessage && threadId && mailId) {
      const authtoken = localStorage.getItem("authtoken") || "";
      await updateConversationMessages(mailId, threadId, { isMute: !mainMessage.isMute }, authtoken);
      toast({
        title: !mainMessage.isMute ? "Email muted" : "Unmuted",
        description: !mainMessage.isMute ? "Email has been muted." : "Email has been unmuted.",
      });
      onBack && onBack();
    }
  };

  // Update handleLabelSelect to accept a message argument
  const handleLabelSelect = async (labelUniqueId: string, msg: any) => {
    const isCurrentlySelected = selectedLabels.includes(labelUniqueId);

    // Optimistically update the UI
    if (isCurrentlySelected) {
      setSelectedLabels(selectedLabels.filter(id => id !== labelUniqueId));
      removeLabelsMutation.mutate({
        labelUniqueId,
        emailUniqueId: msg.emailUniqueId,
        sendMail_Id: msg.sendMail_Id,
      });
    } else {
      setSelectedLabels([...selectedLabels, labelUniqueId]);
      assignLabelsMutation.mutate({
        labelUniqueId,
        emailUniqueId: msg.emailUniqueId,
        sendMail_Id: msg.sendMail_Id,
      });
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    createLabelMutation.mutate({
      name: newLabelName.trim(),
      color: "#ffa184", // Default color for new labels
      isVisible: true,
      showIfUnread: true,
      showInMessageList: true,
    });
  };

  const handleReplyClick = () => {
    if (mainMessage) {
      // Use 'from' for the sender's email in inbox
      const senderEmail = mainMessage.from || "";

      // Format the quoted original message
      const originalDate = mainMessage.date
        ? new Date(mainMessage.date).toLocaleString()
        : "Unknown date";
      const latestMessage = Array.isArray(conversationData) && conversationData.length > 0
        ? conversationData[conversationData.length - 1]
        : mainMessage;
      const originalFrom = latestMessage.from || "";
      const originalSubject = latestMessage.subject || "";
      const originalContent = latestMessage.parsedHtml || latestMessage.html || latestMessage.content || "";

      const quotedHtml = `
      <blockquote style="border-left:2px solid #ccc; margin-left:1em; padding-left:1em; color:#555; background:#f9f9f9;">
        On ${originalDate}, ${originalFrom} wrote:<br>
        ${originalContent}
      </blockquote>
    `;
      const replyContext = {
        to: senderEmail,
        subject: originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,
        body: `<br><br>${quotedHtml}`,
        isReply: true,
        replyToMessageId: mainMessage.messageId, // <-- use the real messageId here!
        threadId: mainMessage.threadId,
      };

      window.dispatchEvent(
        new CustomEvent("openComposeWithContext", {
          detail: replyContext,
        })
      );
    }
  };

  const handleReplyAllClick = () => {
    if (mainMessage) {
      // Use 'from' for the sender's email in inbox
      const senderEmail = mainMessage.from || "";
      // For reply all, you may want to include other recipients (cc, bcc) if available
      // For now, just reply to sender
      const originalDate = mainMessage.date
        ? new Date(mainMessage.date).toLocaleString()
        : "Unknown date";
      const latestMessage = Array.isArray(conversationData) && conversationData.length > 0
        ? conversationData[conversationData.length - 1]
        : mainMessage;
      const originalFrom = latestMessage.from || "";
      const originalSubject = latestMessage.subject || "";
      const originalContent = latestMessage.parsedHtml || latestMessage.html || latestMessage.content || "";

      const quotedHtml = `
        <blockquote style="border-left:2px solid #ccc; margin-left:1em; padding-left:1em; color:#555; background:#f9f9f9;">
          On ${originalDate}, ${originalFrom} wrote:<br>
          ${originalContent}
        </blockquote>
      `;

      const replyAllContext = {
        to: senderEmail,
        subject: originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`,
        body: `<br><br>${quotedHtml}`,
        isReplyAll: true,
        replyToMessageId: mainMessage.messageId, // <-- use the real messageId here!
        threadId: mainMessage.threadId,
      };

      window.dispatchEvent(
        new CustomEvent("openComposeWithContext", {
          detail: replyAllContext,
        })
      );
    }
  };

  const handleForwardClick = () => {
    if (mainMessage) {
      // Use 'from' for the sender's email in inbox
      const originalDate = mainMessage.date
        ? new Date(mainMessage.date).toLocaleString()
        : "Unknown date";
      const latestMessage = Array.isArray(conversationData) && conversationData.length > 0
        ? conversationData[conversationData.length - 1]
        : mainMessage;
      const originalFrom = latestMessage.from || "";
      const originalTo = latestMessage.to || "";
      const originalSubject = latestMessage.subject || "";
      const originalContent = latestMessage.parsedHtml || latestMessage.html || latestMessage.content || "";

      const quotedHtml = `
      <blockquote style="border-left:2px solid #ccc; margin-left:1em; padding-left:1em; color:#555; background:#f9f9f9;">
        ---------- Forwarded message ----------<br>
        From: ${originalFrom}<br>
        Date: ${originalDate}<br>
        Subject: ${originalSubject}<br>
        To: ${originalTo}<br><br>
        ${originalContent}
      </blockquote>
    `;

      const forwardContext = {
        to: "",
        subject: originalSubject.startsWith("Fwd:") ? originalSubject : `Fwd: ${originalSubject}`,
        body: `<br><br>${quotedHtml}`,
        isForward: true,
        originalEmailId: mainMessage.id,
        threadId: mainMessage.threadId,
      };

      window.dispatchEvent(
        new CustomEvent("openComposeWithContext", {
          detail: forwardContext,
        })
      );
    }
  };

  const handlePrintClick = () => {
    toast({
      title: "Print",
      description: "Opening print dialog...",
    });
    // In a real app, this would open the browser's print dialog
    window.print();
  };

  const handleBlockClick = () => {
    if (mainMessage) {
      toast({
        title: "Sender blocked",
        description: `${mainMessage.sender} has been blocked. Future emails will be automatically sent to spam.`,
      });
    }
  };

  // Update handleTranslateClick to accept a message argument
  const handleTranslateClick = (msg: any) => {
    if (msg) {
      let from = msg.sender || msg.from || "";
      let subject = msg.subject || "";
      let date = msg.timestamp
        ? new Date(msg.timestamp).toLocaleDateString()
        : (msg.date ? new Date(msg.date).toLocaleDateString() : "");
      let body = msg.content || msg.parsedText || msg.parsedHtml || "No content available";
      let id = msg.emailUniqueId || msg.sendMail_Id || msg.id || "";
      let mailbox = msg.mailbox || 'inbox';
      if (msg.rawEml) {
        const raw = msg.rawEml;
        const headers: Record<string, string> = {};
        const lines = raw.split(/\r?\n/);
        let currentHeader = '';
        let i = 0;
        for (; i < lines.length; i++) {
          const line = lines[i];
          if (/^[A-Za-z0-9\-]+: /.test(line)) {
            const [key, ...rest] = line.split(': ');
            currentHeader = key.toLowerCase();
            headers[currentHeader] = rest.join(': ');
          } else if ((line.startsWith(' ') || line.startsWith('\t')) && currentHeader) {
            headers[currentHeader] += ' ' + line.trim();
          } else if (line.trim() === '') {
            i++;
            break;
          }
        }
        from = decodeRFC2047(headers['from']) || from;
        subject = decodeRFC2047(headers['subject']) || subject;
        date = headers['date'] || date;
        // Use extracted and decoded plain text part if available
        const extracted = extractPlainTextFromRawEml(raw);
        body = extracted || lines.slice(i).join('\n') || body;
        try {
          localStorage.setItem(`translateRawEml_${id}`, JSON.stringify({ rawEml: raw, from, subject, date, body }));
        } catch (e) { /* ignore quota errors */ }
      } else {
        try {
          localStorage.setItem(`translateRawEml_${id}`, JSON.stringify({ from, subject, date, body }));
        } catch (e) { /* ignore quota errors */ }
      }
      if (id) {
        window.open(`/mailbox/m/${mailId}/${mailbox}/email/${id}/translate`, '_blank');
      }
    }
  };

  const handleDownloadClick = () => {
    if (mainMessage) {
      // Create EML format content
      const emlContent = `Message-ID: <${mainMessage.id}@gmail.com>
Date: ${new Date(mainMessage.timestamp || Date.now()).toUTCString()}
From: ${mainMessage.sender || "Unknown Sender"} <${(
          mainMessage.sender || "unknown"
        )
          .toLowerCase()
          .replace(/\s+/g, ".")}@example.com>
To: ${mainMessage.recipient || "user@gmail.com"}
Subject: ${mainMessage.subject || "No Subject"}
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

${mainMessage.content || "No content available"}

--
This email was downloaded from Gmail Clone
`;

      // Create blob and download
      const blob = new Blob([emlContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Create safe filename
      const safeSubject = (mainMessage.subject || "no_subject")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `email_${safeSubject}_${timestamp}.eml`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Email downloaded",
        description: `Downloaded as ${link.download}`,
      });
    }
  };

  const handleSummaryClick = () => {
    // Using history.push if you use react-router-dom
    window.location.href = `/mailbox/m/${mailId}/${threadId}/summary`;
  };


  const formatDateTime = (timestamp: Date) => {
    const emailDate = new Date(timestamp);
    return emailDate.toLocaleString([], {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const emailDate = new Date(timestamp);
    const diffInMs = now.getTime() - emailDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    const timeString = emailDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // If email is from today
    if (diffInDays === 0) {
      if (diffInMinutes < 60) {
        return `${timeString} (${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""
          } ago)`;
      } else {
        return `${timeString} (${diffInHours} hour${diffInHours !== 1 ? "s" : ""
          } ago)`;
      }
    }
    // If email is from yesterday
    else if (diffInDays === 1) {
      return `${timeString} (yesterday)`;
    }
    // If email is older than yesterday
    else {
      return emailDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year:
          emailDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // After conversationData is available:
  // Replace expandedIdx logic with multi-expand logic:
  const [expandedSet, setExpandedSet] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    if (Array.isArray(conversationData) && conversationData.length > 0) {
      setExpandedSet(new Set([conversationData.length - 1]));
    }
  }, [conversationData]);

  // Add at the top of the component:
  const [detailsDropdownSet, setDetailsDropdownSet] = useState<Set<number>>(new Set());

  // For the main ShowMoreMenuDropdown (not the label submenu):
  // Add state for dropdown position
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);

  const handleMoreMenuClick = () => {
    if (moreMenuButtonRef.current) {
      const rect = moreMenuButtonRef.current.getBoundingClientRect();
      let top = rect.bottom;
      let left = rect.left;
      const dropdownHeight = 400; // estimate
      if (top + dropdownHeight > window.innerHeight) {
        top = Math.max(window.innerHeight - dropdownHeight - 16, 8);
      }
      setDropdownPosition({ top, left });
    }
    setShowMoreMenu((prev) => !prev);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  if (!mainMessage) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-foreground font-medium text-lg">
            Email not found
          </div>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render the conversation thread
  return (
    <>
      <div className="flex-1 flex flex-col bg-background h-full max-h-full relative z-0">
        {/* Header - Gmail Style Toolbar */}
        <div className="border-b bg-white dark:bg-black relative z-10">
          <div className="mx-auto py-2 md:py-[8px]">
            <div className="flex items-center gap-1 md:gap-2 overflow-x-auto px-2 lg:px-0">
              <button
                onClick={onBack}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Back to inbox"
              >
                <ArrowLeft className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleArchiveClick}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Archive"
              >
                <Archive className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleReportSpam}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Report spam"
              >
                <Flag className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>

              <button
                onClick={handleDeleteClick}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Delete"
                disabled={updateEmailAttributesMutation.isPending}
              >
                <Trash2
                  className={`w-3 h-3 md:w-4 md:h-4 ${updateEmailAttributesMutation.isPending
                    ? "text-gray-400"
                    : "text-muted-foreground"
                    }`}
                />
              </button>

              <div className="w-px h-4 md:h-6 bg-gray-600 mx-1 hidden sm:block"></div>

              <button
                onClick={handleMarkAsUnread}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0 hidden sm:flex"
                title="Mark as unread"
              >
                <Mail className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => handleStarClick(mainMessage)}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title={mainMessage?.isStarred ? "Remove star" : "Add star"}
              >
                <Star
                  className={`w-3 h-3 md:w-4 md:h-4 ${mainMessage?.isStarred
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                    }`}
                />
              </button>

              <button
                onClick={handleSummaryClick}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title="Show conversation summary"
              >
                <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </button>


              <div className="flex-1" />

              <div className="relative" >
                <button
                  onClick={handleMoreMenuClick}
                  ref={moreMenuButtonRef}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>

                {showMoreMenu && typeof emailUniqueId === 'string' && (
                  <ShowMoreMenuDropdown
                    open={showMoreMenu}
                    onClose={() => setShowMoreMenu(false)}
                    handleSnoozeClick={handleSnoozeClick}
                    handleAddToTasksClick={handleAddToTasksClick}
                    handleLabelSelect={(labelUniqueId: string) => handleLabelSelect(labelUniqueId, mainMessage)}
                    handleCreateLabel={handleCreateLabel}
                    handleMuteClick={handleMuteClick}
                    handlePrintClick={handlePrintClick}
                    handleBlockClick={handleBlockClick}
                    handleTranslateClick={(msg: any) => handleTranslateClick(msg)}
                    handleDownloadClick={handleDownloadClick}
                    labelSearchQuery={labelSearchQuery}
                    setLabelSearchQuery={setLabelSearchQuery}
                    labelsLoading={labelsLoading}
                    apiLabels={apiLabels}
                    assignLabelsMutation={assignLabelsMutation}
                    removeLabelsMutation={removeLabelsMutation}
                    showCreateLabel={showCreateLabel}
                    setShowCreateLabel={setShowCreateLabel}
                    newLabelName={newLabelName}
                    setNewLabelName={setNewLabelName}
                    createLabelMutation={createLabelMutation}
                    onOpenFilters={onOpenFilters}
                    setShowOriginalModal={setShowOriginalModal}
                    mailId={mailId}
                    mainMessage={mainMessage}
                    emailUniqueId={emailUniqueId}
                    sendMail_Id={mainMessage.sendMail_Id}
                  />
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Email Content */}
        <div className="flex flex-col h-full min-h-0" id="printable-email">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="mx-auto">
              {/* Subject max-w-4xl */}
              <div className="mb-4 mt-4">
                <h1 className="text-2xl font-medium text-foreground">
                  {mainMessage.subject}
                </h1>
              </div>
              {/* Render all messages in the conversation */}
              {conversationData.map((msg: any, idx: number) => {
                // Debug log for parsedHeaders
                console.log('DEBUG parsedHeaders', msg.parsedHeaders);
                console.log('DEBUG parsedHeaders.from', msg.parsedHeaders?.from);
                console.log('DEBUG msg.from', msg.from);
                console.log('DEBUG msg.mailedby', msg.mailedby);
                console.log('DEBUG msg.signedby', msg.signedby);
                const isExpanded = expandedSet.has(idx);
                const isDropdownOpen = detailsDropdownSet.has(idx);
                // Compute fromDisplay for dropdown
                const fromObj = msg.parsedHeaders?.from?.value?.[0];
                const fromDisplay = fromObj
                  ? (fromObj.name ? `${fromObj.name} <${fromObj.address}>` : fromObj.address)
                  : msg.from;
                return (
                  <div key={msg.id + msg.date} className="mb-8 pb-4 border-b border-border last:border-b-0">
                    {/* Header (always visible, clickable, styled like before) */}
                    <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => {
                        setExpandedSet(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}>
                        <div className="w-8 h-8 bg-[#ffa184] rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {getAvatarLetter(msg.from, msg.sender)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">
                            <span className="text-muted-foreground">from </span>
                            {getDisplayName(msg.from, msg.from || msg.sender)}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <span className="text-muted-foreground">to </span>
                            {msg.to}
                            {/* Three-dot menu for dropdown, beside 'to' */}
                            <button className="ml-1" onClick={e => {
                              e.stopPropagation(); setLabelTargetMessage(msg); setShowMoreMenuIdx(idx); setDetailsDropdownSet(prev => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              });
                            }}>
                              <MoreHorizontal className="w-5 h-5 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="text-sm text-muted-foreground hidden sm:block">
                          {msg.date ? formatRelativeTime(new Date(msg.date)) : "Unknown date"}
                        </div>
                        <div className="text-xs text-muted-foreground sm:hidden">
                          {msg.date ? formatRelativeTime(new Date(msg.date)) : "Unknown"}
                        </div>
                        {/* Star button for idx > 0 */}
                        {idx > 0 && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleStarClick(msg);
                            }}
                            className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                            title={msg.isStarred ? "Remove star" : "Add star"}
                          >
                            <Star
                              className={`w-3 h-3 md:w-4 md:h-4 ${msg.isStarred
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                                }`}
                            />
                          </button>
                        )}
                        {/* Expand/collapse chevron */}
                        <button className="ml-2" onClick={e => {
                          e.stopPropagation(); setExpandedSet(prev => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                          });
                        }}>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>
                        {/* Only show three-dot menu in header for idx > 0 */}
                        {idx > 0 && (
                          <div className="relative">
                            <button className="ml-1" onClick={e => { e.stopPropagation(); setShowMoreMenuIdx(prev => prev === idx ? null : idx); }}>
                              <MoreVertical className="w-5 h-5 text-gray-500" />
                            </button>
                            {showMoreMenuIdx === idx && (
                              <ShowMoreMenuDropdown
                                key={msg.emailUniqueId || msg.sendMail_Id || idx}
                                open={showMoreMenuIdx === idx}
                                onClose={() => setShowMoreMenuIdx(null)}
                                handleSnoozeClick={handleSnoozeClick}
                                handleAddToTasksClick={handleAddToTasksClick}
                                handleLabelSelect={(labelUniqueId: string) => handleLabelSelect(labelUniqueId, msg)}
                                handleCreateLabel={handleCreateLabel}
                                handleMuteClick={handleMuteClick}
                                handlePrintClick={handlePrintClick}
                                handleBlockClick={handleBlockClick}
                                handleTranslateClick={(msg: any) => handleTranslateClick(msg)}
                                handleDownloadClick={handleDownloadClick}
                                labelSearchQuery={labelSearchQuery}
                                setLabelSearchQuery={setLabelSearchQuery}
                                labelsLoading={labelsLoading}
                                apiLabels={apiLabels}
                                assignLabelsMutation={assignLabelsMutation}
                                removeLabelsMutation={removeLabelsMutation}
                                showCreateLabel={showCreateLabel}
                                setShowCreateLabel={setShowCreateLabel}
                                newLabelName={newLabelName}
                                setNewLabelName={setNewLabelName}
                                createLabelMutation={createLabelMutation}
                                onOpenFilters={onOpenFilters}
                                setShowOriginalModal={setShowOriginalModal}
                                mailId={mailId}
                                mainMessage={msg}
                                emailUniqueId={msg.emailUniqueId || msg.id || ""}
                                sendMail_Id={msg.sendMail_Id}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Dropdown with details: for idx === 0, show if open from toolbar; for others, from header */}
                    {isDropdownOpen && (
                      <div className="bg-gray-50 border-l border-r border-b border-gray-100 rounded p-4 mb-2 text-sm">
                        <div><b className="text-muted-foreground">from:</b> {fromDisplay}</div>
                        <div><b className="text-muted-foreground">to:</b> {msg.to}</div>
                        <div><b className="text-muted-foreground">date:</b> {msg.date ? new Date(msg.date).toLocaleString() : ""}</div>
                        <div><b className="text-muted-foreground">subject:</b> {msg.subject}</div>
                        {msg.mailedby && <div><b className="text-muted-foreground">mailed-by:</b> {msg.mailedby}</div>}
                        {msg.signedby && <div><b className="text-muted-foreground">signed-by:</b> {msg.signedby}</div>}
                        {/* Add security, importance, etc. as needed */}
                      </div>
                    )}
                    {/* Body (only if expanded) */}
                    {isExpanded && (
                      <div className="max-w-none text-foreground leading-relaxed text-base email-body px-2 py-4">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: msg.parsedHtml || msg.content || msg.parsedText || "",
                          }}
                        />
                        {/* Attachments, etc. can go here */}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Footer always at the bottom of the email details area */}
          <div className="border-t bg-white dark:bg-black z-10">
            <div className="mx-auto px-2 lg:px-2 py-2 flex gap-2 justify-start">
              <button
                onClick={handleReplyClick}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#ffa184] hover:bg-[#fd9474] text-white rounded transition-colors"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
              <button
                onClick={handleReplyAllClick}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <ReplyAll className="w-3 h-3" />
                Reply all
              </button>
              <button
                onClick={handleForwardClick}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <Forward className="w-3 h-3" />
                Forward
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAttachmentModal && modalAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black bg-opacity-70">
          <div className="bg-white dark:bg-black rounded-lg border p-4 max-w-full max-h-full flex flex-col items-center">
            {modalAttachment.contentType.startsWith("image/") ? (
              <img
                src={`data:${modalAttachment.contentType};base64,${modalAttachment.content}`}
                alt={modalAttachment.filename}
                style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 8 }}
              />
            ) : modalAttachment.contentType.startsWith("video/") ? (
              <video
                src={`data:${modalAttachment.contentType};base64,${modalAttachment.content}`}
                controls
                style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 8 }}
              />
            ) : null}
            <button
              className="mt-4 px-4 py-2 bg-[#ffa184] text-white rounded hover:bg-[#ff8c69]"
              onClick={() => setShowAttachmentModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

