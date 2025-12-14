import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmailAccount } from "@shared/schema";
import { Listbox } from "@headlessui/react";
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
// import SizeDropdownForManage from "@/components/ui/sizedropdownmanage";

export default function ManageMail() {
  const [, params] = useRoute("/manage-mail/:mail_Id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [storageLimit, setStorageLimit] = useState("1024");
  const [storageUnit, setStorageUnit] = useState("MB");
  const [storageType, setStorageType] = useState("limited");
  const [storageError, setStorageError] = useState<string>("");

  const [stayOnPage, setStayOnPage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch only the specific account by mail_Id
  const { data: emailAccount, isLoading } = useQuery({
    queryKey: ["/mails/getMailsByMailId", params?.mail_Id],
    queryFn: async () => {
      if (!params?.mail_Id) return undefined;
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/mails/getMailsByMailId", { mail_id: params.mail_Id, __headers: headers });
      // If the API returns an array, return the first element
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      console.log("mail by id data", response.data);
      return data;
    },
    enabled: !!params?.mail_Id,
  });

  // Map radio values from API data
  let receivingMailValue = "allow";
  if (emailAccount?.incoming_suspend) {
    receivingMailValue = "suspend";
  } else if (emailAccount?.incoming_allow) {
    receivingMailValue = "allow";
  }

  let sendingMailValue = "allow";
  if (emailAccount?.outgoing_suspend) {
    sendingMailValue = "suspend";
  } else if (emailAccount?.outgoing_hold) {
    sendingMailValue = "hold";
  } else if (emailAccount?.outgoing_allow) {
    sendingMailValue = "allow";
  }

  // Local state for restrictions
  const [localReceivingMailValue, setLocalReceivingMailValue] = useState<string>("allow");
  const [localSendingMailValue, setLocalSendingMailValue] = useState<string>("allow");

  useEffect(() => {
    if (emailAccount?.storageAllocated) {
      let value = emailAccount.storageAllocated;
      let num = 0;
      let unit = "MB";
      if (typeof value === "string" && value.toLowerCase().includes("gb")) {
        num = parseFloat(value);
        unit = "GB";
      } else if (typeof value === "string" && value.toLowerCase().includes("mb")) {
        num = parseFloat(value);
        unit = "MB";
      } else if (typeof value === "number") {
        num = value;
        unit = "MB";
      } else {
        num = parseFloat(value) || 0;
        unit = "MB";
      }
      setStorageLimit(num.toString());
      setStorageUnit(unit);
      // Validate and show error if over max
      validateStorageAmount(num, unit);
    }
  }, [emailAccount?.storageAllocated]);

  // Sync local state with API data
  useEffect(() => {
    setLocalReceivingMailValue(receivingMailValue);
    setLocalSendingMailValue(sendingMailValue);
  }, [receivingMailValue, sendingMailValue]);

  console.log("emailAccount object:", emailAccount);
  const userEmail = emailAccount?.userEmail || emailAccount?.data?.userEmail || '-';

  // Use real values from API for storage
  let storageUsed = 0;
  let storageTotal = 0;
  let storageUnitDisplay = "MB";
  if (emailAccount?.storageAllocated) {
    let value = emailAccount.storageAllocated;
    if (typeof value === "string" && value.toLowerCase().includes("gb")) {
      storageTotal = parseFloat(value) * 1024;
      storageUnitDisplay = "GB";
    } else if (typeof value === "string" && value.toLowerCase().includes("mb")) {
      storageTotal = parseFloat(value);
      storageUnitDisplay = "MB";
    } else if (typeof value === "number") {
      storageTotal = value;
      storageUnitDisplay = "MB";
    } else {
      storageTotal = parseFloat(value) || 0;
      storageUnitDisplay = "MB";
    }
  }
  storageUsed = parseFloat(emailAccount?.storageUsed) || 0;
  const storagePercentage = storageTotal > 0 ? (storageUsed / storageTotal) * 100 : 0;

  // Single mutation for updating all mail settings
  const updateMailSettingsMutation = useMutation({
    mutationFn: async (body: any) => {
      return apiRequest("PATCH", "/mails/updateMailSettings", body);
    },
    onSuccess: () => {
      toast({
        title: "Mail settings updated successfully",
        description: "The mail settings have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/mails/getMailsByMailId", params?.mail_Id] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      if (!stayOnPage) {
        setLocation("/");
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Failed to update mail settings. Please try again.";
      setStorageError(message);
      toast({
        title: "Error updating mail settings",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/email-accounts/${params?.mail_Id}`);
    },
    onSuccess: () => {
      toast({
        title: "Email account deleted",
        description: "The email account has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error deleting account",
        description: "Failed to delete the email account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateSettings = () => {
    if (!emailAccount?.mail_Id) return;
    // Compose storageAllocated string (e.g., '500MB', '1GB', '0.5GB')
    let storageAllocated = storageLimit + storageUnit;
    // Prepare restriction fields
    let body: any = { mail_id: emailAccount.mail_Id, storageAllocated };
    // Receiving
    if (localReceivingMailValue === "suspend") {
      body.incoming_allow = false;
      body.incoming_suspend = true;
    } else {
      body.incoming_allow = true;
      body.incoming_suspend = false;
    }
    // Sending
    if (localSendingMailValue === "suspend") {
      body.outgoing_allow = false;
      body.outgoing_suspend = true;
      body.outgoing_hold = false;
    } else if (localSendingMailValue === "hold") {
      body.outgoing_allow = false;
      body.outgoing_suspend = false;
      body.outgoing_hold = true;
    } else {
      body.outgoing_allow = true;
      body.outgoing_suspend = false;
      body.outgoing_hold = false;
    }
    updateMailSettingsMutation.mutate(body);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteEmailInput) return;
    setIsDeleting(true);
    try {
      const response = await apiRequest("DELETE", "/mailboxConfig/deleteUser", { email: deleteEmailInput });
      toast({
        title: "Success",
        description: response.data?.message || "User and all mails deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      setShowDeleteModal(false);
      setDeleteEmailInput("");
      setLocation("/");
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

  const validateStorageAmount = (amount: number, unit: string) => {
    if (unit === "MB" && amount > 1024) {
      setStorageError("Maximum allowed is 1024 MB");
      return false;
    }
    if (unit === "GB" && amount > 1) {
      setStorageError("Maximum allowed is 1 GB");
      return false;
    }
    setStorageError("");
    return true;
  };

  // Add handleCheckEmail logic (same as dashboard)
  const handleCheckEmail = async () => {
    if (!emailAccount?.mail_Id) return;
    try {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/security/generate-token", {
        mail_id: emailAccount.mail_Id,
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
        setLocation(`/mailbox/m/${emailAccount.mail_Id}/inbox`);
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
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffa184] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading email account...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!emailAccount) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="pt-24 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Email Account Not Found
              </h1>
              <Link href="/">
                <Button className="bg-[#ffa184] hover:bg-[#ff8c69] text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Email Accounts
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const options = ["MB", "GB"];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="pt-28 px-4 md:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-900">
                  MANAGE AN EMAIL ACCOUNT
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-white"
                >
                  <HelpCircle className="w-4 h-4 mr-1" />
                  Show/Hide Help
                </Button>
              </div>
            </CardHeader>

            <p className="text-sm text-gray-500 mb-4 px-6">
              Use this section to update, configure, or manage your existing MailX email account settings, including username, domain, and other preferences.
            </p>

            <CardContent className="space-y-6">
              <div className="space-y-6">
                {/* Email Account Info */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Email Account
                    </Label>
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-900">
                      {userEmail}
                    </div>
                    <div className="flex items-center text-[#ffa184] hover:text-[#ff8c69] cursor-pointer" onClick={handleCheckEmail}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      <span className="text-sm text-[#ffa184] hover:underline">Check Email</span>
                    </div>
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium text-gray-700">
                      STORAGE
                    </Label>
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Current Storage Usage
                      </Label>
                      <div className="mt-2">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>{storageUsed} MB / {storageUnitDisplay === "GB" ? (storageTotal / 1024) + " GB" : storageTotal + " MB"}</span>
                          <span>{storagePercentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={storagePercentage} className="h-2" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700 flex items-center">
                        Allocated Storage Space
                        <HelpCircle className="w-4 h-4 ml-1" />
                      </Label>
                      <RadioGroup
                        value={emailAccount.storageAllocated}
                        onValueChange={setStorageType}
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="limited" id="limited" />
                          <Label
                            htmlFor="limited"
                            className="flex items-center gap-2"
                          >
                            <div className="relative-container flex items-center gap-2">
                              <Input
                                type="number"
                                value={storageLimit}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setStorageLimit(value);
                                  validateStorageAmount(
                                    Number(value) || 0,
                                    storageUnit
                                  );
                                }}
                                className={`w-20 ${storageError
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                    : ""
                                  }`}
                                disabled={storageType !== "limited"}
                                min="1"
                                max={storageUnit === "MB" ? 1024 : 1}
                              />

                              {/* Toggle Switch */}
                              <div className="flex items-center space-x-3">
                                {/* <span className="text-sm font-medium text-gray-700">
                                  MB
                                </span> */}

                                <button
                                  onClick={() => {
                                    const newUnit =
                                      storageUnit === "MB" ? "GB" : "MB";
                                    setStorageUnit(newUnit);
                                    validateStorageAmount(
                                      Number(storageLimit) || 0,
                                      newUnit
                                    );
                                  }}
                                  className="relative inline-flex items-center w-14 h-2 bg-gray-200 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#ffa184] focus:ring-offset-2"
                                  title={`Switch to ${storageUnit === "MB" ? "GB" : "MB"
                                    }`}
                                >
                                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#ffa184] via-[#ffc3a0] to-[#ff6b6b] opacity-80"></div>

                                  <div
                                    className={`relative z-10 inline-flex items-center justify-center w-7 h-7 bg-gray-800 rounded-full shadow transform transition-transform duration-300 ease-in-out ${storageUnit === "GB"
                                        ? "translate-x-8"
                                        : "translate-x-0"
                                      }`}
                                  >
                                    <span className="text-xs font-semibold text-white">
                                      {storageUnit}
                                    </span>
                                  </div>
                                </button>

                                {/* <span className="text-sm font-medium text-gray-700">
                                  GB
                                </span> */}
                              </div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                      {storageError && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                !
                              </span>
                            </div>
                            <span className="text-red-600 text-sm font-medium">
                              {storageError}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Restrictions */}
                <div
                  className={`space-y-4 p-4 border rounded-lg ${emailAccount?.incoming_suspend ||
                      emailAccount?.outgoing_suspend ||
                      emailAccount?.outgoing_hold
                      ? "bg-red-50 border-red-200 animate-pulse"
                      : "bg-gray-50 border-gray-200"
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium text-gray-700">
                      RESTRICTIONS
                    </Label>
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Receiving Incoming Mail
                      </Label>
                      <RadioGroup
                        value={localReceivingMailValue}
                        onValueChange={setLocalReceivingMailValue}
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="allow" id="receive-allow" />
                          <Label htmlFor="receive-allow">Allow</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="suspend" id="receive-suspend" />
                          <Label htmlFor="receive-suspend">Suspend</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Sending Outgoing Email
                      </Label>
                      <RadioGroup
                        value={localSendingMailValue}
                        onValueChange={setLocalSendingMailValue}
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="allow" id="send-allow" />
                          <Label htmlFor="send-allow">Allow</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="suspend" id="send-suspend" />
                          <Label htmlFor="send-suspend">Suspend</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="hold" id="send-hold" />
                          <Label htmlFor="send-hold">Hold</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>

                {/* Update Settings */}
                <div className="space-y-4">
                  <div className="md:flex md:items-center space-x-2 mb-4">
                    <Checkbox
                      id="stay-on-page"
                      checked={stayOnPage}
                      onCheckedChange={(checked) =>
                        setStayOnPage(checked as boolean)
                      }
                      className="data-[state=checked]:bg-[#ffa184] w-3 h-3 data-[state=checked]:border-[#ffa184]"
                    />
                    <Label
                      htmlFor="stay-on-page"
                      className="text-sm text-gray-700"
                    >
                      Stay on this page after I click{" "}
                      <em>Update Email Settings</em>.
                    </Label>
                  </div>

                  <div className="md:flex md:items-center justify-between pt-4">
                    <Button
                      onClick={handleUpdateSettings}
                      disabled={updateMailSettingsMutation.isPending}
                      className="bg-[#ffa184] hover:bg-[#ff8c69] text-white px-6"
                    >
                      {updateMailSettingsMutation.isPending ? "Updating..." : "Update Email Settings"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setLocation("/")}
                      className="text-[#ffa184] hover:text-[#ff8c69] hover:bg-[#ffa184]/10"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Go Back
                    </Button>
                  </div>
                </div>

                {/* Delete Email Account */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium text-red-600">
                      DELETE EMAIL ACCOUNT
                    </Label>
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">
                        Are you sure? When you delete an email account, we permanently delete all of the account's data.
                      </p>
                    </div>
                    {/* Delete Modal Trigger and Modal */}
                    <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                      <AlertDialogTrigger asChild>
                        <Button
                          onClick={handleDeleteAccount}
                          disabled={deleteAccountMutation.isPending}
                          variant="destructive"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {deleteAccountMutation.isPending ? "Deleting..." : "Delete Email Account"}
                        </Button>
                      </AlertDialogTrigger>
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer/>
    </div>
  );
}
