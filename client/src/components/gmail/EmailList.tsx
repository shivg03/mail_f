import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Email } from "../../pages/mailbox";
import { useTranslation } from "@/contexts/TranslationContext";

interface EmailListProps {
  mailId: string;
  category: string;
  onEmailSelect: (emailUniqueId: string, selected: boolean) => void;
  selectedEmails: string[];
  currentPage: number;
  emailsPerPage: number;
  onEmailClick: (emailId: number, emailUniqueId: string) => void;
  searchResults?: Email[]; // <-- add this line
  selectedCategory?: string; // ✅ added
  isLoading: boolean;
}

interface EmailRowProps {
  email: Email;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onEmailClick: (emailId: number, emlFilePath: string) => void;
}

function MobileEmailRow({
  email,
  isSelected,
  onSelect,
  onEmailClick,
  category,
  refetchEmails,
}: EmailRowProps & { category: string; refetchEmails: () => void }) {
  const updateEmailAttributesMutation = useMutation({
    mutationFn: async (attributes: any) => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      return apiRequest("POST", "/email/updateEmail", {
        ...attributes,
        __headers: headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/email/allmails"] });
    },
  });

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (email.emailUniqueId) {
      updateEmailAttributesMutation.mutate({
        emailUniqueId: email.emailUniqueId,
        isStarred: !email.isStarred,
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect(e.target.checked);
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (email.emailUniqueId) {
      updateEmailAttributesMutation.mutate({
        emailUniqueId: email.emailUniqueId,
        seen: email.isUnread,
      });
    }
  };

  const handleEmailClick = () => {
    onEmailClick(email.id, email.emailUniqueId || "");
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "";
    const now = new Date();
    const emailDate = new Date(dateString);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const emailDateOnly = new Date(
      emailDate.getFullYear(),
      emailDate.getMonth(),
      emailDate.getDate()
    );
    if (emailDateOnly.getTime() === today.getTime()) {
      return emailDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (emailDateOnly.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return emailDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getAvatarLetter = (fromOrSender: string) => {
    if (!fromOrSender) return "?";
    const match = fromOrSender.match(/^([^<]+)/);
    const name = match ? match[1].trim() : fromOrSender;
    return name.charAt(0).toUpperCase();
  };
  const getSenderName = (fromOrSender: string) => {
    if (!fromOrSender) return "Unknown";
    const match = fromOrSender.match(/^([^<]+)/);
    return match ? match[1].trim() : fromOrSender;
  };

  return (
    <div
      className={`flex items-center px-4 py-3 transition-colors cursor-pointer ${email.isUnread ? 'bg-gray-200 dark:bg-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-700`}
      onClick={handleEmailClick}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:text-gray-300 font-medium text-sm mr-3">
        {getAvatarLetter((email as any).from?.toString() || email.sender)}
      </div>
      {/* Selection Checkbox */}
      <input
        type="checkbox"
        className="mr-2 rounded border-border text-primary focus:ring-ring w-3 h-3 accent-[#ffa184]"
        checked={isSelected}
        onChange={handleCheckboxChange}
        title="Select email"
      />

      {/* Email Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span
            className={`${
              email.isUnread
                ? "dark:text-white font-semibold"
                : "dark:text-gray-600"
            } text-sm truncate`}
          >
            {getSenderName((email as any).from?.toString() || email.sender)}
          </span>
          <span
            className={`${
              email.isUnread
                ? "dark:text-white font-medium"
                : "dark:text-gray-400"
            } text-xs ml-2`}
          >
            {formatDateTime((email as any).createdAt?.toString() || (email as any).date?.toString())}
          </span>
        </div>
        <div
          className={`${
            email.isUnread ? "dark:text-white font-medium" : "dark:text-gray-400"
          } text-sm truncate mb-1`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`${
                email.isUnread
                  ? "dark:text-white font-medium"
                  : "dark:text-gray-400"
              } text-md md:text-sm truncate`}
            >
              {email.subject}
            </span>
          </div>
        </div>
        {email.preview && (
          <div className={`${email.isUnread ? "dark:text-white font-normal" : "dark:text-gray-400"} text-xs truncate mb-1`}>{email.preview}</div>
        )}
      </div>

      {/* Star button */}
      <button
        className="ml-2 p-1 text-gray-400 hover:text-yellow-500 transition-colors"
        onClick={handleStarClick}
      >
        <svg
          className="w-5 h-5"
          fill={email.isStarred ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>
    </div>
  );
}

// Desktop EmailRow component
function EmailRow({
  email,
  isSelected,
  onSelect,
  onEmailClick,
  category,
  refetchEmails,
}: EmailRowProps & { category: string; refetchEmails: () => void }) {
  const updateEmailAttributesMutation = useMutation({
    mutationFn: async (attributes: any) => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      return apiRequest("POST", "/email/updateEmail", {
        ...attributes,
        __headers: headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/email/allmails"] });
    },
  });

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (email.emailUniqueId) {
      updateEmailAttributesMutation.mutate({
        emailUniqueId: email.emailUniqueId,
        isStarred: !email.isStarred,
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect(e.target.checked);
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (email.emailUniqueId) {
      updateEmailAttributesMutation.mutate({
        emailUniqueId: email.emailUniqueId,
        seen: email.isUnread,
      });
    }
  };

  const handleEmailClick = () => {
    onEmailClick(email.id, email.emailUniqueId || "");
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "";
    const now = new Date();
    const emailDate = new Date(dateString);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const emailDateOnly = new Date(
      emailDate.getFullYear(),
      emailDate.getMonth(),
      emailDate.getDate()
    );
    if (emailDateOnly.getTime() === today.getTime()) {
      return emailDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (emailDateOnly.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return emailDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className={`flex items-center px-2 md:px-4 py-2 md:py-3 border-b transition-all duration-200 group ${email.isUnread ? 'bg-gray-100 dark:bg-gray-800' : ''} hover:bg-accent`}>
      <input
        type="checkbox"
        className="mr-2 md:mr-3 rounded border-border text-primary focus:ring-ring w-3 h-3 md:w-4 md:h-4 accent-[#ffa184]"
        checked={isSelected}
        onChange={handleCheckboxChange}
        title="Select email"
      />
      {/* Read/Unread Checkbox */}
      {/* This checkbox is removed as per the edit hint */}
      <button
        className="mr-2 md:mr-3 text-muted-foreground hover:text-foreground transition-colors duration-200"
        onClick={handleStarClick}
      >
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill={email.isStarred ? "#facc15" : "none"}
          stroke={email.isStarred ? "#facc15" : "currentColor"}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>

      <div
        className="flex-1 flex items-center min-w-0 cursor-pointer"
        onClick={handleEmailClick}
      >
        <div className="w-20 md:w-36 flex-shrink-0">
          <span
            className={`${
              email.isUnread
                ? "font-medium dark:text-white"
                : "dark:text-gray-400"
            } truncate block text-xs md:text-sm`}
          >
            {(email as any).from?.toString() || email.sender}
          </span>
        </div>
        <div className="flex-1 mx-2 md:mx-4 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`${  
                email.isUnread
                  ? "dark:text-white font-medium"
                  : "dark:text-gray-400"
              } text-md md:text-sm truncate`}
            >
              {email.subject}
            </span>
            {email.isMute && (
              <span className="inline-flex items-center px-1 md:px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hidden sm:inline-flex">
                Muted
              </span>
            )}
          </div>
          {email.preview && (
            <div className={`${email.isUnread ? "dark:text-white font-normal" : "dark:text-gray-400"} text-sm truncate mb-1`}>{email.preview}</div>
          )}
        </div>
        <div
          className={`${
            email.isUnread ? "dark:text-white font-medium" : "dark:text-gray-400"
          } text-xs flex-shrink-0`}
        >
          {formatDateTime((email as any).createdAt?.toString() || (email as any).date?.toString())}
        </div>
      </div>
    </div>
  );
}

export default function EmailList({
  mailId,
  category = "inbox",
  onEmailSelect,
  selectedCategory,
  selectedEmails,
  currentPage,
  emailsPerPage,
  onEmailClick,
  searchResults, // <-- rename prop from sortedEmails to searchResults for clarity
  isLoading,
}: EmailListProps) {
  const { t } = useTranslation();
  const isMobile = window.innerWidth < 768;

  // Fetch all emails from backend API
  const { data: allEmails = [], isLoading: loadingEmails, refetch } = useQuery<Email[]>({
    queryKey: ["/email/allmails", mailId, category],
    queryFn: async () => {
      const response = await apiRequest("POST", "/email/allmails", { mail_id: mailId });
      if (Array.isArray(response.data)) return response.data;
      return response.data?.emails || [];
    },
    enabled: !!mailId,
  });

  // Use searchResults if provided, otherwise use allEmails
  const emailsToDisplay = (searchResults !== undefined && searchResults !== null)
    ? searchResults
    : allEmails;

  // Pagination logic
  const validEmailsPerPage = emailsPerPage || 50;
  const validCurrentPage = currentPage >= 1 ? currentPage : 1;
  const startIndex = (validCurrentPage - 1) * validEmailsPerPage;
  const endIndex = startIndex + validEmailsPerPage;
  const paginatedEmails = emailsToDisplay.slice(startIndex, endIndex);

  if (loadingEmails) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-t from-[#ffa184] via-[#ffc3a0] to-[#ff6b6b] rounded-lg flex items-center justify-center mb-4 mx-auto animate-pulse">
            <svg
              className="w-4 h-4 text-primary-foreground"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </div>
          <div className="text-muted-foreground font-medium">
            Loading emails...
          </div>
        </div>
      </div>
    );
  }

  if (!paginatedEmails.length) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-6 mx-auto">
            <svg
              className="w-8 h-8 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </div>
          <div className="text-foreground font-medium text-lg">
            No emails in {category}
          </div>
          <div className="text-muted-foreground mt-2">
            Your {category} folder is empty
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {isMobile
        ? paginatedEmails.map((email: Email) => (
            <MobileEmailRow
              key={email.emailUniqueId || email.id}
              email={email}
              isSelected={!!email.emailUniqueId && selectedEmails.includes(email.emailUniqueId)}
              onSelect={(selected) => { if (email.emailUniqueId) onEmailSelect(email.emailUniqueId, selected); }}
              onEmailClick={onEmailClick}
              category={category}
              refetchEmails={refetch}
            />
          ))
        : paginatedEmails.map((email: Email) => (
            <EmailRow
              key={email.emailUniqueId}
              email={email}
              isSelected={email.emailUniqueId ? selectedEmails.includes(email.emailUniqueId) : false}
              onSelect={(selected) => { if (email.emailUniqueId) onEmailSelect(email.emailUniqueId, selected); }}
              onEmailClick={onEmailClick}
              category={category}
              refetchEmails={refetch}
            />
          ))}
    </div>
  );
}
