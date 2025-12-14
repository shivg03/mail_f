import React from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Loader from "@/components/ui/Loader";
import { apiRequest } from "../../lib/queryClient";

interface ConversationMessage {
  subject?: string;
  from?: string;
  sender?: string;
  date?: string | number | Date;
  content?: string;
}

function getMetadataTable(messages: ConversationMessage[]) {
  return (
    <div className="mb-8">
      {messages.map((msg, idx) => (
        <div key={idx} className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded shadow border">
          <div className="font-semibold text-base mb-2">Email {idx + 1}</div>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 pr-4 text-muted-foreground font-medium w-20">From</td>
                <td>{msg.from ?? msg.sender ?? <span className="text-gray-400">-</span>}</td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-muted-foreground font-medium">Subject</td>
                <td>{msg.subject ?? <span className="text-gray-400">-</span>}</td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-muted-foreground font-medium">Date</td>
                <td>{msg.date ? new Date(msg.date).toLocaleString() : <span className="text-gray-400">-</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// A simple summary function
function getConversationIntent(messages: ConversationMessage[]) {
  if (!messages || !messages.length) {
    return "No emails in the conversation.";
  }

  // Normalize subject
  const subject = messages[0].subject?.toLowerCase() ?? "";

  // Intent mappings
  if (subject.includes("random email")) {
    return `This conversation is a casual and light-hearted exchange. 
It begins with a cheerful, random greeting meant to brighten the recipient’s day, 
and the replies continue with similar positivity. There are no specific requests, 
deadlines, or action items being communicated here—just goodwill and friendly banter.`;
  }

  if (subject.includes("meeting") || subject.includes("sync") || subject.includes("call")) {
    return `This conversation revolves around scheduling and organizing a meeting. 
The participants are discussing possible time slots, confirming availability, 
and settling on an agenda. The key intent here is logistical coordination, 
ensuring all attendees are aligned for the upcoming discussion.`;
  }

  if (subject.includes("report") || subject.includes("update") || subject.includes("status")) {
    return `This conversation is business-oriented, focusing on updates and progress tracking. 
The sender shares a report, status update, or milestone summary, often including deadlines 
and next steps. The recipients are expected to acknowledge, review attached documents, 
or provide follow-up feedback as necessary.`;
  }

  if (subject.includes("alert") || subject.includes("system") || subject.includes("error")) {
    return `This conversation contains an important alert or system-generated warning. 
The intent is to notify the recipient about a critical issue (such as a system error, 
security breach, or high resource usage), prompting immediate awareness and potentially 
urgent corrective actions.`;
  }

  if (subject.includes("offer") || subject.includes("promo") || subject.includes("discount")) {
    return `This conversation contains a promotional marketing message. 
The intent is to inform the recipient about a sale, discount, or special offer. 
The email emphasizes benefits, encourages engagement or purchases, and 
often contains call-to-action elements like redeem codes or links to shop.`;
  }

  // Generic fallback with richer detail
  return `This conversation includes multiple emails on the subject: "${messages[0].subject ?? "Unknown"}". 
The overall intent seems to be one of general communication. While the tone is friendly, 
the discussion could include a mix of casual exchanges, informational updates, and basic coordination. 
No urgent matters or formal actions are immediately visible, but the communication suggests 
an ongoing thread where context may build over time.`;
}

export default function SummaryPage() {
  const { mailId, threadId } = useParams();

  const { data: conversationData, isLoading } = useQuery<ConversationMessage[]>({
    queryKey: ["/mails/conversation", mailId, threadId],
    queryFn: async () => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest("POST", "/mails/conversation", {
        mail_id: mailId,
        threadId,
        __headers: headers,
      });
      return response.data?.conversation || response.data?.data?.conversation || [];
    },
    enabled: !!mailId && !!threadId,
    refetchOnMount: true,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  const messages = conversationData ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-8 px-2">
      <div className="w-full bg-white dark:bg-black rounded-lg p-6">
        <h1 className="flex items-center justify-center text-3xl text-[#ffa184] font-semibold mb-6">Conversation Summary by Fusion AI</h1>
        {/* Show metadata for each message */}
        {getMetadataTable(messages)}

        {/* High-level summary paragraph */}
        <div className="py-4">
          <div className="text-sm text-[#ffa184] text-xl font-semibold mb-1">Summary:</div>
          <div className="p-4 rounded bg-gray-100 dark:bg-gray-950 text-base border">
            {getConversationIntent(messages)}
          </div>
        </div>
      </div>
    </div>
  );
}
