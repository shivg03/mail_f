import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Email } from "../../pages/mailbox";
import { useTranslation } from "../../contexts/TranslationContext";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface EmailToolbarProps {
  selectedCount: number;
  onSelectAll: (type: string) => void;
  onMainCheckboxToggle: (checked: boolean, allEmailIds: string[]) => void;
  onShowKeyboard: () => void;
  currentCategory: string;
  selectedEmails: string[];
  onRefresh: () => void;
  currentPage: number;
  totalPages: number;
  emailsPerPage: number;
  totalEmails: number;
  onPageChange: (page: number) => void;
  onUnmuteEmails?: (emailIds: string[]) => void;
  onMuteEmails?: (emailIds: string[]) => void;
  onUnsnoozeEmails?: (emailIds: string[]) => void;
  onBulkMarkAsRead?: (emailIds: string[]) => void;
  onRemoveFromTasks?: (emailIds: string[]) => void;
  onUnspamEmails?: (emailIds: string[]) => void;
  onUnarchiveEmails?: (emailIds: string[]) => void;
  mailId: string;
}

// Utility function to get the correct payload for updating mail attributes
function getMailUpdatePayload(message: any, updates: any) {
  if (message.sendMail_Id) {
    return { sendmail_id: message.sendMail_Id, ...updates };
  } else if (message.emailUniqueId) {
    return { emailUniqueId: message.emailUniqueId, ...updates };
  }
  return updates;
}

export default function EmailToolbar({ selectedCount, onSelectAll, onMainCheckboxToggle, onShowKeyboard, currentCategory, selectedEmails, onRefresh, currentPage, totalPages, emailsPerPage, totalEmails, onPageChange, onUnmuteEmails, onMuteEmails, onUnsnoozeEmails, onBulkMarkAsRead, onRemoveFromTasks, onUnspamEmails, onUnarchiveEmails, mailId }: EmailToolbarProps) {
  const { t } = useTranslation();
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showInputTools, setShowInputTools] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch emails for the current category to get all email IDs
  const { data: emails = [] } = useQuery<Email[]>({
    queryKey: ["/email/allmails", mailId, currentCategory],
    queryFn: async () => {
      const response = await apiRequest("POST", "/email/allmails", { mail_id: mailId });
      if (Array.isArray(response.data)) return response.data;
      return response.data?.emails || [];
    },
    enabled: !!mailId,
  });

  const allEmailIds = Array.isArray(emails) ? emails.map(email => email.emailUniqueId) : [];
  const allSelected = allEmailIds.length > 0 && allEmailIds.every(id => selectedEmails.includes(id));
  const someSelected = selectedEmails.length > 0 && !allSelected;
  
  // Check if any selected emails are muted
  const selectedMutedEmails = Array.isArray(emails)
    ? emails.filter(email => selectedEmails.includes(email.emailUniqueId) && email.isMute)
    : [];
  const hasMutedEmailsSelected = selectedMutedEmails.length > 0;
  
  // Check if any selected emails are not muted (for mute option)
  const selectedUnmutedEmails = Array.isArray(emails)
    ? emails.filter(email => selectedEmails.includes(email.emailUniqueId) && !email.isMute)
    : [];
  const hasUnmutedEmailsSelected = selectedUnmutedEmails.length > 0;
  
  // Check if any selected emails are snoozed (for unsnooze option)
  const selectedSnoozedEmails = Array.isArray(emails)
    ? emails.filter(email => selectedEmails.includes(email.emailUniqueId) && email.isSnoozed)
    : [];
  const hasSnoozedEmailsSelected = selectedSnoozedEmails.length > 0;
  
  // Check if any selected emails are tasks (for remove from tasks option)
  const selectedTaskEmails = Array.isArray(emails)
    ? emails.filter(email => selectedEmails.includes(email.emailUniqueId) && ((email as any)?.isAddToTask || (email as any)?.isTask))
    : [];
  const hasTaskEmailsSelected = selectedTaskEmails.length > 0;

  const updateEmailAttributesMutation = useMutation({
    mutationFn: async (attributes: any) => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      return apiRequest("POST", "/email/updateEmail", {
        ...attributes,
        __headers: headers,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/email/allmails"] });
      onRefresh();
    },
  });

  // Bulk mark as read
  const handleBulkMarkAsRead = async (emailIds: string[], markAsRead: boolean) => {
    const authtoken = localStorage.getItem("authtoken");
    const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
    const emailsToUpdate = Array.isArray(emails)
      ? emails.filter(email => emailIds.includes(email.emailUniqueId) && (email as any).emailUniqueId)
      : [];
    await Promise.all(
      emailsToUpdate.map(email =>
        apiRequest("POST", "/email/updateEmail", getMailUpdatePayload(email, { seen: markAsRead, __headers: headers }))
      )
    );
    queryClient.invalidateQueries(["/email/allmails", mailId, currentCategory] as any);
    onRefresh();
  };

  // Bulk star/unstar
  const handleBulkStar = async (emailIds: string[], star: boolean) => {
    const emailsToUpdate = Array.isArray(emails)
      ? emails.filter(email => emailIds.includes(email.emailUniqueId))
      : [];
    await Promise.all(
      emailsToUpdate.map(async email => {
        // Star/unstar the main message
        await updateEmailAttributesMutation.mutateAsync(getMailUpdatePayload(email, { isStarred: star }));

        // If un-starring, also unstar all conversation messages
        if (!star && email.threadId && mailId) {
          try {
            const authtoken = localStorage.getItem("authtoken");
            const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
            const response = await apiRequest("POST", "/mails/conversation", {
              mail_id: mailId,
              threadId: email.threadId,
              __headers: headers,
            });
            const conversationArr = response.data.conversation;
            if (Array.isArray(conversationArr)) {
              await Promise.all(
                conversationArr.map(async (msg: any) => {
                  if (msg.isStarred) {
                    await updateEmailAttributesMutation.mutateAsync(getMailUpdatePayload(msg, { isStarred: false }));
                  }
                })
              );
            }
            queryClient.invalidateQueries({ queryKey: ["/mails/conversation", mailId, email.threadId] });
          } catch (err) {
            console.error("Failed to unstar conversation messages:", err);
          }
        }
      })
    );
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const emailsToDelete = Array.isArray(emails)
        ? emails.filter(email => selectedEmails.includes(email.emailUniqueId) && (email as any).emailUniqueId)
        : [];
      await Promise.all(
        emailsToDelete.map(email =>
          apiRequest("DELETE", "/email/deleteEmail", { emailUniqueId: (email as any).emailUniqueId, __headers: headers })
        )
      );
      queryClient.invalidateQueries(["/email/allmails", mailId, "trash"] as any);
      setShowDeleteDialog(false);
      onRefresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMainCheckboxClick = () => {
    onMainCheckboxToggle(!allSelected, allEmailIds);
  };

  return (
    <div className="flex items-center justify-between px-2 md:px-6 py-2 md:py-2 border-b bg-card">
      <div className="flex items-center space-x-1 md:space-x-2">
        <div className="relative flex items-center">
          <input 
            type="checkbox" 
            className="rounded border-border text-primary focus:ring-ring w-3 h-3 md:w-4 md:h-4 mr-1 accent-[#ffa184]" 
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected;
            }}
            onChange={handleMainCheckboxClick}
          />
          <button 
            className="flex items-center p-1 md:p-2 hover:bg-accent rounded-lg transition-colors duration-200"
            onClick={() => setShowSelectDropdown(!showSelectDropdown)}
          >
            <svg className="w-2 h-2 md:w-3 md:h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showSelectDropdown && (
            <div className="absolute top-full left-0 mt-2 bg-card border rounded-lg shadow-lg py-2 w-48 z-10">
              <button 
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                onClick={async () => { await handleBulkMarkAsRead(selectedEmails, true); setShowSelectDropdown(false); }}
              >
                {t.markAsRead}
              </button>
              <button 
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                onClick={async () => { await handleBulkMarkAsRead(selectedEmails, false); setShowSelectDropdown(false); }}
              >
                {t.markAsUnread}
              </button>
              <button 
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                onClick={async () => { await handleBulkStar(selectedEmails, true); setShowSelectDropdown(false); }}
              >
                {t.starred}
              </button>
              <button 
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                onClick={async () => { await handleBulkStar(selectedEmails, false); setShowSelectDropdown(false); }}
              >
                {t.unstar}
              </button>
            </div>
          )}
        </div>

        <button 
          className="p-2 hover:bg-accent rounded-lg transition-colors duration-200 disabled:opacity-50" 
          title="Refresh"
          disabled={isRefreshing}
          onClick={async () => {
            setIsRefreshing(true);
            if (mailId) {
              try {
                await apiRequest("POST", "/email/fetchEmails", { mail_id: mailId });
              } catch (err) {
                console.error("Failed to fetch new emails:", err);
              }
            }
            onRefresh();
            // Show loading for at least 500ms for better UX
            setTimeout(() => setIsRefreshing(false), 500);
          }}
        >
          {isRefreshing ? (
            <svg className="w-4 h-4 text-muted-foreground animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>

        <div className="relative">
          <button 
            className="p-2 hover:bg-accent rounded-lg transition-colors duration-200" 
            title="More"
            onClick={() => setShowMoreActions(!showMoreActions)}
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          
          {showMoreActions && (
            <div className="absolute top-full left-0 mt-2 bg-card border rounded-lg shadow-lg py-2 w-48 z-10">
              <button 
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                onClick={async () => {
                  if (selectedEmails.length > 0) {
                    await handleBulkMarkAsRead(selectedEmails, true);
                  }
                  setShowMoreActions(false);
                }}
              >
                {t.markAsRead}
              </button>
              {hasMutedEmailsSelected && (
                <button
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                  onClick={async () => {
                    await Promise.all(
                      selectedMutedEmails.map(email =>
                        updateEmailAttributesMutation.mutateAsync({
                          emailUniqueId: email.emailUniqueId,
                          isMute: false,
                        })
                      )
                    );
                    setShowMoreActions(false);
                  }}
                >
                  {t.unmute}
                </button>
              )}
              {hasUnmutedEmailsSelected && (
                <button
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                  onClick={async () => {
                    await Promise.all(
                      selectedUnmutedEmails.map(email =>
                        updateEmailAttributesMutation.mutateAsync({
                          emailUniqueId: email.emailUniqueId,
                          isMute: true,
                        })
                      )
                    );
                    setShowMoreActions(false);
                  }}
                >
                  {t.mute}
                </button>
              )}
              {hasSnoozedEmailsSelected && onUnsnoozeEmails && (
                <button 
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                  onClick={() => {
                    onUnsnoozeEmails(selectedSnoozedEmails.map(email => email.emailUniqueId));
                    setShowMoreActions(false);
                  }}
                >
                  {t.unsnooze}
                </button>
              )}
              {currentCategory === "spam" && onUnspamEmails && selectedEmails.length > 0 && (
                <button
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                  onClick={() => {
                    onUnspamEmails(selectedEmails);
                    setShowMoreActions(false);
                  }}
                >
                  Unspam
                </button>
              )}
              {currentCategory === "archive" && onUnarchiveEmails && selectedEmails.length > 0 && (
                <button
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                  onClick={() => {
                    onUnarchiveEmails(selectedEmails);
                    setShowMoreActions(false);
                  }}
                >
                  Unarchive
                </button>
              )}
              {hasTaskEmailsSelected && onRemoveFromTasks && currentCategory === "tasks" && (
                <button 
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors"
                  onClick={() => {
                    onRemoveFromTasks(selectedTaskEmails.map(email => email.emailUniqueId));
                    setShowMoreActions(false);
                  }}
                >
                  Remove from Tasks
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <span className="text-muted-foreground text-sm">
          {totalEmails > 0 ? `${(currentPage - 1) * emailsPerPage + 1}-${Math.min(currentPage * emailsPerPage, totalEmails)} of ${totalEmails}` : '0 of 0'}
        </span>
        <div className="flex items-center space-x-1">
          <button 
            className="p-2 hover:bg-accent rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={currentPage <= 1} 
            title="Previous"
            onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button 
            className="p-2 hover:bg-accent rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={currentPage >= totalPages}
            title="Next"
            onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* <div className="relative">
          <div className="flex items-center bg-background hover:bg-accent rounded-lg transition-colors duration-200">
            <button 
              className="p-2 rounded-l-lg" 
              title="Virtual keyboard"
              onClick={onShowKeyboard}
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </button>
            <button 
              className="p-2 rounded-r-lg" 
              title="Input tools options"
              onClick={() => setShowInputTools(!showInputTools)}
            >
              <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {showInputTools && (
            <div className="absolute top-full right-0 mt-2 bg-card border rounded-lg shadow-lg py-2 w-48 z-10">
              <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border mb-2">
                INPUT LANGUAGES
              </div>
              <button className="flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors">
                <div className="w-6 h-4 bg-muted-foreground text-white text-xs flex items-center justify-center rounded">
                  EN
                </div>
                <span>English</span>
              </button>
              <button className="flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors">
                <div className="w-6 h-4 bg-muted-foreground text-white text-xs flex items-center justify-center rounded">
                  EN
                </div>
                <span>English Dvorak</span>
              </button>
              <button className="flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors">
                <div className="w-6 h-4 bg-muted-foreground text-white text-xs flex items-center justify-center rounded">
                  En
                </div>
                <span>English</span>
              </button>
              <button className="flex items-center space-x-3 px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors">
                <div className="w-6 h-4 bg-muted-foreground text-white text-xs flex items-center justify-center rounded">
                  ✏️
                </div>
                <span>English</span>
              </button>
              <div className="border-t border-border mt-2 pt-2">
                <button className="block px-4 py-2 text-sm text-foreground hover:bg-accent w-full text-left transition-colors">
                  Input Tools Settings
                </button>
              </div>
            </div>
          )}
        </div> */}
        {currentCategory === "trash" && selectedEmails.length > 0 && (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <button
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                title="Delete permanently"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete email{selectedEmails.length > 1 ? 's' : ''} permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The selected email{selectedEmails.length > 1 ? 's will' : ' will'} be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm'}
                  </button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
