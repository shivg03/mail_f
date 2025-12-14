import { useState, useEffect, useRef } from 'react';
import { X, Check, Mail, Trash, RefreshCw, MoreHorizontal, Paperclip, FileText } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Loader from '@/components/ui/Loader';
import { useToast } from '@/hooks/use-toast';

interface Email {
  id: number;
  emailUniqueId: string;
  from: string;
  to: string;
  subject: string;
  date?: string;
  sendMail_Id?: string;
  threadId?: string;
}

interface EmailListModalProps {
  onClose: () => void;
}

// Dummy email data for demonstration
const dummyEmails: Email[] = [
  {
    id: 1,
    emailUniqueId: 'email1',
    from: 'John Doe <john.doe@example.com>',
    to: 'me@fusionmail.com',
    subject: 'Meeting tomorrow at 10 AM',
    date: '2023-11-15T10:30:00',
    threadId: 'thread1'
  },
  {
    id: 2,
    emailUniqueId: 'email2',
    from: 'Sarah Johnson <sarah.j@company.org>',
    to: 'me@fusionmail.com',
    subject: 'Project proposal review',
    date: '2023-11-14T14:45:00',
    threadId: 'thread2'
  },
  {
    id: 3,
    emailUniqueId: 'email3',
    from: 'Marketing Team <marketing@newsletter.com>',
    to: 'me@fusionmail.com',
    subject: 'Weekly newsletter: Latest updates',
    date: '2023-11-14T09:15:00',
    threadId: 'thread3'
  },
  {
    id: 4,
    emailUniqueId: 'email4',
    from: 'Alex Williams <alex.w@client.net>',
    to: 'me@fusionmail.com',
    subject: 'Feedback on recent deliverables',
    date: '2023-11-13T16:20:00',
    threadId: 'thread4'
  },
  {
    id: 5,
    emailUniqueId: 'email5',
    from: 'HR Department <hr@company.org>',
    to: 'me@fusionmail.com',
    subject: 'Important: Benefits enrollment deadline',
    date: '2023-11-12T11:05:00',
    threadId: 'thread5'
  }
];

// Dummy auto-drafted emails for demonstration
const dummyDraftedEmails = [
  {
    id: 101,
    emailUniqueId: 'draft1',
    to: 'john.doe@example.com',
    from: 'me@fusionmail.com',
    subject: 'Re: Meeting tomorrow at 10 AM',
    date: '2023-11-15T11:00:00',
    originalEmailId: 'email1',
    content: 'Thank you for your email. I will attend the meeting tomorrow at 10 AM.',
    isDraft: true
  },
  {
    id: 102,
    emailUniqueId: 'draft2',
    to: 'sarah.j@company.org',
    from: 'me@fusionmail.com',
    subject: 'Re: Project proposal review',
    date: '2023-11-14T15:30:00',
    originalEmailId: 'email2',
    content: 'I have reviewed the project proposal and will provide my feedback soon.',
    isDraft: true
  },
  {
    id: 103,
    emailUniqueId: 'draft3',
    to: 'alex.w@client.net',
    from: 'me@fusionmail.com',
    subject: 'Re: Feedback on recent deliverables',
    date: '2023-11-13T17:00:00',
    originalEmailId: 'email4',
    content: 'Thank you for your feedback. I will address the points you mentioned and get back to you.',
    isDraft: true
  }
];

export default function EmailListModal({ onClose }: EmailListModalProps) {
  const [includedEmails, setIncludedEmails] = useState<Email[]>([]);
  const [nonIncludedEmails, setNonIncludedEmails] = useState<Email[]>([]);
  const [draftedEmails, setDraftedEmails] = useState<any[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [showDropdownDetails, setShowDropdownDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [modalAttachment, setModalAttachment] = useState<File | null>(null);
  const { toast } = useToast();

  // Initialize emails
  useEffect(() => {
    const timer = setTimeout(() => {
      setNonIncludedEmails(dummyEmails);
      setDraftedEmails(dummyDraftedEmails);
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Simulate refetch
  const refetch = () => {
    setIsLoading(true);
    setTimeout(() => {
      // Keep currently included emails, reset non-included
      const currentIncludedIds = includedEmails.map(email => email.emailUniqueId);
      const newNonIncluded = dummyEmails.filter(
        email => !currentIncludedIds.includes(email.emailUniqueId)
      );
      setNonIncludedEmails(newNonIncluded);
      setIsLoading(false);
    }, 1000);
  };

  // Mock draft email creation (for demonstration)
  const createDraftMutation = {
    mutate: ({ to, subject, email }: { to: string; subject: string; email: Email }) => {
      // Simulate API call delay
      setTimeout(() => {
        console.log('Creating draft email to:', to, 'with subject:', `Re: ${subject}`);

        // Create a new draft email and add it to the list
        const newDraft = {
          id: Math.floor(Math.random() * 1000) + 200,
          emailUniqueId: `draft-${Date.now()}`,
          to: to,
          from: 'me@fusionmail.com',
          subject: `Re: ${subject}`,
          date: new Date().toISOString(),
          originalEmailId: email.emailUniqueId,
          content: `Thank you for your email. I will get back to you soon.`,
          isDraft: true
        };

        setDraftedEmails(prev => [newDraft, ...prev]);

        // Show success toast
        toast({
          title: 'Draft Created',
          description: 'Email draft has been created successfully',
        });
      }, 500);
    },
    isLoading: false
  };

  // Handle checkbox change to move email between sections
  const handleCheckboxChange = (email: Email, checked: boolean) => {
    if (checked) {
      // Move from non-included to included
      setIncludedEmails(prev => [...prev, email]);
      setNonIncludedEmails(prev => prev.filter(e => e.emailUniqueId !== email.emailUniqueId));

      // Create a draft email when checked
      createDraftMutation.mutate({
        to: extractEmailAddress(email.from),
        subject: email.subject,
        email: email
      });
    } else {
      // Move from included to non-included
      removeFromIncluded(email);
    }
  };

  // Remove email from included list and move back to non-included
  const removeFromIncluded = (email: Email) => {
    setIncludedEmails(prev => prev.filter(e => e.emailUniqueId !== email.emailUniqueId));
    setNonIncludedEmails(prev => [...prev, email]);
  };

  // Extract email address from "Name <email@example.com>" format
  const extractEmailAddress = (from: string) => {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1] : from;
  };

  // Format sender name
  const formatSenderName = (from: string) => {
    const match = from.match(/^([^<]+)/);
    return match ? match[1].trim() : from;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 w-full h-full flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between py-[6px] px-2 border-b bg-gradient-to-r from-[#ffa184] to-[#ff6b6b]">
          <h2 className="text-xl font-semibold text-white">Email Auto-Draft Setup</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-full hover:bg-white/20 text-white"
              title="Refresh emails"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Included and Non-Included Emails */}
          <div className="w-1/4 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
            {/* Included Emails Section */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Included Emails</h3>
                <p className="text-sm text-gray-500 mb-4">Emails in this section will have auto-draft replies created</p>

                {includedEmails.length > 0 ? (
                  <div className="space-y-2 max-h-[30vh] overflow-y-auto p-2">
                    {includedEmails.map((email) => (
                      <div
                        key={email.emailUniqueId}
                        className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#ffa184]">{extractEmailAddress(email.from)}</span>
                            <button
                              onClick={() => removeFromIncluded(email)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              title="Remove from included emails"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Auto-draft will be created for new emails from this address
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-md">
                    <p className="text-center">No emails included yet. Select emails from below to enable auto-drafting.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Non-Included Emails Section */}
            <div className="flex-1 overflow-hidden">
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Available Email Addresses</h3>

                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader />
                  </div>
                ) : nonIncludedEmails.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 450px)' }}>
                    {nonIncludedEmails.map((email) => (
                      <div
                        key={email.emailUniqueId}
                        className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-shrink-0 mr-4">
                          <input
                            type="checkbox"
                            checked={includedEmails.some(included => included.emailUniqueId === email.emailUniqueId)}
                            onChange={(e) => handleCheckboxChange(email, e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 accent-[#ffa184]"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <span className="font-medium">{extractEmailAddress(email.from)}</span>
                            <span className="ml-auto text-sm text-gray-500">{formatDate(email.date)}</span>
                          </div>
                          <div className="text-sm text-gray-500 truncate">{formatSenderName(email.from)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Mail className="w-12 h-12 mb-2" />
                    <p>No email addresses available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Auto-Drafted Emails */}
          <div className="w-3/4 p-4 bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200">Auto-Drafted by Fusion AI</h3>
                <p className="text-sm text-gray-500">Drafts for emails from included senders</p>
              </div>
              {selectedDraft && (
                <button
                  onClick={() => {
                    setSelectedDraft(null);
                    setShowDropdownDetails(false);
                    setIsEditing(false);
                    setShowAttachmentModal(false);
                  }}
                  className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  <X className="w-3 h-3 mr-1" /> Back to List
                </button>
              )}
            </div>

            {selectedDraft ? (
              // Detailed view of the selected draft - Using EmailDetail.tsx style
              <div className="flex flex-col h-full min-h-0 overflow-y-auto flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex-1 overflow-y-auto px-6 pb-4">
                  <div className="mx-auto">
                    {/* Subject */}
                    <div className="mb-4 mt-4">
                      <h1 className="text-2xl font-medium text-foreground">
                        {selectedDraft.subject}
                      </h1>
                    </div>

                    {/* Email Content - Similar to EmailDetail.tsx */}
                    <div className="mb-8 pb-4 border-b border-border last:border-b-0">
                      {/* Header (always visible, clickable) */}
                      <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 bg-[#ffa184] rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                            {selectedDraft.from.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground truncate">
                              <span className="text-muted-foreground">from </span>
                              {selectedDraft.from}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <span className="text-muted-foreground">to </span>
                              {selectedDraft.to}
                              <button className="ml-1" onClick={(e) => {
                                e.stopPropagation();
                                // Toggle dropdown details
                                setShowDropdownDetails(!showDropdownDetails);
                              }}>
                                <MoreHorizontal className="w-5 h-5 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <div className="text-sm text-muted-foreground hidden sm:block">
                            {new Date(selectedDraft.date).toLocaleString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {new Date(selectedDraft.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full flex items-center">
                            <Check className="w-3 h-3 mr-1" />
                            <span>Draft</span>
                          </div>
                        </div>
                      </div>

                      {/* Dropdown with details */}
                      {showDropdownDetails && (
                        <div className="bg-gray-50 border-l border-r border-b border-gray-100 rounded p-4 mb-2 text-sm">
                          <div><b className="text-muted-foreground">from:</b> {selectedDraft.from}</div>
                          <div><b className="text-muted-foreground">to:</b> {selectedDraft.to}</div>
                          <div><b className="text-muted-foreground">date:</b> {selectedDraft.date ? new Date(selectedDraft.date).toLocaleString() : ""}</div>
                          <div><b className="text-muted-foreground">subject:</b> {selectedDraft.subject}</div>
                          <div><b className="text-muted-foreground">status:</b> Auto-drafted</div>
                        </div>
                      )}

                      {/* Body */}
                      <div className="max-w-none text-foreground leading-relaxed text-base email-body px-4 pt-4 pb-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              className="w-full min-h-[200px] p-3 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#ffa184]"
                            />

                            {/* Attachments section */}
                            <div className="mt-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Paperclip className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Attachments</span>
                              </div>

                              {/* Display current attachments */}
                              {attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {attachments.map((file, index) => (
                                    <div key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                                      <span className="truncate max-w-[150px]">{file.name}</span>
                                      <button
                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add attachment button */}
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <Paperclip className="w-3 h-3" />
                                Add Attachment
                              </button>
                              <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={(e) => {
                                  if (e.target.files) {
                                    const newFiles = Array.from(e.target.files);
                                    setAttachments(prev => [...prev, ...newFiles]);
                                  }
                                }}
                              />
                            </div>

                            {/* Save/Cancel buttons */}
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => {
                                  // Update the draft with edited content and attachments
                                  const updatedDraft = {
                                    ...selectedDraft,
                                    content: editedContent,
                                    attachments: attachments
                                  };

                                  // Update in the drafts list
                                  setDraftedEmails(prev =>
                                    prev.map(draft =>
                                      draft.emailUniqueId === selectedDraft.emailUniqueId ? updatedDraft : draft
                                    )
                                  );

                                  // Update selected draft
                                  setSelectedDraft(updatedDraft);
                                  setIsEditing(false);

                                  // Show success toast
                                  toast({
                                    title: "Draft Updated",
                                    description: "Your draft has been updated successfully",
                                  });
                                }}
                                className="px-3 py-1 text-xs bg-[#ffa184] hover:bg-[#fd9474] text-white rounded"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditing(false);
                                  setEditedContent(selectedDraft.content);
                                }}
                                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">
                            {selectedDraft.content}
                          </div>
                        )}

                        {/* Display attachments if any and not in editing mode */}
                        {!isEditing && selectedDraft.attachments && selectedDraft.attachments.length > 0 && (
                          <div className="mt-4 border-t pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Paperclip className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">Attachments ({selectedDraft.attachments.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedDraft.attachments.map((file: File, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                  onClick={() => {
                                    setModalAttachment(file);
                                    setShowAttachmentModal(true);
                                  }}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  <span className="truncate max-w-[150px]">{file.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer always at the bottom of the email details area */}
                {!isEditing && (
                  <div className="border-t bg-white dark:bg-black z-10">
                    <div className="mx-auto px-2 lg:px-2 py-2 flex gap-2 justify-start">
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setEditedContent(selectedDraft.content);
                          // Initialize attachments from the draft if they exist
                          if (selectedDraft.attachments) {
                            setAttachments(selectedDraft.attachments);
                          } else {
                            setAttachments([]);
                          }
                        }}
                        className="flex items-center gap-1 px-4 py-2 text-xs bg-[#ffa184] hover:bg-[#fd9474] text-white rounded transition-colors"
                      >
                        Edit Draft
                      </button>
                      <button
                        onClick={() => {
                          // Show success toast
                          toast({
                            title: "Email Sent",
                            description: "Your email has been sent successfully",
                          });
                          // Remove the draft from the list
                          setDraftedEmails(prev => prev.filter(draft => draft.emailUniqueId !== selectedDraft.emailUniqueId));
                          // Return to the list view
                          setSelectedDraft(null);
                          setShowDropdownDetails(false);
                          setShowAttachmentModal(false);
                        }}
                        className="flex items-center gap-1 px-4 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                      >
                        Send Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : includedEmails.length > 0 ? (
              <>
                {/* Filter drafts to only show those related to included emails */}
                {(() => {
                  // Get email addresses from included emails
                  const includedAddresses = includedEmails.map(email => extractEmailAddress(email.from));

                  // Filter drafts to only show those sent to included addresses
                  const relevantDrafts = draftedEmails.filter(draft =>
                    includedAddresses.includes(draft.to)
                  );

                  return relevantDrafts.length > 0 ? (
                    <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                      {relevantDrafts.map((draft) => (
                        <div
                          key={draft.emailUniqueId}
                          className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center cursor-pointer"
                          onClick={() => {
                            setSelectedDraft(draft);
                            setShowDropdownDetails(false);
                            setIsEditing(false);
                            setShowAttachmentModal(false);
                          }}
                        >
                          <div>
                            <div className="text-sm text-gray-500">To: {draft.to}</div>
                            <div className="font-medium text-[#ff6b6b]">{draft.subject}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <span className="text-xs text-gray-500 mr-2">{new Date(draft.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full flex items-center">
                                <Check className="w-3 h-3 mr-1" />
                                <span>Draft</span>
                              </div>
                            </div>
                            <div className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              View
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
                      <Mail className="w-16 h-16 text-gray-400 mb-4" />
                      <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Drafts For Selected Emails</h4>
                      <p className="text-gray-500 text-center max-w-md">
                        You've included email addresses, but no drafts have been created yet.
                      </p>
                      <p className="text-gray-500 text-center mt-2">
                        Drafts will appear here when you receive new emails from these senders.
                      </p>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
                <Mail className="w-16 h-16 text-gray-400 mb-4" />
                <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Emails Included Yet</h4>
                <p className="text-gray-500 text-center max-w-md">
                  Select emails from the left panel to see their auto-drafted replies here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-2 py-2 border-t flex justify-between items-center bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {includedEmails.length} email address{includedEmails.length !== 1 ? 'es' : ''} included for auto-drafting
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-gradient-to-r from-[#ffa184] to-[#ff6b6b] text-white rounded-md hover:opacity-90 transition-opacity"
          >
            Save & Close
          </button>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {showAttachmentModal && modalAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">{modalAttachment.name}</h3>
              <button
                onClick={() => setShowAttachmentModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {modalAttachment.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(modalAttachment)}
                  alt={modalAttachment.name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">{modalAttachment.name}</p>
                  <p className="text-sm text-gray-500 mb-4">{(modalAttachment.size / 1024).toFixed(2)} KB</p>
                  <a
                    href={URL.createObjectURL(modalAttachment)}
                    download={modalAttachment.name}
                    className="px-4 py-2 bg-[#ffa184] hover:bg-[#fd9474] text-white rounded transition-colors"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};