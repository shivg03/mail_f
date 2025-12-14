import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, updateConversationMessages } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/TranslationContext";
import LeftSidebar from "@/components/gmail/LeftSidebar";
import TopNavbar from "@/components/gmail/TopNavbar";
import RightSidebar from "@/components/gmail/RightSidebar";
import EmailToolbar from "@/components/gmail/EmailToolbar";
import EmailList from "@/components/gmail/EmailList";
import EmailDetail from "@/components/gmail/EmailDetail";
import VirtualKeyboard from "@/components/gmail/VirtualKeyboard";
import ComposeModal from "@/components/gmail/ComposeModal";
import Settings from "@/components/gmail/Settings";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { BuildAliasTable } from "drizzle-orm/mysql-core";
import Loader from "@/components/ui/Loader";
import { CloudFog } from "lucide-react";
import SendStatusBar from "@/components/gmail/SendStatusBar"; // If you want to move it to its own file, or keep inline
import { jwtDecode } from "jwt-decode";
import { useIsFetching } from "@tanstack/react-query";

// Update the Email type/interface to include all filter properties
// If you have an interface or type Email, update it like this:
export type Email = {
  id: number;
  sender: string;
  recipient: string;
  to?: string;
  subject: string;
  content: string;
  isRead: boolean | null;
  isStarred: boolean | null;
  isImportant: boolean | null;
  isSnoozed: boolean | null;
  isAddToTask: boolean | null;
  isArchived: boolean | null;
  isMute: boolean | null;
  isSpam: boolean | null;
  isTrash: boolean | null;
  isUnread: boolean | null;
  isBlocked: boolean | null;
  emailUniqueId: string;
  preview?: string;
  status?: string;
  timestamp?: string | Date | null;
  sendMail_Id?: string; // <-- add this line
  threadId?: string; // <-- add this line
  date?: string | Date | null; // <-- add this line
  from?: string; // <-- add this line
  html?: string; // <-- add this line
  // ...other fields
};

// Utility function to get the correct payload for updating mail attributes
function getMailUpdatePayload(message: Email, updates: any) {
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
    console.log("decoded", decoded.userEmail);
    return decoded.userEmail || "";
  } catch {
    return "";
  }
}

function invalidateAllRelevantQueries(currentView: string, mailId: string | undefined) {
  console.log("[DEBUG] invalidateAllRelevantQueries called", currentView, mailId);
  queryClient.invalidateQueries({ queryKey: ["/email/allmails"] });
  queryClient.invalidateQueries({ queryKey: ["/mails/get-sendmail"] });
  queryClient.invalidateQueries({ queryKey: ["/email/getEmailsByLabel"] });
  if (currentView === "sent" || currentView === "drafts" || currentView === "scheduled") {
    queryClient.invalidateQueries({ queryKey: ["/mails/get-sendmail", mailId, currentView] });
  }
  if (currentView && currentView.startsWith("label:")) {
    const labelId = currentView.split(":")[1];
    queryClient.invalidateQueries({ queryKey: ["/email/getEmailsByLabel", labelId] });
  }
  // Debug: log all active query keys
  const allQueries = queryClient.getQueryCache().getAll();
  console.log("[DEBUG] Active React Query keys:", allQueries.map(q => q.queryKey));
}

export default function Mailbox() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  // Support both /email/:emailId and /:tab? routes
  const [matchEmail, paramsEmail] = useRoute(
    "/mailbox/m/:mail_Id/:view/email/:emailId"
  );
  const [match, params] = useRoute("/mailbox/m/:mail_Id/:view/:tab?");
  const mailId = paramsEmail?.mail_Id || params?.mail_Id;
  const urlView = paramsEmail?.view || params?.view || "inbox";
  const urlTab = params?.tab;
  const urlEmailId = paramsEmail?.emailId;
  const { toast } = useToast();
  const [location] = useLocation(); // location is a string
  // Only show session expired toast if user was previously authenticated
  const [checkedAuth, setCheckedAuth] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    window.innerWidth < 768
  );
  const [selectedCategory, setSelectedCategory] = useState("inbox");
  const [currentView, setCurrentView] = useState(urlView);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [emailsPerPage, setEmailsPerPage] = useState(() => {
    const settings = localStorage.getItem("gmailSettings");
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        return parseInt(parsed.conversationsPerPage, 10) || 50;
      } catch {
        return 50;
      }
    }
    return 50;
  });
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(
    urlEmailId ? Number(urlEmailId) : null
  );
  const [selectedEmailUniqueId, setSelectedEmailUniqueId] = useState<
    string | null
  >(null);
  const [selectedEmailFilePath, setSelectedEmailFilePath] = useState<
    string | null
  >(null);
  const [showSettings, setShowSettings] = useState(false);
  const initialTabFromUrl = (() => {
    const match = location && location.match(/settings\/(\w+)/);
    return match ? match[1] : "General";
  })();
  const [settingsTab, setSettingsTab] = useState(initialTabFromUrl);
  const [settingsData, setSettingsData] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false); // Default: shown
  const [searchFilters, setSearchFilters] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<Email[] | null>(null);
  const [labelEmails, setLabelEmails] = useState<{ received: Email[], sent: Email[] } | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [fetchedEmails, setFetchedEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [sentMailId, setSentMailId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [mailboxUserEmail, setMailboxUserEmail] = useState("");

  const updateEmailAttributesMutation = useMutation({
    mutationFn: async (attributes: any) => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      return apiRequest("POST", "/email/updateEmail", {
        ...attributes,
        __headers: headers,
      });
    },
  });

  // Auto-hide the send bar after 5 seconds when sent
  useEffect(() => {
    if (sendStatus === "sent") {
      const timer = setTimeout(() => {
        setSendStatus("idle");
      }, 3000); // 5 seconds
      return () => clearTimeout(timer);
    }
  }, [sendStatus]);

  // Fetch drafts or sent mails from backend when those tabs are selected
  useEffect(() => {
    async function fetchMails() {
      setLoadingEmails(true);
      let status;
      if (currentView === "drafts") status = "draft";
      else if (currentView === "sent") status = "sent";
      else if (currentView === "scheduled") status = "scheduled";
      else status = undefined;

      if (!mailId || !status) {
        setFetchedEmails([]);
        setLoadingEmails(false);
        return;
      }

      try {
        const res = await apiRequest("POST", "/mails/get-sendmail", {
          mail_Id: mailId,
          status,
        });
        console.log("send mail", res.data);
        setFetchedEmails(res.data || []);
      } catch (e) {
        setFetchedEmails([]);
        toast({ title: "Failed to load emails", variant: "destructive" });
      }
      setLoadingEmails(false);
    }
    if (currentView === "drafts" || currentView === "sent" || currentView === "scheduled") {
      fetchMails();
    }
  }, [currentView, mailId]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleRightPanel = () => {
    setRightPanelCollapsed(!rightPanelCollapsed);
  };

  // Handle window resize for responsive sidebar behavior
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // const handleCategoryChange = (category: string) => {
  //   setSelectedCategory(category);
  // };

  const handleViewChange = (view: string) => {
    setPageLoading(true);
    setCurrentView(view);
    setLocation(`/mailbox/m/${mailId}/${view}`);
    setSelectedEmails([]);
    setCurrentPage(1);
    setSelectedEmailId(null);
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
    refetch(); // Force refetch on tab change
  };

  const handleEmailSelect = (emailUniqueId: string, selected: boolean) => {
    if (selected) {
      setSelectedEmails([...selectedEmails, emailUniqueId]);
    } else {
      setSelectedEmails(selectedEmails.filter((id) => id !== emailUniqueId));
    }
  };

  const handleSelectAll = async (type: string) => {
    // Get current emails to get all email IDs for the current category or label
    const isLabelView = currentView.startsWith("label:");
    const labelName = isLabelView ? currentView.split("label:")[1] : "";
    const currentCategory = currentView === "inbox" ? "inbox" : currentView;

    try {
      const apiUrl = isLabelView
        ? `/api/labels/${labelName}/emails`
        : `/api/emails/${currentCategory}`;

      const response = await fetch(apiUrl);
      const emails = await response.json();
      const allEmailIds = emails.map((email: any) => email.emailUniqueId);

      if (allEmailIds.length === 0) return;

      let updates = {};

      switch (type) {
        case "allmails":
          setSelectedEmails(allEmailIds);
          return;
        case "read":
          updates = { isRead: true };
          break;
        case "unread":
          updates = { isRead: false };
          break;
        case "starred":
          updates = { isStarred: true };
          break;
        case "unstarred":
          updates = { isStarred: false };
          break;
        default:
          return;
      }

      // Make bulk update API call
      const updateResponse = await fetch("/api/emails/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailIds: allEmailIds,
          updates,
        }),
      });

      if (updateResponse.ok) {
        // Refresh the email list by invalidating the query cache
        window.location.reload();
      }
    } catch (error) {
      console.error("Error updating emails:", error);
    }
  };

  const handleMainCheckboxToggle = (
    checked: boolean,
    allEmailIds: string[]
  ) => {
    if (checked) {
      setSelectedEmails(allEmailIds);
    } else {
      setSelectedEmails([]);
    }
  };

  const handleRefresh = async () => {
    const isLabelView = currentView.startsWith("label:");
    const labelName = isLabelView ? currentView.split("label:")[1] : "";
    const currentCategory =
      currentView === "inbox" ? selectedCategory : currentView;

    // Invalidate the specific email query to refetch fresh data
    const queryKey = isLabelView
      ? [`/api/labels/${labelName}/emails`]
      : [`/api/emails/${currentCategory}`, currentCategory];

    queryClient.invalidateQueries({ queryKey });
  };

  const handleUnmuteEmails = async (emailIds: string[]) => {
    try {
      const response = await fetch("/api/emails/bulk/unmute", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailIds }),
      });

      if (response.ok) {
        // Clear selected emails and refresh the view
        setSelectedEmails([]);
        handleRefresh();

        // Show success message
        console.log(
          `Unmuted ${emailIds.length} email${emailIds.length > 1 ? "s" : ""}`
        );
      }
    } catch (error) {
      console.error("Error unmuting emails:", error);
    }
  };

  const handleMuteEmails = async (emailIds: string[]) => {
    try {
      const response = await fetch("/api/emails/bulk/mute", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailIds }),
      });

      if (response.ok) {
        // Clear selected emails and refresh the view
        setSelectedEmails([]);
        handleRefresh();

        // Show success message
        console.log(
          `Muted ${emailIds.length} email${emailIds.length > 1 ? "s" : ""}`
        );
      }
    } catch (error) {
      console.error("Error muting emails:", error);
    }
  };

  const handleUnsnoozeEmails = async (emailIds: string[]) => {
    try {
      for (const emailId of emailIds) {
        const email = allEmails.find((e: any) => e.emailUniqueId === emailId);
        if (email && email.threadId && mailId) {
          const authtoken = localStorage.getItem("authtoken") || "";
          await updateConversationMessages(mailId, email.threadId, { isSnoozed: false }, authtoken);
          invalidateAllRelevantQueries(currentView, mailId);
        } else if (email) {
          updateEmailAttributesMutation.mutate(getMailUpdatePayload(email, { isSnoozed: false }));
          invalidateAllRelevantQueries(currentView, mailId);
        }
      }
      invalidateAllRelevantQueries(currentView, mailId);
      setSelectedEmails([]);
      handleRefresh();
    } catch (error) {
      console.error("[DEBUG] Error unsnoozing emails:", error);
    }
  };

  const handleBulkMarkAsRead = async (emailIds: string[]) => {
    try {
      for (const emailId of emailIds) {
        const email = allEmails.find((e: any) => e.emailUniqueId === emailId);
        if (email && email.threadId && mailId) {
          const authtoken = localStorage.getItem("authtoken") || "";
          await updateConversationMessages(mailId, email.threadId, { seen: true }, authtoken);
          invalidateAllRelevantQueries(currentView, mailId);
        } else if (email) {
          updateEmailAttributesMutation.mutate(getMailUpdatePayload(email, { seen: true }));
          invalidateAllRelevantQueries(currentView, mailId);
        }
      }
      invalidateAllRelevantQueries(currentView, mailId);
      setSelectedEmails([]);
      handleRefresh();
    } catch (error) {
      console.error("Error marking emails as read:", error);
    }
  };

  // Bulk unspam handler
  const handleUnspamEmails = async (emailIds: string[]) => {
    try {
      for (const emailId of emailIds) {
        const email = allEmails.find((e: any) => e.emailUniqueId === emailId);
        if (email && email.threadId && mailId) {
          const authtoken = localStorage.getItem("authtoken") || "";
          await updateConversationMessages(mailId, email.threadId, { isSpam: false }, authtoken);
          invalidateAllRelevantQueries(currentView, mailId);
        } else if (email) {
          updateEmailAttributesMutation.mutate(getMailUpdatePayload(email, { isSpam: false }));
          invalidateAllRelevantQueries(currentView, mailId);
        }
      }
      invalidateAllRelevantQueries(currentView, mailId);
      setSelectedEmails([]);
      handleRefresh();
    } catch (error) {
      console.error("Error unspamming emails:", error);
    }
  };

  // Bulk unarchive handler
  const handleUnarchiveEmails = async (emailIds: string[]) => {
    try {
      for (const emailId of emailIds) {
        const email = allEmails.find((e: any) => e.emailUniqueId === emailId);
        if (email && email.threadId && mailId) {
          const authtoken = localStorage.getItem("authtoken") || "";
          await updateConversationMessages(mailId, email.threadId, { isArchived: false }, authtoken);
          invalidateAllRelevantQueries(currentView, mailId);
        } else if (email) {
          updateEmailAttributesMutation.mutate(getMailUpdatePayload(email, { isArchived: false }));
          invalidateAllRelevantQueries(currentView, mailId);
        }
      }
      invalidateAllRelevantQueries(currentView, mailId);
      setSelectedEmails([]);
      handleRefresh();
    } catch (error) {
      console.error("Error unarchiving emails:", error);
    }
  };

  // Bulk remove from tasks handler
  const handleRemoveFromTasks = async (emailIds: string[]) => {
    try {
      for (const emailId of emailIds) {
        const email = allEmails.find((e: any) => e.emailUniqueId === emailId);
        if (email && email.threadId && mailId) {
          const authtoken = localStorage.getItem("authtoken") || "";
          await updateConversationMessages(mailId, email.threadId, { isAddToTask: false }, authtoken);
          invalidateAllRelevantQueries(currentView, mailId);
        } else if (email) {
          updateEmailAttributesMutation.mutate(getMailUpdatePayload(email, { isAddToTask: false }));
          invalidateAllRelevantQueries(currentView, mailId);
        }
      }
      invalidateAllRelevantQueries(currentView, mailId);
      setSelectedEmails([]);
      handleRefresh();
    } catch (error) {
      console.error("Error removing emails from tasks:", error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Clear selected emails when changing pages
    setSelectedEmails([]);
  };

  const handleEmailClick = (emailId: number, emailUniqueId: string, sendMailId: string) => {
    if (currentView === "drafts" || currentView === "sent" || currentView === "scheduled") {
      setLocation(`/mailbox/m/${mailId}/${currentView}/email/${sendMailId}`);
    } else {
      setLocation(`/mailbox/m/${mailId}/${currentView}/email/${emailUniqueId}`);
    }
  };

  // When closing email detail, update the URL
  const handleBackToList = () => {
    setPageLoading(true);
    setSelectedEmailId(null);
    setSelectedEmailUniqueId(null);
    setLocation(`/mailbox/m/${mailId}/${currentView}`);
    refetch(); // Force refetch immediately
  };

  // Sync selectedEmailId with URL on mount or URL change
  useEffect(() => {
    if (urlEmailId) {
      setSelectedEmailId(Number(urlEmailId));
    } else {
      setSelectedEmailId(null);
    }
  }, [urlEmailId]);

  const handleOpenFilters = () => {
    setShowFilters(true);
  };

  // When settings tab changes, update the URL
  const handleSettingsTabChange = (tab: string) => {
    setSettingsTab(tab);
    setLocation(`/mailbox/m/${mailId}/settings/${tab}`);
  };

  // When showSettings changes, update the URL
  useEffect(() => {
    if (showSettings) {
      setLocation(`/mailbox/m/${mailId}/settings/${settingsTab}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSettings]);

  const handleSearch = (filters: any) => {
    setSearchFilters(filters);
    setShowFilters(false);
    console.log("Search filters:", filters);
  };

  // Get total emails count for pagination
  const isLabelView = currentView.startsWith("label:");
  const labelName = isLabelView ? currentView.split("label:")[1] : "";

  const currentCategory =
    currentView === "inbox" ? selectedCategory : currentView;

  // Choose the appropriate API endpoint based on view type
  const getTabQueryKey = (mailId: string | undefined, view: string) => {
    switch (view) {
      case "sent":
      case "drafts":
        return ["/mails/get-sendmail", mailId, view];
      default:
        return ["/email/allmails", mailId, view];
    }
  };

  const queryKey = getTabQueryKey(mailId, currentView);

  const queryFn = async () => {
    if (currentView === "sent" || currentView === "drafts") {
      const res = await apiRequest("POST", "/mails/get-sendmail", {
        mail_Id: mailId,
        status: currentView === "sent" ? "sent" : "draft",
      });
      console.log("[DEBUG] API response for", currentView, res.data);
      return res.data || [];
    } else {
      const res = await apiRequest("POST", "/email/allmails", {
        mail_id: mailId,
        category: currentView,
      });
      console.log("[DEBUG] API response for", currentView, res.data);
      return Array.isArray(res.data) ? res.data : res.data?.emails || [];
    }
  };

  const {
    data: allEmails = [],
    isLoading,
    isFetching,
    refetch
  } = useQuery<Email[]>({
    queryKey,
    queryFn,
  });

  useEffect(() => {
    console.log("[DEBUG] QueryKey:", queryKey, "allEmails:", allEmails);
  }, [queryKey, allEmails]);

  useEffect(() => {
    if (!isLoading && !isFetching) {
      setPageLoading(false);
    }
  }, [isLoading, isFetching]);

  // Get inbox type from settings
  const getInboxType = () => {
    // Force default sorting by date (not unread)
    return "default";
    // If you want to allow user settings, comment out the above and use the below:
    // const savedSettings = localStorage.getItem('gmailSettings');
    // if (savedSettings) {
    //   const settings = JSON.parse(savedSettings);
    //   return settings.inboxType || "default";
    // }
    // return "default";
  };

  // Sort emails based on inbox type
  const sortEmailsByInboxType = (emails: Email[]) => {
    const inboxType = getInboxType();
    const sortedEmails = [...emails];

    const getTimestamp = (email: Email) => {
      if (!email.timestamp) return 0;
      try {
        return new Date(email.timestamp as string | Date).getTime();
      } catch {
        return 0;
      }
    };

    switch (inboxType) {
      case "important":
        // Sort by important first, then by date
        return sortedEmails.sort((a, b) => {
          if (a.isImportant && !b.isImportant) return -1;
          if (!a.isImportant && b.isImportant) return 1;
          return getTimestamp(b) - getTimestamp(a);
        });
      case "unread":
        // Sort unread first, then by date
        return sortedEmails.sort((a, b) => {
          const aUnread =
            typeof (a as any).isUnread === "boolean"
              ? (a as any).isUnread
              : !a.isRead;
          const bUnread =
            typeof (b as any).isUnread === "boolean"
              ? (b as any).isUnread
              : !b.isRead;
          if (aUnread && !bUnread) return -1;
          if (!aUnread && bUnread) return 1;
          return getTimestamp(b) - getTimestamp(a);
        });
      case "starred":
        // Sort starred first, then by date
        return sortedEmails.sort((a, b) => {
          if (a.isStarred && !b.isStarred) return -1;
          if (!a.isStarred && b.isStarred) return 1;
          return getTimestamp(b) - getTimestamp(a);
        });
      case "priority":
        // Sort by priority: important & unread, important, starred, unread, rest
        return sortedEmails.sort((a, b) => {
          const aPriority = getPriorityScore(a);
          const bPriority = getPriorityScore(b);
          if (aPriority !== bPriority) return bPriority - aPriority;
          return getTimestamp(b) - getTimestamp(a);
        });
      case "multiple":
        // For multiple inboxes, we'll use the default sorting for now
        // This could be extended to show different sections
        return sortedEmails.sort((a, b) => getTimestamp(b) - getTimestamp(a));
      default:
        // Default sorting by date (newest first), do NOT sort by unread/read
        return sortedEmails.sort((a, b) => getTimestamp(b) - getTimestamp(a));
    }
  };

  const getPriorityScore = (email: Email) => {
    let score = 0;
    if (email.isImportant && !email.isRead) score += 4; // Highest priority
    else if (email.isImportant) score += 3;
    else if (email.isStarred) score += 2;
    else if (!email.isRead) score += 1;
    return score;
  };

  function filterEmailsByCategory(emails: Email[], category: string) {
    if (!Array.isArray(emails)) return [];
    switch (category) {
      case "starred":
        return emails.filter((email) => email.isStarred);
      case "snoozed":
        return emails.filter((email) => email.isSnoozed);
      case "important":
        return emails.filter((email) => email.isImportant);
      case "spam":
        return emails.filter((email) => email.isSpam);
      case "trash":
        return emails.filter((email) => email.isTrash);
      case "archive":
      case "archived":
        return emails.filter((email) => email.isArchived);
      case "muted":
        return emails.filter((email) => email.isMute);
      case "tasks":
        return emails.filter((email) => email.isAddToTask);
      case "allmails":
        // Show all except archived, spam, trash (do NOT exclude isMute)
        return emails.filter(
          (email) =>
            !email.isArchived &&
            !email.isSpam &&
            !email.isTrash &&
            !email.isBlocked
        );
      case "blocked":
        // Only show emails that are blocked
        return emails.filter((email) => email.isBlocked);
      case "drafts":
      case "sent":
      case "scheduled":
        // For these, the backend already filtered by status, so just return all
        return emails;
      case "inbox":
      default:
        return emails.filter(
          (email) =>
            // Show if not archived, spam, trash, and not muted
            (!email.isArchived &&
              !email.isSpam &&
              !email.isTrash &&
              !email.isMute &&
              !email.isBlocked) ||
            // OR always include if isAddToTask, isImportant, isSnoozed, or isStarred
            email.isAddToTask ||
            email.isImportant ||
            email.isSnoozed ||
            email.isStarred
        );
    }
  }

  const userEmail = allEmails[0]?.to || "";
  console.log("userEmail:", userEmail);

  // Use the correct emails array based on currentView
  const emailsToShow =
    currentView === "drafts" || currentView === "sent" || currentView === "scheduled"
      ? fetchedEmails
      : allEmails;

  console.log('DEBUG: emailsToShow', emailsToShow);
  console.log('DEBUG: selectedEmailId', selectedEmailId);
  console.log('DEBUG: selectedEmailUniqueId', selectedEmailUniqueId);
  console.log('DEBUG: urlEmailId', urlEmailId);

  const filteredEmails = filterEmailsByCategory(
    emailsToShow,
    currentView
  ).filter(
    (email) => email && (email.emailUniqueId || email.id) && email.subject
  );
  const sortedEmails = sortEmailsByInboxType(filteredEmails);
  console.log("📬 Emails passed to EmailList:", sortedEmails);
  const totalEmails = sortedEmails.length;
  const totalPages = Math.ceil(totalEmails / emailsPerPage);

  // Listen for changes to conversationsPerPage in localStorage
  useEffect(() => {
    const handleStorage = () => {
      const settings = localStorage.getItem("gmailSettings");
      if (settings) {
        try {
          const parsed = JSON.parse(settings);
          const newPageSize = parseInt(parsed.conversationsPerPage, 10) || 50;
          setEmailsPerPage(newPageSize);
          setCurrentPage(1); // Reset to first page on change
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Load system labels visibility
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

    // Listen for settings navigation events
    const handleOpenSettingsWithTab = (e: CustomEvent) => {
      setSettingsTab(e.detail.tab);
      setShowSettings(true);
    };

    // Listen for compose with context events (Reply, Reply All, Forward)
    const handleOpenComposeWithContext = (e: CustomEvent) => {
      // First open the compose modal
      setShowCompose(true);
      // The context will be handled by the ComposeModal component's useEffect
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "systemLabelsVisibilityChanged",
      handleCustomEvent as EventListener
    );
    window.addEventListener(
      "openSettingsWithTab",
      handleOpenSettingsWithTab as EventListener
    );
    window.addEventListener(
      "openComposeWithContext",
      handleOpenComposeWithContext as EventListener
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "systemLabelsVisibilityChanged",
        handleCustomEvent as EventListener
      );
      window.removeEventListener(
        "openSettingsWithTab",
        handleOpenSettingsWithTab as EventListener
      );
      window.removeEventListener(
        "openComposeWithContext",
        handleOpenComposeWithContext as EventListener
      );
    };
  }, []);

  const [systemLabelsVisibility, setSystemLabelsVisibility] = useState({
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

  const handleShowSettings = async () => {
    if (!mailId) return;
    setLoadingSettings(true);
    try {
      const res = await apiRequest("POST", "/setting/getSetting", {
        mail_Id: mailId,
      });
      if (res.data && res.data.success) {
        setSettingsData(res.data.settings);
        setShowSettings(true);
      } else {
        // handle error (optional: show toast)
      }
    } catch (err) {
      // handle error (optional: show toast)
    } finally {
      setLoadingSettings(false);
    }
  };

  // Auth token check
  React.useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("authtoken");
      const expiry = localStorage.getItem("authtoken_expiry");
      if (!token || !expiry || Date.now() > Number(expiry)) {
        if (checkedAuth) {
          toast({
            title: "Session Expired",
            description: "Your session expired. Please log in again.",
            variant: "destructive",
          });
        }
        setLocation("/");
      } else {
        setCheckedAuth(true);
      }
    };

    checkAuth();
    window.addEventListener("storage", checkAuth);
    const interval = setInterval(checkAuth, 1000); // Check every second

    return () => {
      window.removeEventListener("storage", checkAuth);
      clearInterval(interval);
    };
  }, [setLocation, toast, checkedAuth]);

  useEffect(() => {
    if (currentView && currentView.startsWith("label:")) {
      const labelUniqueId = currentView.split(":")[1];
      setLabelLoading(true);
      setLabelError(null);
      console.log("Requesting received emails for label:", labelUniqueId);
      console.log("Requesting sent emails for label:", labelUniqueId, "with forSendMail: true");
      Promise.allSettled([
        apiRequest("POST", "/email/getEmailsByLabel", { labelUniqueId }),
        apiRequest("POST", "/email/getEmailsByLabel", { labelUniqueId, forSendMail: true })
      ])
        .then(([receivedResult, sentResult]) => {
          let received = [];
          let sent = [];
          if (receivedResult.status === "fulfilled") {
            received = receivedResult.value.data.emails || [];
            console.log("Received emails:", received);
          }
          if (sentResult.status === "fulfilled") {
            sent = sentResult.value.data.sendMails || [];
            console.log("Sent emails:", sent);
          }
          setLabelEmails({ received, sent });
          setLabelLoading(false);
          if (received.length === 0 && sent.length === 0) {
            setLabelError("No emails found for this label");
          }
        })
        .catch((err) => {
          setLabelError(err.message || "Failed to fetch emails for label");
          setLabelLoading(false);
        });
    } else {
      setLabelEmails(null);
      setLabelError(null);
    }
  }, [currentView]);

  useEffect(() => {
    console.log("location:", location);
    console.log("showSettings:", showSettings);
    if (location && location.includes("/settings")) {
      setShowSettings(true);
      const tabMatch = location.match(/settings\/(\w+)/);
      if (tabMatch) setSettingsTab(tabMatch[1]);
      else setSettingsTab("General");
    } else {
      setShowSettings(false);
    }
  }, [location]);

  // Fetch settings data when modal is opened by URL
  useEffect(() => {
    if (showSettings && !settingsData && mailId) {
      console.log("Fetching settings data due to showSettings=true");
      handleShowSettings();
    }
  }, [showSettings, settingsData, mailId]);

  // Group emails by threadId after sorting
  const threads = sortedEmails.reduce((acc, email) => {
    if (!email.threadId) return acc;
    if (!acc[email.threadId]) acc[email.threadId] = [];
    acc[email.threadId].push(email);
    return acc;
  }, {} as Record<string, Email[]>);

  // Thread-level filtering for tabs
  const inboxThreads = Object.values(threads).filter(threadEmails =>
    threadEmails.every(email =>
      !email.isArchived && !email.isTrash && !email.isSpam && !email.isMute
    )
  );
  const archiveThreads = Object.values(threads).filter(threadEmails =>
    threadEmails.some(email => email.isArchived)
  );
  const trashThreads = Object.values(threads).filter(threadEmails =>
    threadEmails.some(email => email.isTrash)
  );
  const spamThreads = Object.values(threads).filter(threadEmails =>
    threadEmails.some(email => email.isSpam)
  );
  const mutedThreads = Object.values(threads).filter(threadEmails =>
    threadEmails.some(email => email.isMute)
  );

  // Use these filtered arrays for rendering EmailList based on currentView
  let threadsToShow = inboxThreads;
  if (currentView === "archive" || currentView === "archived") {
    threadsToShow = archiveThreads;
  } else if (currentView === "trash") {
    threadsToShow = trashThreads;
  } else if (currentView === "spam") {
    threadsToShow = spamThreads;
  } else if (currentView === "muted") {
    threadsToShow = mutedThreads;
  }

  // Flatten threadsToShow to a single array of emails for EmailList
  const emailsForList = threadsToShow.map(thread => thread[0]); // Show main message for each thread

  // Gmail-like ThreadView component
  function GmailThreadView({ threadEmails }: { threadEmails: Email[] }) {
    // Sort emails by date ascending
    const sorted = [...threadEmails].sort((a, b) => {
      const dateA = a.date ? new Date(a.date as string).getTime() : a.timestamp ? new Date(a.timestamp as string).getTime() : 0;
      const dateB = b.date ? new Date(b.date as string).getTime() : b.timestamp ? new Date(b.timestamp as string).getTime() : 0;
      return dateA - dateB;
    });
    // By default, expand the latest message
    const [expandedIndex, setExpandedIndex] = useState(sorted.length - 1);

    return (
      <div className="thread border rounded mb-4 p-2 bg-white">
        {sorted.map((email, idx) => {
          const isExpanded = idx === expandedIndex;
          return (
            <div key={email.id} className="mb-2 border-b pb-2 last:border-b-0 last:pb-0">
              <div
                className={`flex items-center cursor-pointer ${isExpanded ? "font-bold" : ""}`}
                onClick={() => setExpandedIndex(idx)}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-lg font-bold mr-2">
                  {(email.from || email.sender || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div>{email.from || email.sender}</div>
                  <div className="text-xs text-gray-500">{email.subject}</div>
                </div>
                <div className="text-xs text-gray-400 ml-2">
                  {email.date ? new Date(email.date as string).toLocaleString() : email.timestamp ? new Date(email.timestamp as string).toLocaleString() : ''}
                </div>
              </div>
              {isExpanded ? (
                <div className="mt-2">
                  <div className="text-sm" dangerouslySetInnerHTML={{ __html: email.html || email.content || '' }} />
                  {/* Attachments, actions, etc. can go here */}
                </div>
              ) : (
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {(email.html || email.content || '').replace(/<[^>]+>/g, '').slice(0, 80)}...
                </div>
              )}
            </div>
          );
        })}
        {/* Reply box below the latest message (for demo, just a placeholder) */}
        <div className="mt-4 p-2 border-t">
          <input className="w-full border rounded p-2" placeholder="Reply... (demo only)" />
        </div>
      </div>
    );
  }

  // Find the selected email object
  const selectedEmail = emailsToShow.find(
    (email) =>
      email.emailUniqueId === urlEmailId ||
      email.sendMail_Id === urlEmailId
  );
  console.log('DEBUG: selectedEmail', selectedEmail);

  useEffect(() => {
    setMailboxUserEmail(getUserEmailFromToken());
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <TopNavbar
        mailId={mailId}
        onToggleSidebar={toggleSidebar}
        showFilters={showFilters}
        onShowFiltersChange={setShowFilters}
        onShowSettings={handleShowSettings}
        onSearch={handleSearch}
        onSearchResults={setSearchResults}
        onToggleRightPanel={toggleRightPanel}
        sidebarOpen={!sidebarCollapsed}
      />

      <div className="flex flex-1 h-screen min-h-0 bg-white">
        {/* Desktop Sidebar */}
        <div className="hidden md:block border-r">
          <LeftSidebar
            collapsed={sidebarCollapsed}
            currentView={currentView}
            onViewChange={handleViewChange}
            onCompose={() => setShowCompose(true)}
            onShowSettings={() => setShowSettings(true)}
            selectedCategory={selectedCategory}
            // onCategoryChange={handleCategoryChange}
            mailId={mailId || ""}
          />
        </div>

        {/* Mobile Sidebar Overlay */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ease-out ${
            !sidebarCollapsed
              ? "opacity-100 pointer-events-auto backdrop-blur-sm"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <div
            className={`absolute inset-0 bg-black transition-opacity duration-300 ease-out ${
              !sidebarCollapsed ? "bg-opacity-50" : "bg-opacity-0"
            }`}
            onClick={() => setSidebarCollapsed(true)}
          />
          <div
            className={`absolute left-0 top-[48px] bottom-0 w-64 bg-white dark:bg-black shadow-2xl transform transition-all duration-300 ease-out ${
              !sidebarCollapsed
                ? "translate-x-0 scale-100"
                : "-translate-x-full scale-95"
            } border-r`}
          >
            <LeftSidebar
              collapsed={false}
              currentView={currentView}
              onViewChange={handleViewChange}
              onCompose={() => setShowCompose(true)}
              onShowSettings={() => setShowSettings(true)}
              selectedCategory={selectedCategory}
              // onCategoryChange={handleCategoryChange}
              mailId={mailId || ""}
            />
          </div>
        </div>

        <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {showSettings && settingsData && (
            <Settings
              onClose={() => {
                setShowSettings(false);
                setSettingsTab("General");
                setLocation(`/mailbox/m/${mailId}/inbox`);
              }}
              initialTab={settingsTab}
              onTabChange={handleSettingsTabChange}
              onOpenFilters={() => {
                setShowSettings(false);
                setShowFilters(true);
              }}
              initialSettings={settingsData}
              mailId={mailId || ""}
            />
          )}

          {/* Main content */}
          {!showSettings && (
            <>
              {/* Clear Search/Filter button */}
              {searchResults && (
                <div className="flex justify-end p-2">
                  <button
                    onClick={() => setSearchResults(null)}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded shadow text-xs"
                  >
                    Clear Search/Filter
                  </button>
                </div>
              )}
              {/* Hide EmailToolbar in details view */}
              {!urlEmailId && (
                <div className="hidden md:block">
                  <EmailToolbar
                    selectedCount={selectedEmails.length}
                    onSelectAll={handleSelectAll}
                    onMainCheckboxToggle={handleMainCheckboxToggle}
                    onShowKeyboard={() => setShowKeyboard(true)}
                    currentCategory={currentView === "inbox" ? selectedCategory : currentView}
                    selectedEmails={selectedEmails}
                    onRefresh={handleRefresh}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    emailsPerPage={emailsPerPage}
                    totalEmails={searchResults ? searchResults.length : totalEmails}
                    onPageChange={handlePageChange}
                    onUnmuteEmails={handleUnmuteEmails}
                    onMuteEmails={handleMuteEmails}
                    onUnsnoozeEmails={handleUnsnoozeEmails}
                    onBulkMarkAsRead={handleBulkMarkAsRead}
                    onRemoveFromTasks={handleRemoveFromTasks}
                    onUnspamEmails={handleUnspamEmails}
                    onUnarchiveEmails={handleUnarchiveEmails}
                    mailId={mailId || ""}
                  />
                </div>
              )}

              {/* Hide primary/promotions filters on mobile - they'll be in hamburger menu */}
              {/* {currentView === "inbox" && !selectedEmailId && (
              <div className="hidden md:flex border-b border-gray-200 bg-white overflow-x-auto">
                <button 
                  onClick={() => handleCategoryChange("primary")}
                  className={`flex-1 min-w-0 px-2 md:px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors text-left ${
                    selectedCategory === "primary" 
                      ? "text-red-600 border-red-600 bg-red-50" 
                      : "text-gray-600 border-transparent hover:bg-gray-50"
                  }`}
                >
                  <i className="fas fa-inbox mr-1 md:mr-2"></i>
                  <span className="truncate">{t.primary}</span>
                </button>
                <button 
                  onClick={() => handleCategoryChange("promotions")}
                  className={`flex-1 min-w-0 px-2 md:px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors text-left ${
                    selectedCategory === "promotions" 
                      ? "text-red-600 border-red-600 bg-red-50" 
                      : "text-gray-600 border-transparent hover:bg-gray-50"
                  }`}
                >
                  <i className="fas fa-tag mr-1 md:mr-2"></i>
                  <span className="truncate">{t.promotions}</span>
                  <span className="ml-1 md:ml-2 bg-green-100 text-green-800 px-1 md:px-2 py-1 rounded-full text-xs hidden sm:inline">17 new</span>
                </button>
              </div>
            )} */}

              {(isLoading || isFetching) ? (
                <div className="flex-1 flex items-center justify-center bg-background">
                  <Loader />
                </div>
              ) : !allEmails || allEmails.length === 0 ? (
                <div className="flex-1 flex items-center justify-center bg-background">
                  <div>No emails found.</div>
                </div>
              ) : urlEmailId ? (
                <>
                  {console.log("[DEBUG] Rendering EmailDetail with", {
                    mailId,
                    emailUniqueId: urlEmailId,
                    threadId: selectedEmail?.threadId,
                    selectedEmail
                  })}
                  <EmailDetail
                    mailId={mailId || ""}
                    // For sent/drafts, urlEmailId is sendMail_Id; for others, it's emailUniqueId
                    emailUniqueId={urlEmailId}
                    threadId={selectedEmail?.threadId || null}
                    currentView={currentView}
                    onBack={handleBackToList}
                    onOpenFilters={handleOpenFilters}
                  />
                </>
              ) : labelLoading ? (
                <div className="flex-1 flex items-center justify-center bg-background">
                  <Loader />
                </div>
              ) : labelError ? (
                <div className="flex-1 flex items-center justify-center bg-background">
                  <div className="text-center">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-600 mb-2">
                      {labelError}
                    </p>
                    <p className="text-sm text-gray-500">
                      This label doesn't have any emails yet.
                    </p>
                  </div>
                </div>
              ) : labelEmails ? (
                <EmailList
                  mailId={mailId || ""}
                  category={currentView}
                  onEmailSelect={handleEmailSelect}
                  selectedCategory={selectedCategory}
                  selectedEmails={selectedEmails}
                  currentPage={currentPage}
                  emailsPerPage={emailsPerPage}
                  onEmailClick={(emailId, emailUniqueId, sendMailId) => handleEmailClick(emailId, emailUniqueId, sendMailId)}
                  searchResults={
                    searchResults
                      ? searchResults
                      : labelEmails.received.concat(labelEmails.sent)
                  }
                  isLoading={pageLoading || isLoading || isFetching}
                />
              ) : (
                <EmailList
                  mailId={mailId || ""}
                  category={currentView}
                  onEmailSelect={handleEmailSelect}
                  selectedCategory={selectedCategory}
                  selectedEmails={selectedEmails}
                  currentPage={currentPage}
                  emailsPerPage={emailsPerPage}
                  onEmailClick={(emailId, emailUniqueId, sendMailId) => handleEmailClick(emailId, emailUniqueId, sendMailId)}
                  searchResults={
                    searchResults ? searchResults : emailsForList
                  }
                  isLoading={pageLoading || isLoading || isFetching}
                />
              )}
            </>
          )}
        </main>

        {/* Right Sidebar and Toggle Button */}
        <>
          <div
            className={`transition-all duration-300 ease-in-out border-l bg-white dark:bg-black relative ${
              rightPanelCollapsed ? "w-0 min-w-0" : ""
            } hidden md:flex flex-col`}
            style={{ overflow: rightPanelCollapsed ? "hidden" : "visible" }}
          >
            {!rightPanelCollapsed && (
              <RightSidebar collapsed={rightPanelCollapsed} />
            )}
          </div>
          {/* Toggle button always outside, same position and style */}
          <button
            onClick={() => setRightPanelCollapsed((prev) => !prev)}
            className={`fixed bottom-6 z-20 px-3 py-1 bg-[#ffa184] text-white rounded-l-full shadow hover:bg-[#ff8c69] focus:outline-none focus:ring-2 focus:ring-[#ffa184] transition-all text-xs border-l-2 border-[#ffa184] hidden md:block ${
              rightPanelCollapsed ? "right-0" : "right-[2.5rem]"
            }`}
            style={{ outline: "none" }}
            aria-label={
              rightPanelCollapsed ? "Show right sidebar" : "Hide right sidebar"
            }
          >
            {rightPanelCollapsed ? "◀" : "▶"}
          </button>
        </>
      </div>

      {/* Mobile floating compose button */}
      <button
        onClick={() => setShowCompose(true)}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
        title="Compose"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>

      {showKeyboard && (
        <VirtualKeyboard onClose={() => setShowKeyboard(false)} />
      )}

      <ComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        mail_Id={mailId || ""}
        from={mailboxUserEmail}
        setSendStatus={setSendStatus}
        setSentMailId={setSentMailId}
      />
      {sendStatus !== 'idle' && (
        <SendStatusBar
          status={sendStatus}
          onUndo={() => {/* implement undo logic if needed */}}
          onView={() => { if (sentMailId) {/* navigate to sent mail detail */} }}
          onClose={() => setSendStatus('idle')}
        />
      )}
    </div>
  );
}
