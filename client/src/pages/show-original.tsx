import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export default function ShowOriginal() {
  const params = useParams();
  const { mail_Id, emailId, view } = params as { mail_Id: string; emailId: string; view: string };
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/mails/getMailDetailFromStorage", mail_Id, emailId],
    queryFn: async () => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest(
        "POST",
        "/mails/getMailDetailFromStorage",
        {
          mail_id: mail_Id,
          emailUniqueId: emailId,
          __headers: headers,
        }
      );
      return response.data;
    },
    enabled: !!mail_Id && !!emailId,
  });

  // Fetch the raw/original email content from /mails/getRawEmailFile
  const { data: rawData, isLoading: isRawLoading, error: rawError } = useQuery({
    queryKey: ["/mails/getRawEmailFile", emailId],
    queryFn: async () => {
      const authtoken = localStorage.getItem("authtoken");
      const headers = authtoken ? { Authorization: `Bearer ${authtoken}` } : {};
      const response = await apiRequest(
        "POST",
        "/mails/getRawEmailFile",
        {
          emailUniqueId: emailId,
          __headers: headers,
        }
      );
      console.log("original data",response.data);
      return response.data;
    },
    enabled: !!emailId,
  });

  const original = typeof rawData === "string"
    ? rawData
    : (rawData?.raw || rawData?.original || rawData?.content || "Raw/original email source not available.");

  // Table fields from /mails/getMailDetailFromStorage
  const getHeader = (key: string) => {
    if (!data) return '';
    if (data.headers && (data.headers[key] || data.headers[key.toLowerCase()])) {
      const val = data.headers[key] || data.headers[key.toLowerCase()];
      if (typeof val === 'object' && val.value) return val.value;
      return val;
    }
    return data[key] || '';
  };
  const formatHeaderValue = (val: any): string => {
    if (!val) return "";
    if (Array.isArray(val)) {
      return val
        .map((v) =>
          typeof v === "object" && v.address
            ? `${v.name ? `\"${v.name}\" ` : ""}<${v.address}>`
            : String(v)
        )
        .join(", ");
    }
    if (typeof val === "object" && val.address) {
      return `${val.name ? `\"${val.name}\" ` : ""}<${val.address}>`;
    }
    if (typeof val === "object" && val.value) {
      return formatHeaderValue(val.value);
    }
    return String(val);
  };
  const messageId = getHeader('message-id');
  const createdAt = getHeader('date');
  const from = formatHeaderValue(getHeader('from'));
  const to = formatHeaderValue(getHeader('to'));
  const subject = formatHeaderValue(getHeader('subject'));
  const getAuthResult = (key: string) => {
    if (!data) return '';
    if (data[key]) return data[key];
    if (data.auth_results && data.auth_results[key]) return data.auth_results[key];
    return '';
  };
  const spf = formatHeaderValue(getAuthResult('spf'));
  const dkim = formatHeaderValue(getAuthResult('dkim'));
  const dmarc = formatHeaderValue(getAuthResult('dmarc'));

  // Also format SPF, DKIM, DMARC in case they are objects/arrays
  // const spfVal = formatHeaderValue(spf);
  // const dkimVal = formatHeaderValue(dkim);
  // const dmarcVal = formatHeaderValue(dmarc);

  // Gmail-style table row helper
  const TableRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <tr className="border-b last:border-b-0">
      <td className="py-2 px-4 font-medium text-muted-foreground whitespace-nowrap align-top w-40">{label}</td>
      <td className="py-2 px-4 align-top break-all">{value || <span className="text-gray-400">-</span>}</td>
    </tr>
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(original);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([original], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `original_email_${emailId}.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-8 px-2">
      <div className="w-full bg-white dark:bg-black rounded-lg shadow border p-6">
        <h1 className="text-2xl font-semibold mb-6">Original Message</h1>
        {isLoading || isRawLoading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : rawError ? (
          <div className="text-center text-red-500">Failed to load raw email file.</div>
        ) : (
          <>
            <div className="mb-6">
              <table className="w-full border rounded-lg overflow-hidden bg-white dark:bg-black">
                <tbody>
                  <TableRow label="Message ID" value={<span className="text-green-700">{messageId}</span>} />
                  <TableRow label="Created at" value={createdAt} />
                  <TableRow label="From" value={from} />
                  <TableRow label="To" value={to} />
                  <TableRow label="Subject" value={subject} />
                  <TableRow label="SPF" value={spf} />
                  <TableRow label="DKIM" value={dkim} />
                  <TableRow label="DMARC" value={dmarc} />
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mb-4">
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#ffa184] text-white rounded hover:bg-[#ff8c69] text-sm"
              >
                Download Original
              </button>
              <button
                onClick={handleCopy}
                className="px-4 py-2 text-[#ffa184] rounded hover:bg-[#ffa184]/10 text-sm"
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            </div>
            <div className="bg-gray-100 dark:bg-gray-900 rounded p-4 overflow-x-auto border">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all">
                {original}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 