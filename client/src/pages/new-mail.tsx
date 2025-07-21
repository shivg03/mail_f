import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { HelpCircle, ChevronDown, ArrowLeft, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertEmailAccountSchema } from "@shared/schema";

const passwordSchema = z
  .string()
  .min(16, "Password must be exactly 16 characters")
  .max(16, "Password must be exactly 16 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    "Password must contain at least one special character"
  );

const createEmailAccountSchema = insertEmailAccountSchema
  .omit({ email: true })
  .extend({
    username: z.string().min(1, "Username is required"),
    password: z.string().optional(),
    passwordOption: z.enum(["set-now", "send-link"]),
    storageAmount: z.number().min(1, "Storage amount is required"),
    storageUnit: z.enum(["MB", "GB"]),
    storageOption: z.enum(["limited", "unlimited"]),
    autoCreateFolders: z.boolean(),
    autoCreateFoldersOption: z.enum(["create", "do-not-create"]),
    sendWelcomeEmail: z.boolean(),
    stayOnPage: z.boolean(),
  })
  .refine(
    (data) => {
      // Password validation - only required if passwordOption is "set-now"
      if (data.passwordOption === "set-now") {
        if (!data.password) {
          return false;
        }
        // Check password requirements
        if (data.password.length !== 16) {
          return false;
        }
        if (!/[A-Z]/.test(data.password)) {
          return false;
        }
        if (!/[a-z]/.test(data.password)) {
          return false;
        }
        if (!/[0-9]/.test(data.password)) {
          return false;
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(data.password)) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "Password must be exactly 16 characters and contain at least one uppercase letter, lowercase letter, number, and special character",
      path: ["password"],
    }
  )
  .refine(
    (data) => {
      if (data.storageUnit === "MB" && data.storageAmount > 1024) {
        return false;
      }
      if (data.storageUnit === "GB" && data.storageAmount > 1) {
        return false;
      }
      return true;
    },
    {
      message: "Maximum allowed: 1024 MB or 1 GB",
      path: ["storageAmount"],
    }
  );

type CreateEmailAccountForm = z.infer<typeof createEmailAccountSchema>;

export default function NewMail() {
  const [, setLocation] = useLocation();
  const [storageError, setStorageError] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateSecurePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;':\",./<>?";

    // Ensure at least one character from each category
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill remaining 12 characters with random mix
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = 0; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to randomize the order
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  const form = useForm<CreateEmailAccountForm>({
    resolver: zodResolver(createEmailAccountSchema),
    defaultValues: {
      domain: "aibams.com",
      username: "",
      password: "",
      passwordOption: "set-now",
      storageAmount: 1024,
      storageUnit: "MB",
      storageOption: "limited",
      autoCreateFolders: true,
      autoCreateFoldersOption: "create",
      sendWelcomeEmail: true,
      stayOnPage: false,
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: CreateEmailAccountForm) => {
      // Use the new API endpoint and body
      const payload = {
        username: `${data.username}@${data.domain}`,
        password: data.password || '',
      };
      console.log("Sending mailboxConfig data:", payload);
      const response = await apiRequest(
        "POST",
        "/mailboxConfig/create",
        payload
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      if (data && data.mailboxdata) {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({
        title: "Success",
        description: "Email account created successfully",
      });

      if (!variables.stayOnPage) {
        setLocation("/");
      } else {
        form.reset();
        }
      } else {
        toast({
          title: "Error",
          description: data?.message || "Failed to create email account",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create email account",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateEmailAccountForm) => {
    console.log("onSubmit called with data:", data);
    console.log("Form errors:", form.formState.errors);
    createAccountMutation.mutate(data);
  };

  const handleGoBack = () => {
    setLocation("/");
  };

  const handleUsernameChange = (username: string) => {
    // Generate password only if username is provided and password is empty
    if (username.trim() && !form.getValues("password")) {
      const newPassword = generateSecurePassword();
      form.setValue("password", newPassword);
    }
  };

  const resetSettings = () => {
    form.setValue("storageAmount", 1024);
    form.setValue("storageUnit", "MB");
    form.setValue("storageOption", "limited");
    form.setValue("autoCreateFolders", true);
    form.setValue("autoCreateFoldersOption", "create");
    form.setValue("sendWelcomeEmail", true);
    setStorageError("");
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

  const options = ["MB", "GB"];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-16 px-4 md:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold text-gray-900">
                  CREATE AN EMAIL ACCOUNT
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {/* Domain Field */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label
                        htmlFor="domain"
                        className="text-sm font-medium text-gray-700"
                      >
                        Domain <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative group">
                        <HelpCircle
                          className="w-4 h-4 text-gray-400 cursor-pointer"
                          tabIndex={0}
                          aria-label="Domain help"
                          onClick={(e) => {
                            const tooltip = e.currentTarget
                              .nextSibling as HTMLElement;
                            if (tooltip) {
                              tooltip.style.display =
                                tooltip.style.display === "block"
                                  ? "none"
                                  : "block";
                            }
                          }}
                          onBlur={(e) => {
                            const tooltip = e.currentTarget
                              .nextSibling as HTMLElement;
                            if (tooltip) {
                              tooltip.style.display = "none";
                            }
                          }}
                        />
                        <div
                          className="absolute left-1/2 z-10 mt-2 w-40 -translate-x-1/2 rounded bg-gray-900 px-3 py-2 text-[11px] text-white shadow-lg"
                          style={{ display: "none" }}
                        >
                          Domain of Fusion Suite.
                        </div>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              value="aibams.com"
                              readOnly
                              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none text-sm cursor-not-allowed"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-[11px] text-gray-500">
                      This will be your Fusion Mail domain.
                    </p>
                  </div>

                  {/* Username Field */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label
                        htmlFor="username"
                        className="text-sm font-medium text-gray-700"
                      >
                        Username <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative group">
                        <HelpCircle
                          className="w-4 h-4 text-gray-400 cursor-pointer"
                          tabIndex={0}
                          aria-label="Username help"
                          onClick={(e) => {
                            const tooltip = e.currentTarget
                              .nextSibling as HTMLElement;
                            if (tooltip) {
                              tooltip.style.display =
                                tooltip.style.display === "block"
                                  ? "none"
                                  : "block";
                            }
                          }}
                          onBlur={(e) => {
                            const tooltip = e.currentTarget
                              .nextSibling as HTMLElement;
                            if (tooltip) {
                              tooltip.style.display = "none";
                            }
                          }}
                        />
                        <div
                          className="absolute left-1/2 z-10 mt-2 w-40 -translate-x-1/2 rounded bg-gray-900 px-3 py-2 text-[11px] text-white shadow-lg"
                          style={{ display: "none" }}
                        >
                          Username of Fusion Mail.
                        </div>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex">
                              <Input
                                {...field}
                                placeholder="Enter your email address's username here."
                                className="flex-1 rounded-r-none border-r-0 focus:ring-2 focus:ring-[#ffa184] focus:border-[#ffa184]"
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  handleUsernameChange(e.target.value);
                                }}
                              />
                              <div className="px-3 py-2 bg-gray-50 border border-gray-300 border-l-0 rounded-r-md text-sm text-gray-700 flex items-center">
                                @{form.watch("domain")}
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Password Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Password
                      </Label>
                      <div className="relative group">
                        <HelpCircle
                          className="w-4 h-4 text-gray-400 cursor-pointer"
                          tabIndex={0}
                          aria-label="Password help"
                          onClick={(e) => {
                            const tooltip = e.currentTarget
                              .nextSibling as HTMLElement;
                            if (tooltip) {
                              tooltip.style.display =
                                tooltip.style.display === "block"
                                  ? "none"
                                  : "block";
                            }
                          }}
                          onBlur={(e) => {
                            const tooltip = e.currentTarget
                              .nextSibling as HTMLElement;
                            if (tooltip) {
                              tooltip.style.display = "none";
                            }
                          }}
                        />
                        <div
                          className="absolute left-1/2 z-10 mt-2 w-40 -translate-x-1/2 rounded bg-gray-900 px-3 py-2 text-[11px] text-white shadow-lg"
                          style={{ display: "none" }}
                        >
                          Password of Fusion Mail.
                        </div>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="passwordOption"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="set-now" id="set-now" />
                                <Label
                                  htmlFor="set-now"
                                  className="text-sm text-gray-700"
                                >
                                  Set password now.
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("passwordOption") === "set-now" && (
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                Password <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Auto-generated secure password"
                                  readOnly
                                  className="focus:ring-2 focus:ring-[#ffa184] focus:border-[#ffa184] bg-gray-50 text-gray-700"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <p className="text-[11px] text-gray-500">
                          This password will be auto-generated by the system.
                          You will not be required to enter a password to log in
                          through Fusion Mail.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="stayOnPage"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="data-[state=checked]:bg-[#ffa184] w-3 h-3 data-[state=checked]:border-[#ffa184]"
                                />
                              </FormControl>
                              <FormLabel className="text-[11px] text-gray-500">
                                Stay here after creating.
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetSettings}
                        className="text-gray-600 border-gray-300 hover:bg-accent rounded-full text-[11px]"
                      >
                        <Trash2 className="w-2 h-2" />
                        Reset
                      </Button>
                    </div>

                    {/* Storage Space */}
                    {/*<div className="space-y-3">
                       <div className="flex items-center space-x-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Storage Space
                        </Label>
                        <HelpCircle className="w-4 h-4 text-gray-400" />
                      </div> 

                      <FormField
                        control={form.control}
                        name="storageOption"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="limited"
                                    id="limited"
                                  />
                                  <div className="flex items-center space-x-2">
                                    <FormField
                                      control={form.control}
                                      name="storageAmount"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              type="number"
                                              min="1"
                                              max={
                                                form.watch("storageUnit") ===
                                                "MB"
                                                  ? 1024
                                                  : 1
                                              }
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                field.onChange(
                                                  Number(value) || 0
                                                );
                                                validateStorageAmount(
                                                  Number(value) || 0,
                                                  form.watch("storageUnit")
                                                );
                                              }}
                                              className={`w-20 h-8 text-sm focus:ring-2 focus:ring-[#ffa184] focus:border-[#ffa184] ${
                                                storageError
                                                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                  : ""
                                              }`}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name="storageUnit"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <div className="flex items-center space-x-3">
                                              

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newUnit =
                                                    field.value === "MB"
                                                      ? "GB"
                                                      : "MB";
                                                  field.onChange(newUnit);
                                                  validateStorageAmount(
                                                    form.watch("storageAmount"),
                                                    newUnit
                                                  );
                                                }}
                                                className="relative inline-flex items-center w-14 h-2 bg-gray-200 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#ffa184] focus:ring-offset-2"
                                                title={`Switch to ${
                                                  field.value === "MB"
                                                    ? "GB"
                                                    : "MB"
                                                }`}
                                              >
                                                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#ffa184] via-[#ffc3a0] to-[#ff6b6b] opacity-80"></div>

                                                <div
                                                  className={`relative z-10 inline-flex items-center justify-center w-7 h-7 bg-gray-800 rounded-full shadow transform transition-transform duration-300 ease-in-out ${
                                                    field.value === "GB"
                                                      ? "translate-x-8"
                                                      : "translate-x-0"
                                                  }`}
                                                >
                                                  <span className="text-xs font-semibold text-white">
                                                    {field.value}
                                                  </span>
                                                </div>
                                              </button>

                                            
                                            </div>
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                    </div>*/}

                    {/* Stay on Page */}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      type="submit"
                      disabled={createAccountMutation.isPending}
                      className="bg-[#ffa184] hover:bg-[#ff8c69] text-white rounded-full"
                    >
                      {createAccountMutation.isPending ? (
                        <>Creating...</>
                      ) : (
                        <>+ Create</>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleGoBack}
                      className="text-[#ffa184] hover:text-[#ff8c69] rounded-full hover:bg-[#ffa184]/10"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Go Back
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
