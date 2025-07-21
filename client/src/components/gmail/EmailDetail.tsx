import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";
import linkifyHtml from 'linkify-html';

interface EmailDetailProps {
  mailId: string;
  emailUniqueId: string | null;
  onBack: () => void;
  onOpenFilters?: () => void;
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

export default function EmailDetail({
  mailId,
  emailUniqueId,
  onBack,
  onOpenFilters,
}: EmailDetailProps) {
  console.log('DEBUG: EmailDetail props', { mailId, emailUniqueId });
  const [hasMarkedAsRead, setHasMarkedAsRead] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const [showLabelSubmenu, setShowLabelSubmenu] = React.useState(false);
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

  // Fetch email's assigned labels using the new backend endpoint
  const { data: emailLabelsData, isLoading: emailLabelsLoading } = useQuery({
    queryKey: ["/email/getEmailLabels", emailUniqueId],
    queryFn: async () => {
      if (!emailUniqueId) return { labels: [] };
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/email/getEmailLabels", {
        emailUniqueId,
        __headers: headers,
      });
      console.log('DEBUG: Email labels API response:', response.data);
      return response.data;
    },
    enabled: !!emailUniqueId,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Use apiRequest from '@/lib/queryClient' and useQuery for fetching email details
  const { data: emailDetail, isLoading, refetch } = useQuery({
    queryKey: ["/mails/getMailDetailFromStorage", mailId, emailUniqueId],
    queryFn: async () => {
      console.log('DEBUG: Fetching email detail', { mailId, emailUniqueId });
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest(
        "POST",
        "/mails/getMailDetailFromStorage",
        {
          mail_id: mailId,
          emailUniqueId,
          __headers: headers,
        }
      );
      console.log('DEBUG: Email detail API response', response.data);
      console.log('DEBUG: Email labels from API:', response.data?.labels);
      return response.data;
    },
    enabled: !!mailId && !!emailUniqueId,
    refetchOnMount: true, // Force refetch when component mounts
    staleTime: 0, // Consider data stale immediately
  });

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
      queryClient.invalidateQueries({
        predicate: (query) => {
          const firstKey = query.queryKey[0];
          return (
            typeof firstKey === "string" && firstKey.startsWith("/api/emails")
          );
        },
      });
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
    mutationFn: async ({ labelUniqueId, emailUniqueId }: { labelUniqueId: string; emailUniqueId: string }) => {
      console.log('DEBUG: Calling assignLabelsToEmail API with:', { labelUniqueId, emailUniqueId, mailId });
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/email/assignLabelsToEmail", {
        labelUniqueId,
        emailUniqueId,
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
        queryKey: ["/email/getEmailLabels", emailUniqueId] 
      });
      // Invalidate email detail query to refresh the email data
      queryClient.invalidateQueries({ 
        queryKey: ["/mails/getMailDetailFromStorage", mailId, emailUniqueId] 
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
    mutationFn: async ({ labelUniqueId, emailUniqueId }: { labelUniqueId: string; emailUniqueId: string }) => {
      console.log('DEBUG: Calling removeLabelsFromEmail API with:', { labelUniqueId, emailUniqueId, mailId });
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/email/removeLabelsFromEmail", {
        labelUniqueId,
        emailUniqueId,
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
        queryKey: ["/email/getEmailLabels", emailUniqueId] 
      });
      // Invalidate email detail query to refresh the email data
      queryClient.invalidateQueries({ 
        queryKey: ["/mails/getMailDetailFromStorage", mailId, emailUniqueId] 
      });
      // Also invalidate labels query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/label/getLabels", mailId] });
    },
    onError: (err) => {
      console.error('DEBUG: removeLabelsMutation onError:', err);
      toast({ title: "Error", description: "Failed to remove labels", variant: "destructive" });
    }
  });

  // Initialize selectedLabels when email labels or available labels data changes
  React.useEffect(() => {
    console.log('DEBUG: Initializing selectedLabels', { emailLabelsData, apiLabels });
    if (emailLabelsData && Array.isArray(apiLabels) && apiLabels.length > 0) {
      const emailLabels = emailLabelsData.labels || [];
      console.log('DEBUG: Email labels from API:', emailLabels);
      console.log('DEBUG: Available API labels:', apiLabels);
      
      // Map the email's assigned labels to their labelUniqueIds
      const selectedLabelIds = emailLabels.map((emailLabel: any) => emailLabel.labelUniqueId);
      
      console.log('DEBUG: Final selected label IDs:', selectedLabelIds);
      setSelectedLabels(selectedLabelIds);
    } else {
      console.log('DEBUG: No email labels or API labels available');
      setSelectedLabels([]);
    }
  }, [emailLabelsData, apiLabels]);

  // Mark email as seen when opened (only once)
  React.useEffect(() => {
    console.log('DEBUG: Effect run', {
      emailDetail,
      isUnread: emailDetail?.isUnread,
      hasMarkedAsRead,
      emailUniqueId
    });
    if (emailDetail && emailDetail.isUnread && !hasMarkedAsRead && emailUniqueId) {
      console.log('DEBUG: About to call updateEmailAttributesMutation.mutate', { emailUniqueId });
      setHasMarkedAsRead(true);
      updateEmailAttributesMutation.mutate({
        emailUniqueId,
        seen: true,
      });
    }
  }, [emailDetail?.isUnread, hasMarkedAsRead, updateEmailAttributesMutation, emailUniqueId]);

  // Remove old per-action mutations (starMutation, archiveMutation, spamMutation, taskMutation, muteMutation, snoozeMutation, deleteMutation, importantMutation)

  // Handlers using the new mutation:
  const handleStarClick = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isStarred: !emailDetail.isStarred,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
    }
  };

  const handleArchiveClick = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isArchived: !emailDetail.isArchived,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
      toast({
        title: !emailDetail.isArchived ? "Email archived" : "Email unarchived",
        description: !emailDetail.isArchived ? "The email has been moved to archive." : "The email has been removed from archive.",
      });
      onBack();
    }
  };

  const handleReportSpam = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isSpam: !emailDetail.isSpam,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
      toast({
        title: !emailDetail.isSpam ? "Reported as spam" : "Removed from spam",
        description: !emailDetail.isSpam ? "The email has been moved to spam." : "The email has been removed from spam.",
      });
      onBack();
    }
  };

  const handleDeleteClick = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isTrash: !emailDetail.isTrash,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
      toast({
        title: !emailDetail.isTrash ? "Email deleted" : "Email restored",
        description: !emailDetail.isTrash ? "The email has been moved to trash." : "The email has been restored from trash.",
      });
      onBack();
    }
  };

  const handleMarkAsUnread = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate({
        emailUniqueId,
        seen: false,
      });
      toast({
        title: "Marked as unread",
        description: "The email has been marked as unread.",
      });
    }
  };

  const handleSnoozeClick = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isSnoozed: !emailDetail.isSnoozed,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
      toast({
        title: !emailDetail.isSnoozed ? "Email snoozed" : "Snooze removed",
        description: !emailDetail.isSnoozed ? "Email has been snoozed." : "Snooze removed from email.",
      });
      onBack();
    }
  };

  const handleAddToTasksClick = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isAddToTask: !emailDetail.isAddToTask,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
      toast({
        title: !emailDetail.isAddToTask ? "Added to Tasks" : "Removed from Tasks",
        description: !emailDetail.isAddToTask ? "Email has been added to your Tasks." : "Email has been removed from your Tasks.",
      });
    }
  };

  const handleMuteClick = () => {
    if (emailDetail && emailUniqueId) {
      updateEmailAttributesMutation.mutate(
        {
          emailUniqueId,
          isMute: !emailDetail.isMute,
        },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
      toast({
        title: !emailDetail.isMute ? "Conversation muted" : "Conversation unmuted",
        description: !emailDetail.isMute ? "You won't be notified of new messages in this conversation." : "You will be notified of new messages in this conversation.",
      });
    }
  };

  const handleLabelSelect = async (labelUniqueId: string) => {
    console.log('handleLabelSelect called', { labelUniqueId, emailDetail, selectedLabels });
    console.log('emailDetail.emailUniqueId:', emailDetail?.emailUniqueId);
    
    const isCurrentlySelected = selectedLabels.includes(labelUniqueId);
    console.log('DEBUG: Label currently selected:', isCurrentlySelected);
    
    // Don't update local state immediately - wait for API response
    if (emailUniqueId) {
      if (isCurrentlySelected) {
        // Label is currently selected, so remove it
        console.log('Removing label:', labelUniqueId, 'from email:', emailUniqueId);
        removeLabelsMutation.mutate({
          labelUniqueId,
          emailUniqueId,
        });
      } else {
        // Label is not selected, so add it
        console.log('Adding label:', labelUniqueId, 'to email:', emailUniqueId);
        assignLabelsMutation.mutate({
          labelUniqueId,
          emailUniqueId,
        });
      }
    } else {
      console.log('No emailUniqueId found (prop):', emailUniqueId);
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
    if (emailDetail) {
      // Extract sender email address
      const senderEmail =
        emailDetail.sender?.match(/<(.+)>/)?.[1] || emailDetail.sender || "";

      // Create reply context with "Replying to message" text
      const replyContext = {
        to: senderEmail,
        subject: emailDetail.subject?.startsWith("Re:")
          ? emailDetail.subject
          : `Re: ${emailDetail.subject}`,
        body: `\n\nReplying to message:\n\n--- Original Message ---\nFrom: ${
          emailDetail.sender
        }\nDate: ${
          emailDetail.timestamp
            ? new Date(emailDetail.timestamp).toLocaleString()
            : "Unknown date"
        }\nSubject: ${emailDetail.subject}\n\n${emailDetail.content}`,
        isReply: true,
        originalEmailId: emailDetail.id,
      };

      // Dispatch custom event to open compose modal with reply context
      window.dispatchEvent(
        new CustomEvent("openComposeWithContext", {
          detail: replyContext,
        })
      );
    }
  };

  const handleReplyAllClick = () => {
    if (emailDetail) {
      // Extract sender email address
      const senderEmail =
        emailDetail.sender?.match(/<(.+)>/)?.[1] || emailDetail.sender || "";

      // For reply all, we'd typically include CC recipients as well
      // Since we don't have CC info in the current email schema, we'll just reply to sender
      const replyAllContext = {
        to: senderEmail,
        subject: emailDetail.subject?.startsWith("Re:")
          ? emailDetail.subject
          : `Re: ${emailDetail.subject}`,
        body: `\n\nReplying to message:\n\n--- Original Message ---\nFrom: ${
          emailDetail.sender
        }\nDate: ${
          emailDetail.timestamp
            ? new Date(emailDetail.timestamp).toLocaleString()
            : "Unknown date"
        }\nSubject: ${emailDetail.subject}\n\n${emailDetail.content}`,
        isReplyAll: true,
        originalEmailId: emailDetail.id,
      };

      // Dispatch custom event to open compose modal with reply all context
      window.dispatchEvent(
        new CustomEvent("openComposeWithContext", {
          detail: replyAllContext,
        })
      );
    }
  };

  const handleForwardClick = () => {
    if (emailDetail) {
      // Create forward context with original message content
      const forwardContext = {
        to: "",
        subject: emailDetail.subject?.startsWith("Fwd:")
          ? emailDetail.subject
          : `Fwd: ${emailDetail.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${
          emailDetail.sender
        }\nDate: ${
          emailDetail.timestamp
            ? new Date(emailDetail.timestamp).toLocaleString()
            : "Unknown date"
        }\nSubject: ${emailDetail.subject}\nTo: ${emailDetail.recipient}\n\n${
          emailDetail.content
        }`,
        isForward: true,
        originalEmailId: emailDetail.id,
      };

      // Dispatch custom event to open compose modal with forward context
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
    if (emailDetail) {
      toast({
        title: "Sender blocked",
        description: `${emailDetail.sender} has been blocked. Future emails will be automatically sent to spam.`,
      });
    }
  };

  const handleTranslateClick = () => {
    if (emailDetail) {
      // Create a simple translation interface
      const content = emailDetail.content || "No content available";
      const translationWindow = window.open(
        "",
        "_blank",
        "width=800,height=600"
      );

      if (translationWindow) {
        translationWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Translate Email - ${emailDetail.subject}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
              .container { max-width: 800px; margin: 0 auto; }
              .email-header { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
              .email-content { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px; }
              .translate-section { background: #e3f2fd; padding: 15px; border-radius: 5px; }
              select, button { padding: 8px 12px; margin: 5px; font-size: 14px; }
              button { background: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer; }
              button:hover { background: #1565c0; }
              .translated-content { background: #f9f9f9; padding: 15px; margin-top: 10px; border-radius: 5px; border-left: 4px solid #4caf50; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Email Translation</h2>
              <div class="email-header">
                <strong>From:</strong> ${emailDetail.sender}<br>
                <strong>Subject:</strong> ${emailDetail.subject}<br>
                <strong>Date:</strong> ${new Date(
                  emailDetail.timestamp || Date.now()
                ).toLocaleDateString()}
              </div>
              
              <div class="email-content">
                <h4>Original Message:</h4>
                <p>${content}</p>
              </div>
              
              <div class="translate-section">
                <h4>Translation Options:</h4>
                <label for="targetLang">Translate to: </label>
                <select id="targetLang">
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese (Simplified)</option>
                  <option value="ar">Arabic</option>
                </select>
                <button onclick="translateText()">Translate</button>
                <button onclick="window.close()">Close</button>
                
                <div id="translatedResult" class="translated-content" style="display: none;">
                  <h4>Translated Message:</h4>
                  <div id="translatedText"></div>
                  <small><em>Note: This is a simulated translation. For real translation, integrate with Google Translate API or similar service.</em></small>
                </div>
              </div>
            </div>
            
            <script>
              function translateText() {
                const targetLang = document.getElementById('targetLang').value;
                const langNames = {
                  es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
                  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean',
                  zh: 'Chinese', ar: 'Arabic'
                };
                
                // Simulate translation (in real app, this would call translation API)
                const originalText = \`${content.replace(/`/g, "\\`")}\`;
                const simulatedTranslation = \`[Translated to \${langNames[targetLang]}] \${originalText}\`;
                
                document.getElementById('translatedText').innerHTML = simulatedTranslation;
                document.getElementById('translatedResult').style.display = 'block';
              }
            </script>
          </body>
          </html>
        `);

        toast({
          title: "Translation window opened",
          description: "Translation interface opened in a new window.",
        });
      }
    }
  };

  const handleDownloadClick = () => {
    if (emailDetail) {
      // Create EML format content
      const emlContent = `Message-ID: <${emailDetail.id}@gmail.com>
Date: ${new Date(emailDetail.timestamp || Date.now()).toUTCString()}
From: ${emailDetail.sender || "Unknown Sender"} <${(
        emailDetail.sender || "unknown"
      )
        .toLowerCase()
        .replace(/\s+/g, ".")}@example.com>
To: ${emailDetail.recipient || "user@gmail.com"}
Subject: ${emailDetail.subject || "No Subject"}
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

${emailDetail.content || "No content available"}

--
This email was downloaded from Gmail Clone
`;

      // Create blob and download
      const blob = new Blob([emlContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Create safe filename
      const safeSubject = (emailDetail.subject || "no_subject")
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
        return `${timeString} (${diffInMinutes} minute${
          diffInMinutes !== 1 ? "s" : ""
        } ago)`;
      } else {
        return `${timeString} (${diffInHours} hour${
          diffInHours !== 1 ? "s" : ""
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mb-4 mx-auto animate-pulse">
            <svg
              className="w-4 h-4 text-primary-foreground"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </div>
          <div className="text-muted-foreground font-medium">
            Loading email...
          </div>
        </div>
      </div>
    );
  }

  if (!emailDetail) {
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

  const linkifyOptions = {
    // Ensures links like www.example.com are converted to https://www.example.com
    defaultProtocol: 'https',
    target: {
      url: '_blank'
    }
  };

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
                  className={`w-3 h-3 md:w-4 md:h-4 ${
                    updateEmailAttributesMutation.isPending
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
                onClick={handleStarClick}
                className="p-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
                title={emailDetail?.isStarred ? "Remove star" : "Add star"}
              >
                <Star
                  className={`w-3 h-3 md:w-4 md:h-4 ${
                    emailDetail?.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>

              <div className="flex-1" />

              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>

                {showMoreMenu && (
                  <div className="fixed md:right-16 right-6 top-25 w-64 bg-white dark:bg-black border rounded-lg shadow-lg z-[9999]">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          handleSnoozeClick();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <Clock className="w-4 h-4" />
                        Snooze
                      </button>

                      <button
                        onClick={() => {
                          handleAddToTasksClick();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <CheckSquare className="w-4 h-4" />
                        Add to Tasks
                      </button>

                      <button
                        onClick={() => setShowMoreMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Create event
                      </button>

                      <hr className="my-2" />

                      <div
                        className="relative"
                        onMouseEnter={() => setShowLabelSubmenu(true)}
                        onMouseLeave={() => setShowLabelSubmenu(false)}
                      >
                        <button className="w-full flex items-center justify-between px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors">
                          <div className="flex items-center gap-3 dark:text-white hover:bg-accent">
                            <Tag className="w-4 h-4" />
                            Label as
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        {showLabelSubmenu && (
                          <div className="absolute sm:fixed sm:right-72 sm:top-20 left-0 sm:left-auto mt-2 sm:mt-0 w-64 bg-white dark:bg-black border rounded-lg shadow-lg z-[10000]">
                            <div className="p-3">
                              <div className="text-sm font-medium dark:text-white mb-2">
                                Label as:
                              </div>
                              {/* Search bar */}
                              <div className="">
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
                              {/* Label options */}
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
                                    console.log('Rendering label:', label, 'isChecked:', isChecked, 'selectedLabels:', selectedLabels);
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
                                          onChange={() => {
                                            console.log('Checkbox changed for label', label.labelUniqueId, 'current checked state:', isChecked);
                                            handleLabelSelect(label.labelUniqueId);
                                          }}
                                        />
                                        <span className="text-sm dark:text-white">
                                          {label.name}
                                        </span>
                                      </label>
                                    );
                                  })}
                              </div>
                              {/* Action buttons */}
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
                                      onChange={(e) =>
                                        setNewLabelName(e.target.value)
                                      }
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
                                          ? "Creating..."
                                          : "Create"}
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
                                    setShowMoreMenu(false);
                                    // Create and dispatch a custom event to open settings with Labels tab
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
                          setShowMoreMenu(false);
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
                          setShowMoreMenu(false);
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
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>

                      <button
                        onClick={() => {
                          handleBlockClick();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        Block sender
                      </button>

                      <button
                        onClick={() => {
                          handleTranslateClick();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <Languages className="w-4 h-4" />
                        Translate message
                      </button>

                      <button
                        onClick={() => {
                          handleDownloadClick();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download message
                      </button>
                      <button
                        onClick={() => {
                          setShowOriginalModal(true);
                          setShowMoreMenu(false);
                          window.open(`/mailbox/m/${mailId}/${emailDetail?.mailbox || 'inbox'}/email/${emailUniqueId}/original`, '_blank');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm dark:text-white hover:bg-accent transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Show original
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


      {/* Email Content */}
      <div id="printable-email" className="flex-1 overflow-y-auto px-6 pb-16">
        <div className="mx-auto">
          {/* Subject max-w-4xl */}
          <div className="mb-4 mt-4">
            <h1 className="text-2xl font-medium text-foreground">
              {emailDetail.subject}
            </h1>
          </div>

          {/* Email Header */}
          <div className="border rounded-lg mb-6">
            {/* Collapsed Header */}
            <div
              className="flex items-center justify-between p-4 hover:bg-accent cursor-pointer"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 bg-[#ffa184] rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                  {getAvatarLetter(emailDetail.from, emailDetail.sender)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">
                    <span className="text-muted-foreground">from </span>
                    {(
                      getDisplayName(
                        emailDetail.from,
                        emailDetail.from || emailDetail.sender
                      ) || ""
                    ).replace(/["']/g, "")}
                  </div>
                  {/* <div className="text-sm text-muted-foreground">
                    <span className="text-muted-foreground">to </span>
                    {emailDetail.to}
                  </div> */}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <div className="text-sm text-muted-foreground hidden sm:block">
                  {emailDetail.date
                    ? formatRelativeTime(new Date(emailDetail.date))
                    : "Unknown date"}
                </div>
                <div className="text-xs text-muted-foreground sm:hidden">
                  {emailDetail.date
                    ? formatRelativeTime(new Date(emailDetail.date))
                    : "Unknown"}
                </div>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            {/* Expanded Details */}
            {showDetails && (
              <div className="px-4 pb-4 border-t bg-accent pt-2">
                <div className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-sm">
                  {/* Only show important headers */}
                  {emailDetail.headers &&
                    Object.entries(emailDetail.headers)
                      .filter(([key]) =>
                        [
                          "from",
                          "date",
                          "subject",
                          "to",
                          "content-type",
                          "reply-to",
                          "security",
                          "mailed-by",
                          "signed-by",
                        ].includes(key.toLowerCase())
                      )
                      .map(([key, value]) => (
                        <React.Fragment key={key}>
                          <div className="text-muted-foreground font-medium">
                            {key}:
                          </div>
                          <div className="text-foreground break-all">
                            {Array.isArray((value as any)?.value)
                              ? (value as any).value
                                  .map((v: any) => v.address || v.name)
                                  .join(", ")
                              : typeof value === "object" &&
                                value &&
                                Array.isArray(value as any)
                              ? (value as any).join(", ")
                              : String((value as any)?.value || value)}
                          </div>
                        </React.Fragment>
                      ))}
                  {emailDetail.mailedby && (
                    <React.Fragment key="mailedBy">
                      <div className="text-muted-foreground font-medium">
                        mailed-by:
                      </div>
                      <div className="text-foreground break-all">
                        {emailDetail.mailedby}
                      </div>
                    </React.Fragment>
                  )}
                  {emailDetail.signedby && (
                    <React.Fragment key="signedBy">
                      <div className="text-muted-foreground font-medium">
                        signed-by:
                      </div>
                      <div className="text-foreground break-all">
                        {emailDetail.signedby}
                      </div>
                    </React.Fragment>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Email Body (HTML preferred, fallback to text) */}
          {emailDetail.html ? (
            <div className="max-w-none text-foreground leading-relaxed text-base">
              <div
                dangerouslySetInnerHTML={{
                  __html: fixLinksInHtml(cleanEmailHtml(emailDetail.html)),
                }}
              />
            </div>
          ) : (
            <div className="max-w-none text-foreground leading-relaxed text-base">
              <div
                dangerouslySetInnerHTML={{
                  __html: linkifyHtml(
                    preprocessLinks(
                      (emailDetail.text || '')
                        // Collapse 3+ newlines to 2
                        .replace(/\n{3,}/g, '\n\n')
                        // Convert newlines to <br>
                        .replace(/\n/g, '<br>')
                    ),
                    linkifyOptions
                  ),
                }}
              />
            </div>
          )}

          {/* Attachments */}
          {emailDetail.attachments && emailDetail.attachments.length > 0 && (
            <div className="mt-6 p-4 border rounded-lg bg-accent w-full sm:w-1/2 md:w-1/3 lg:w-1/4 max-w-xs">
              <h3 className="text-sm font-medium dark:text-white mb-3">
                Attachments ({emailDetail.attachments.length})
              </h3>
              <div className="space-y-2">
                {emailDetail.attachments.map(
                  (attachment: any, index: number) => {
                    const isImage =
                      attachment.contentType &&
                      attachment.contentType.startsWith("image/");
                    const isVideo =
                      attachment.contentType &&
                      attachment.contentType.startsWith("video/");
                    const handleAttachmentClick = () => {
                      if (isImage || isVideo) {
                        setModalAttachment(attachment);
                        setShowAttachmentModal(true);
                      }
                    };
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 bg-white dark:bg-black rounded border hover:bg-gray-50 cursor-pointer"
                        onClick={handleAttachmentClick}
                      >
                        <div className="w-8 h-8 bg-[#ffa184] rounded flex items-center justify-center">
                          📎
                        </div>
                        <div className="flex-1">
                          <div
                            className="text-sm font-medium dark:text-white overflow-hidden whitespace-nowrap text-ellipsis max-w-[220px] block"
                            title={attachment.filename}
                          >
                            {attachment.filename}
                          </div>
                          <div className="text-xs text-gray-500">
                            {attachment.size
                              ? `${(attachment.size / 1024).toFixed(1)} KB`
                              : ""}
                          </div>
                          <a
                            href={`data:${attachment.contentType};base64,${attachment.content}`}
                            download={attachment.filename}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ffa184] underline text-xs block mt-1"
                            onClick={(e) => e.stopPropagation()} // Prevent modal from opening when clicking download
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - Fixed within email container max-w-4xl */}
      <div className="absolute bottom-0 left-0 right-0 border-t bg-white dark:bg-black z-10">
        <div className="mx-auto px-2 lg:px-2 py-2">
          <div className="flex gap-2">
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
