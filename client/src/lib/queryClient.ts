import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from "axios";

export const BASE_API = "http://192.168.1.7:8000";
// export const BASE_API = "http://10.43.206.244:5000";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const fullUrl = url.startsWith("http://") || url.startsWith("https://") ? url : BASE_API + url;

  // Get token from localStorage automatically
  const token = localStorage.getItem("authtoken");
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  let headers = data ? { "Content-Type": "application/json" } : {};
  headers = { ...headers, ...authHeader };

  let payload = data;
  if (data && typeof data === "object" && "__headers" in data) {
    headers = { ...headers, ...(data as any).__headers };
    const { __headers, ...rest } = data as any;
    payload = rest;
  }

  const config = {
    method,
    url: fullUrl,
    data: payload,
    withCredentials: true,
    headers,
  };

  const res = await axios(config);
  return res;
}

/**
 * Update all relevant messages in a conversation for a given action.
 * @param {string} mailId - The mailbox ID
 * @param {string} threadId - The thread/conversation ID
 * @param {object} update - The update object (e.g., { isArchived: true })
 * @param {string} authtoken - The user's auth token
 * @returns {Promise<void>}
 */
export async function updateConversationMessages(
  mailId: string,
  threadId: string,
  update: Record<string, any>,
  authtoken: string
): Promise<void> {
  const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
  const response = await apiRequest("POST", "/mails/conversation", {
    mail_id: mailId,
    threadId,
    __headers: headers,
  });
  const conversationArr = response.data.conversation;
  if (Array.isArray(conversationArr)) {
    await Promise.all(
      conversationArr.map(async (msg: any) => {
        const payload = msg.sendMail_Id
          ? { sendmail_id: msg.sendMail_Id }
          : { emailUniqueId: msg.emailUniqueId };
        await apiRequest("POST", "/email/updateEmail", {
          ...payload,
          ...update,
          __headers: headers,
        });
      })
    );
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await axios.get(queryKey[0] as string, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      if (
        unauthorizedBehavior === "returnNull" &&
        err.response &&
        err.response.status === 401
      ) {
        return null;
      }
      throw err;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
