import { useQuery } from "@tanstack/react-query";
import Loader from "@/components/ui/Loader";
import { apiRequest } from "@/lib/queryClient";

interface ConversationProps {
  mailId: string;
  threadId: string;
  onBack?: () => void;
}

const Conversation = ({ mailId, threadId, onBack }: ConversationProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["conversation", mailId, threadId],
    queryFn: () =>
      apiRequest("POST", "/mails/conversation", {
        mail_id: mailId,
        threadId,
      }),
  });

  // Support both data.conversation and data.data.conversation
  const conversation = data?.conversation || data?.data?.conversation || [];

  if (isLoading) return <Loader />;
  if (!conversation.length)
    return (
      <div className="p-8 text-center text-muted-foreground">
        No messages in this conversation.
        {onBack && (
          <div className="mt-4">
            <button className="px-4 py-2 bg-accent rounded" onClick={onBack}>
              Back
            </button>
          </div>
        )}
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto p-4">
      {onBack && (
        <button className="mb-4 px-4 py-2 bg-accent rounded" onClick={onBack}>
          Back
        </button>
      )}
      {conversation.map((msg: any) => (
        <div
          key={msg.id + msg.date}
          className="mb-8 pb-4 border-b border-border last:border-b-0"
        >
          <div className="mb-1 text-xs text-muted-foreground">
            <span className="font-semibold">From:</span> {msg.from}
            <span className="ml-4 font-semibold">To:</span> {msg.to}
          </div>
          <div className="mb-1 text-xs text-muted-foreground">
            <span className="font-semibold">Date:</span> {new Date(msg.date).toLocaleString()}
          </div>
          <div className="mb-2 text-sm font-medium">{msg.subject}</div>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: msg.parsedHtml || msg.content || "" }}
          />
        </div>
      ))}
    </div>
  );
};

export default Conversation; 