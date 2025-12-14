// Translation page for /mailbox/m/:mail_Id/:mailbox/email/:emailId/translate
import { useParams } from "wouter";
import { useState } from "react";

export default function TranslatePage() {
  const params = useParams();
  const { mail_Id, mailbox, emailId } = params as { mail_Id: string; mailbox: string; emailId: string };
  const [copied, setCopied] = useState(false);
  const [targetLang, setTargetLang] = useState("es");
  const [translated, setTranslated] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);

  let data: any = null;
  if (typeof window !== "undefined" && emailId) {
    const raw = localStorage.getItem(`translateRawEml_${emailId}`);
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {}
    }
  }

  const langNames: Record<string, string> = {
    es: "Spanish", fr: "French", de: "German", it: "Italian",
    pt: "Portuguese", ru: "Russian", ja: "Japanese", ko: "Korean",
    zh: "Chinese (Simplified)", ar: "Arabic"
  };

  const handleTranslate = () => {
    if (data && data.body) {
      setTranslated(`[Translated to ${langNames[targetLang]}] ${data.body}`);
      setShowTranslation(true);
    }
  };

  const handleCopy = () => {
    if (data && data.body) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(data.body);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = data.body;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          alert("Copy failed. Please copy manually.");
        }
        document.body.removeChild(textarea);
      }
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-8 px-2">
        <div className="w-full bg-white dark:bg-black rounded-lg shadow border p-6">
          <h1 className="text-2xl font-semibold mb-6">Email Translation</h1>
          <div className="text-center text-red-500">No translation data found for this message.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-8 px-2">
      <div className="w-full bg-white dark:bg-black rounded-lg shadow border p-6">
        <h1 className="text-2xl font-semibold mb-6">Email Translation</h1>
        <div className="mb-6">
          <table className="w-full border rounded-lg overflow-hidden bg-white dark:bg-black">
            <tbody>
              <tr className="border-b last:border-b-0">
                <td className="py-2 px-4 font-medium text-muted-foreground whitespace-nowrap align-top w-40">From</td>
                <td className="py-2 px-4 align-top break-all">{data.from || <span className="text-gray-400">-</span>}</td>
              </tr>
              <tr className="border-b last:border-b-0">
                <td className="py-2 px-4 font-medium text-muted-foreground whitespace-nowrap align-top w-40">Subject</td>
                <td className="py-2 px-4 align-top break-all">{data.subject || <span className="text-gray-400">-</span>}</td>
              </tr>
              <tr className="border-b last:border-b-0">
                <td className="py-2 px-4 font-medium text-muted-foreground whitespace-nowrap align-top w-40">Date</td>
                <td className="py-2 px-4 align-top break-all">{data.date || <span className="text-gray-400">-</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-[#ffa184] rounded hover:bg-[#ffa184]/10 text-sm"
          >
            {copied ? "Copied!" : "Copy original"}
          </button>
        </div>
        <div className="bg-gray-100 dark:bg-gray-900 rounded p-4 overflow-x-auto border mb-6">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all">
            {data.rawEml || data.body || <span className="text-gray-400">No content available</span>}
          </pre>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900 rounded p-4 mb-4">
          <div className="mb-2 font-medium">Translation Options:</div>
          <label htmlFor="targetLang" className="mr-2">Translate to:</label>
          <select
            id="targetLang"
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="px-2 py-1 rounded border"
          >
            {Object.entries(langNames).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <button
            onClick={handleTranslate}
            className="ml-2 px-4 py-1.5 bg-[#ffa184] text-white rounded hover:bg-[#ff8c69] text-sm"
          >
            Translate
          </button>
          <button
            onClick={() => window.close()}
            className="ml-2 px-4 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          >
            Close
          </button>
        </div>
        {showTranslation && (
          <div className="bg-green-50 dark:bg-green-900 rounded p-4 mt-4 border">
            <div className="mb-2 font-medium">Translated Message:</div>
            <div className="text-sm whitespace-pre-wrap">{translated}</div>
            <small className="block mt-2 text-gray-500">Note: This is a simulated translation. For real translation, integrate with Google Translate API or similar service.</small>
          </div>
        )}
      </div>
    </div>
  );
} 