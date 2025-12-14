import { useState } from "react";
import { BsChatSquare, BsGear } from 'react-icons/bs';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link as RouterLink } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Plus,
  Trash2,
  Settings,
  Mail,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailAccount } from "@shared/schema";
type EmailAccountWithMailId = EmailAccount & { mail_Id: string; restriction_status?: string; health: boolean; health_info: string };
import FilterDropdown from "@/components/ui/filter-dropdown";
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
import Loader from "@/components/ui/Loader";

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState("All");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Maximum number of email accounts allowed
  const MAX_EMAIL_ACCOUNTS = 5;

  // Fetch email accounts
  const { data: emailAccounts = [], isLoading } = useQuery({
    queryKey: ["/api/email-accounts"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/mails/getMailsdashboard", {
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Map API response to EmailAccountWithMailId shape
      const mails = response.data.allMails || [];
      // Filter out deleted users
      const filteredMails = mails.filter((mail: any) => mail.userDeleteStatus !== 'Active');
      return filteredMails.map((mail: any) => {
        // Convert storage strings like "5GB" or "0GB" to MB
        function parseStorage(str: string) {
          if (!str) return 0;
          const match = str.match(/([\d.]+)\s*(GB|MB)/i);
          if (!match) return 0;
          const value = parseFloat(match[1]);
          const unit = match[2].toUpperCase();
          return unit === "GB" ? value * 1024 : value;
        }
        const storageAllocated = parseStorage(mail.storageAllocated);
        const storageUsed = parseStorage(mail.storageUsed);
        const storagePercentage = storageAllocated > 0 ? (storageUsed / storageAllocated) * 100 : 0;
        return {
          id: mail.id,
          mail_Id: mail.mail_Id, // <-- include mail_Id
          email: mail.userEmail,
          domain: mail.userEmail.split("@")[1] || "",
          restriction_status: mail.restriction_status || "unrestricted",
          storageUsed: storageUsed ?? null,
          storageAllocated: storageAllocated ?? null,
          storagePercentage: storagePercentage ?? null,
          health: mail.health ?? true, // 👈 NEW
          health_info: mail.health_info ?? "", // 👈 NEW
        };
      });
    },
  });

  // Check if the limit has been reached
  const isLimitReached = emailAccounts.length >= MAX_EMAIL_ACCOUNTS;
  const remainingAccounts = MAX_EMAIL_ACCOUNTS - emailAccounts.length;

  // Delete email account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/email-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({
        title: "Success",
        description: "Email account deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete email account",
        variant: "destructive",
      });
    },
  });

  // Filter accounts based on search term and filter type
  const filteredAccounts = emailAccounts.filter((account: EmailAccountWithMailId) => {
    const matchesSearch =
      searchTerm === "" ||
      account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.domain.toLowerCase().includes(searchTerm.toLowerCase());
    const isAccountRestricted = account.restriction_status !== "unrestricted";
    const matchesFilter =
      filterType === "All" ||
      (filterType === "Restricted" && isAccountRestricted) ||
      (filterType === "System Account" && account.domain.includes("system")) ||
      (filterType === "Exceeded Storage" && (account.storagePercentage ?? 0) > 80);
    return matchesSearch && matchesFilter;
  });

  const totalAccounts = filteredAccounts.length;
  const accountsPerPage = 10;
  const totalPages = Math.ceil(totalAccounts / accountsPerPage);

  // Update current page when search/filter changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setFilterType(value);
    setCurrentPage(1);
  };

  const startIndex = (currentPage - 1) * accountsPerPage;
  const endIndex = startIndex + accountsPerPage;
  const currentAccounts: EmailAccountWithMailId[] = filteredAccounts.slice(startIndex, endIndex);

  const handleSelectAccount = (accountId: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === currentAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(
        currentAccounts.map((account: EmailAccountWithMailId) => account.id)
      );
    }
  };

  const handleDeleteSelected = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteEmailInput) return;
    setIsDeleting(true);
    try {
      const response = await apiRequest("POST", "/mails/deleteUser", { email: deleteEmailInput });
      toast({
        title: "Success",
        description: response.data?.message || "User and all mails deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      setShowDeleteModal(false);
      setDeleteEmailInput("");
      setSelectedAccounts([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete user.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatStorage = (used: number, allocated: number) => {
    const usedStr =
      used >= 1024 ? `${(used / 1024).toFixed(2)} GB` : `${used.toFixed(2)} MB`;
    const allocatedStr =
      allocated >= 1024
        ? `${(allocated / 1024).toFixed(0)} GB`
        : `${allocated.toFixed(0)} MB`;
    return `${usedStr} / ${allocatedStr}`;
  };

  const getStoragePercentage = (used: number, allocated: number) => {
    return (used / allocated) * 100;
  };

  const filterOptions = [
    { value: "All", label: "All" },
    { value: "Restricted", label: "Restricted" },
    { value: "System Account", label: "System Account" },
    { value: "Exceeded Storage", label: "Exceeded Storage" },
  ];

  // Function to handle Check Email (generate token)
  const handleCheckEmail = async (mailId: string, accountId: number) => {
    try {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/security/generate-token", {
        mail_id: mailId,
        __headers: headers,
      });
      const token = response.data?.token;
      if (token) {
        localStorage.setItem("authtoken", token);
        // Set expiry time to 1 hour from now
        const expiry = Date.now() + 60 * 60 * 1000;
        localStorage.setItem("authtoken_expiry", expiry.toString());
        toast({
          title: "Success",
          description: "Access granted to mailbox.",
        });
        setLocation(`/mailbox/m/${mailId}/inbox`);
      } else {
        throw new Error("No token returned from API");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to generate token.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-16 flex items-center justify-center min-h-screen">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mb-2">
                <span className="font-semibold text-red-600">Warning:</span> This action will <b>permanently delete</b> the selected user account, all mails, and all related data. This cannot be undone.<br />
                Please enter the email address you want to delete to confirm.
              </div>
              <Input
                type="email"
                placeholder="Enter email to delete"
                value={deleteEmailInput}
                onChange={e => setDeleteEmailInput(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={!deleteEmailInput || isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main
        className="flex-1 pt-16 p-4">
        <div className="max-w-[24rem] md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto py-8">
          <div className="mb-8">
            <p className="text-gray-700 mb-8 leading-relaxed text-justify" data-testid="text-intro">
              <span className="font-semibold text-lg text-[#ffa184]">MailX</span> is a secure and efficient email platform designed to simplify communication for businesses and individuals. With AI-powered features, it can intelligently organize emails, suggest responses, and automate workflows, making communication faster and more effective while ensuring data safety and seamless integration with other tools.
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-page-title">
              Email Accounts
            </h1>
            <p className="text-gray-600 mb-4" data-testid="text-page-description">List Email Accounts</p>
          </div>

          {/* Search Section and Stats Card */}
          <div className="mb-6 flex flex-col lg:flex-row gap-6">
            {/* Search and Filter Section */}
            {currentAccounts.length > 0 ? (
              <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by email or domain..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 focus:ring-2 focus:ring-[#ffa184] !ring-[#ffa184] focus:border-[#ffa184]"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSearchChange("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center relative space-x-2">
                  <span className="text-sm text-gray-700">Filter:</span>
                  <FilterDropdown filterType={filterType} setFilterType={setFilterType} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex-1 max-w-md"></div>
              </div>
            )}

            {/* Stats Card */}
            <Card className="bg-white shadow-sm lg:w-1/3">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 ${isLimitReached ? "bg-red-500" : "bg-green-500"} rounded-full`}></div>
                      <span className="text-sm font-medium text-gray-700">
                        Available
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {MAX_EMAIL_ACCOUNTS - emailAccounts.length}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#ffa184] rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Used
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {emailAccounts.length}
                    </div>
                    <div className="text-sm text-gray-500">of {MAX_EMAIL_ACCOUNTS}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Limit Warning */}
          {isLimitReached && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <span className="text-red-700 text-sm font-medium">
                  Maximum limit of {MAX_EMAIL_ACCOUNTS} email accounts reached.
                  Please delete existing accounts to create new ones or increase
                  the email limit by adding mail in Aibams portal.
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mb-4 flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedAccounts.length === 0}
                className="text-red-600 border-red-200 rounded-full hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
            <div className="flex-1"></div>
            <Button
              className={`${isLimitReached
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-[#ffa184] text-white hover:bg-[#ff8c69]"
                } rounded-full text-sm`}
              size="sm"
              onClick={() => setLocation("/new-mail")}
              disabled={isLimitReached}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isLimitReached ? "Limit Reached" : "Create"}
            </Button>
          </div>

          {/* Search Results Indicator */}
          {(searchTerm || filterType !== "All") && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-blue-700 text-sm">
                  {searchTerm
                    ? `Search results for "${searchTerm}"`
                    : `Filtered by: ${filterType}`}
                  {` - ${filteredAccounts.length} account${filteredAccounts.length !== 1 ? "s" : ""
                    } found`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleSearchChange("");
                    handleFilterChange("All");
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Email Accounts Table */}
          <Card className="bg-white shadow-sm">
            {currentAccounts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-500 mb-4">
                  <Mail className="w-12 h-12 mx-auto mb-2" />
                  {searchTerm || filterType !== "All" ? (
                    <p className="text-lg">
                      No email accounts found matching your search criteria.
                    </p>
                  ) : (
                    <p className="text-md">No email accounts created yet.</p>
                  )}
                </div>
                {!searchTerm && filterType === "All" && (
                  <Button
                    onClick={() => setLocation("/new-mail")}
                    className="bg-[#f98c6bd3] hover:bg-[#ff8c69] rounded-full text-sm text-white px-4 sm:px-6"
                    disabled={isLimitReached}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline text-white">Create Your First Email Account</span>
                    <span className="inline sm:hidden text-white">Create Account</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left p-4 w-12">
                        <Checkbox
                          checked={
                            selectedAccounts.length ===
                            currentAccounts.length &&
                            currentAccounts.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-900">
                        Account @ Domain
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-900">
                        Restrictions
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-900">
                        Storage: Used / Allocated / %
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAccounts.map((account: EmailAccountWithMailId) => (
                      <tr
                        key={account.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${account.health === false
                                ? "bg-red-50 hover:bg-red-100/50"
                                : "text-[#ffa184]"
                                }`}
                      >
                        <td className="p-4">
                          <Checkbox
                            checked={selectedAccounts.includes(account.id)}
                            onCheckedChange={() =>
                              handleSelectAccount(account.id)
                            }
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {account.email}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {account.restriction_status !== "unrestricted" ? (
                            <Badge
                              variant="secondary"
                              className="bg-red-100 text-red-800 border-red-200"
                            >
                              ⚠ Restricted
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800 border-green-200"
                            >
                              ✓ Unrestricted
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            <div className="text-sm text-gray-900">
                              {formatStorage(
                                account.storageUsed ?? 0,
                                account.storageAllocated ?? 0
                              )}{" "}
                              / {(account.storagePercentage ?? 0).toFixed(2)}%
                            </div>
                            <Progress
                              value={getStoragePercentage(
                                account.storageUsed ?? 0,
                                account.storageAllocated ?? 0
                              )}
                              className="h-2"
                            />
                          </div>
                        </td>
                        <td className="">
                          <div className="flex items-center space-x-2">
                            {/* Check Email button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className={`text-[#ffa184] border-[#ffa184] hover:bg-[#ffa184] hover:text-white ${account.health === false
                                ? "text-gray-400 border-gray-400 opacity-60 cursor-not-allowed"
                                : "text-[#ffa184]"
                                }`}
                              onClick={() => account.health && handleCheckEmail(account.mail_Id, account.id)}
                              disabled={account.health === false}
                            >
                              <BsChatSquare size={10} />
                              Check Email
                            </Button>

                            {/* Manage button */}
                            <RouterLink href={`/manage-mail/${account.mail_Id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`text-[#ffa184] border-[#ffa184] hover:bg-[#ffa184] hover:text-white ${account.health === false
                                ? "text-gray-400 border-gray-400 opacity-60 cursor-not-allowed"
                                : "text-[#ffa184]"
                                }`}
                              >
                                <BsGear size={10} />
                                Manage
                              </Button>
                            </RouterLink>

                            {/* Health info ? icon */}
                            {!account.health && account.health_info && (
                              <SmartTooltip text={account.health_info}>
                                <div className="relative flex items-center justify-center w-5 h-5">
                                  <span
                                    className="text-red-500 border border-red-400 rounded-full w-5 h-5 
                   flex items-center justify-center text-xs font-semibold cursor-pointer"
                                  >
                                    ?
                                  </span>
                                </div>
                              </SmartTooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalAccounts > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-200">
                <div className="flex items-center text-xs sm:text-sm text-gray-700">
                  <span>
                    Showing {startIndex + 1} to{" "}
                    {Math.min(startIndex + accountsPerPage, totalAccounts)} of{" "}
                    {totalAccounts} results
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || totalPages <= 1}
                    className="text-gray-500 border-gray-300 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={
                            currentPage === pageNum
                              ? "bg-[#ffa184] text-white hover:bg-[#ff8c69]"
                              : "text-gray-500 border-gray-300 hover:bg-gray-50"
                          }
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages || totalPages <= 1}
                    className="text-gray-500 border-gray-300 hover:bg-gray-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
