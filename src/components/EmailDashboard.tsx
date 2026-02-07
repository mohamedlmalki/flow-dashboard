import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  Trash2, 
  Mail, 
  Play, 
  Pause, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Upload, 
  Eraser, 
  Eye 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// --- Types ---
type EmailStatus = "pending" | "sending" | "success" | "failed";

interface EmailResult {
  index: number;
  email: string;
  status: EmailStatus;
  time: string | null;
  message: string | null;
  rawResponse?: string; 
}

// --- Helper: Sleep ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const EmailDashboard = () => {
  const { toast } = useToast();
  
  // --- State ---
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [delay, setDelay] = useState(2);
  const [emailBody, setEmailBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // --- Refs ---
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);

  // --- Effect: Load Defaults & Auto-Detect Domain ---
  useEffect(() => {
    const savedName = localStorage.getItem("defaultFromName");
    const savedEmail = localStorage.getItem("defaultFromEmail");
    
    // Name
    if (savedName) setFromName(savedName);
    else setFromName("Upsun User"); 
    
    // Email
    if (savedEmail) setFromEmail(savedEmail);
    else {
      const hostname = window.location.hostname.replace(/^www\./, '');
      setFromEmail(`no-reply@${hostname}`);
    }
  }, []);

  // --- Action: Save Defaults ---
  const saveDefaults = () => {
    localStorage.setItem("defaultFromName", fromName);
    localStorage.setItem("defaultFromEmail", fromEmail);
    toast({ 
      title: "Configuration Saved", 
      description: "Sender details have been updated as default.",
      duration: 3000
    });
  };

  // --- Helper: Parse Emails ---
  const parseEmails = (text: string): string[] => {
    return [...new Set(text.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(e => e && e.includes("@")))];
  };

  // --- Action: Clean List ---
  const cleanList = () => {
    const valid = parseEmails(recipients);
    setRecipients(valid.join("\n"));
    toast({ title: "List Cleaned", description: `Formatted ${valid.length} unique emails.` });
  };

  // --- Logic: Send Single Email ---
  const sendEmail = async (email: string): Promise<{ success: boolean; message?: string; raw?: any }> => {
    try {
      const response = await fetch("/api/index.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, fromName, fromEmail, subject, body: emailBody }),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: "Non-JSON response", rawText: text }; }

      if (!response.ok) throw { message: data.message || `HTTP ${response.status}`, raw: data };
      return { success: true, message: data.message, raw: data };
    } catch (error: any) {
      return { success: false, message: error.message || "Unknown error", raw: error.raw || error };
    }
  };

  // --- Logic: Main Loop ---
  const startSending = useCallback(async () => {
    const emails = parseEmails(recipients);
    if (emails.length === 0) {
      toast({ title: "Empty List", description: "Please add recipient emails.", variant: "destructive" });
      return;
    }

    if (currentIndexRef.current === 0 || results.length === 0) {
      setResults(emails.map((email, index) => ({
        index: index + 1, email, status: "pending", time: null, message: null, rawResponse: undefined,
      })));
    }

    setIsRunning(true);
    isPausedRef.current = false;

    // Use a local variable to track list length in case it changes (though usually locked)
    const emailList = emails;

    for (let i = currentIndexRef.current; i < emailList.length; i++) {
      if (isPausedRef.current) { currentIndexRef.current = i; setIsRunning(false); return; }

      // Update status to sending
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "sending" } : r));
      
      const result = await sendEmail(emailList[i]);
      
      // Update result
      setResults(prev => prev.map((r, idx) => idx === i ? {
        ...r, 
        status: result.success ? "success" : "failed", 
        time: new Date().toLocaleTimeString(),
        message: result.message || "Done", 
        rawResponse: JSON.stringify(result.raw, null, 2),
      } : r));

      if (i < emailList.length - 1 && !isPausedRef.current) await sleep(delay * 1000);
    }
    currentIndexRef.current = 0;
    setIsRunning(false);
    toast({ title: "Campaign Finished", description: `Processed ${emailList.length} emails.` });
  }, [recipients, fromName, fromEmail, subject, emailBody, delay, results.length]);

  const pauseSending = () => isPausedRef.current = true;
  
  const clearResults = () => { 
    setResults([]); 
    currentIndexRef.current = 0; 
    setIsRunning(false); 
    isPausedRef.current = false; 
    toast({ title: "Logs Cleared", description: "Ready for a new campaign." });
  };

  // --- Stats ---
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const totalCount = parseEmails(recipients).length;

  // --- Render ---
  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6 md:p-10 font-sans text-slate-800">
      
      {/* Main Container */}
      <div className="max-w-[1100px] mx-auto bg-white rounded-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-6 md:p-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-[18px] font-semibold flex items-center gap-2 text-slate-800">
            <span className="text-xl">✈</span> Upsun Bulk Emailer
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={clearResults}
              className="bg-[#f1f3f7] hover:bg-slate-200 transition-colors border-none py-2 px-3.5 rounded-[8px] text-[13px] font-medium text-slate-600 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Logs
            </button>
            <button className="bg-[#f1f3f7] hover:bg-slate-200 transition-colors border-none py-2 px-3.5 rounded-[8px] text-[13px] font-medium text-slate-600 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> Failures: {failedCount}
            </button>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* LEFT COLUMN */}
          <div>
            <label className="block text-[13px] font-medium text-[#333] mb-1.5">Recipient Emails</label>
            <div className="flex gap-2 mb-2">
              <button 
                onClick={cleanList}
                className="bg-[#f1f3f7] hover:bg-slate-200 transition-colors border-none py-1.5 px-3 rounded-[8px] text-[12px] font-medium text-slate-600 flex items-center gap-1"
              >
                <Eraser className="w-3 h-3" /> Clean List
              </button>
              <button className="bg-[#f1f3f7] hover:bg-slate-200 transition-colors border-none py-1.5 px-3 rounded-[8px] text-[12px] font-medium text-slate-600 flex items-center gap-1">
                <Upload className="w-3 h-3" /> Import
              </button>
              <span className="text-[11px] text-slate-400 flex items-center ml-auto">
                {totalCount} recipients
              </span>
            </div>
            <textarea 
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="user1@example.com&#10;user2@example.com"
              className="w-full min-h-[400px] border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all font-mono"
            />
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">

            {/* Sender Identity Block */}
            <div>
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">Sender Identity</label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-start">
                <input 
                  value={fromName} 
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="From Name" 
                  className="w-full border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] outline-none focus:border-blue-400 transition-all"
                />
                 <input 
                  value={fromEmail} 
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="From Email" 
                  className="w-full border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] outline-none focus:border-blue-400 transition-all"
                />
                <button 
                  onClick={saveDefaults}
                  className="bg-blue-500 hover:bg-blue-600 text-white border-none py-3 px-4 rounded-[10px] cursor-pointer text-sm font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">Ticket Subject</label>
              <input 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..." 
                className="w-full border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] outline-none focus:border-blue-400 transition-all"
              />
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-[#333] mb-1.5">Delay (Sec)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min={0}
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="w-full border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] outline-none focus:border-blue-400 transition-all"
                  />
                  <Clock className="absolute right-3 top-3.5 w-4 h-4 text-slate-300 pointer-events-none" />
                </div>
              </div>
              <div>
                 <label className="block text-[13px] font-medium text-[#333] mb-1.5">Status</label>
                 <div className="w-full border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] bg-[#f9fafc] text-slate-500">
                    {isRunning ? "Running..." : "Idle"}
                 </div>
              </div>
            </div>

            {/* Description / Body */}
            <div>
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">Ticket Description</label>
              <div className="flex gap-2 mb-2">
                <button className="bg-[#f1f3f7] hover:bg-slate-200 transition-colors border-none py-1.5 px-3 rounded-[8px] text-[12px] font-medium text-slate-600">
                  🖼 Add Image
                </button>
                <button className="bg-[#f1f3f7] hover:bg-slate-200 transition-colors border-none py-1.5 px-3 rounded-[8px] text-[12px] font-medium text-slate-600">
                   Preview
                </button>
              </div>
              <textarea 
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Enter email content (HTML supported)..."
                className="w-full min-h-[160px] border border-[#e3e6ee] rounded-[10px] p-3 text-[14px] outline-none focus:border-blue-400 transition-all font-mono"
              />
              <div className="text-[12px] text-[#7a7a7a] mt-1.5">HTML formatting is supported</div>
            </div>

          </div>
        </div>

        {/* Footer Action */}
        <div className="mt-8">
          {!isRunning ? (
            <button 
              onClick={startSending}
              disabled={!recipients.trim()}
              className="w-full bg-[#9fc5ff] hover:bg-[#8bb4f5] text-white border-none py-4 text-[16px] font-semibold rounded-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {currentIndexRef.current > 0 ? (
                <><Play className="w-5 h-5" /> Resume Campaign ({totalCount - currentIndexRef.current} left)</>
              ) : (
                <><Play className="w-5 h-5" /> Create {totalCount} Tickets</>
              )}
            </button>
          ) : (
            <button 
              onClick={pauseSending}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 border-none py-4 text-[16px] font-semibold rounded-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <Pause className="w-5 h-5" /> Pause Campaign
            </button>
          )}
        </div>

        {/* Results Table (Hidden unless data exists) */}
        {results.length > 0 && (
          <div className="mt-8 border-t border-[#e3e6ee] pt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Execution Logs</h3>
                <div className="flex gap-4 text-xs font-medium">
                  <span className="text-green-600">Success: {successCount}</span>
                  <span className="text-red-500">Failed: {failedCount}</span>
                </div>
             </div>
             
             <div className="overflow-hidden rounded-[10px] border border-[#e3e6ee]">
               <table className="w-full text-[13px] text-left">
                 <thead className="bg-[#f9fafc] text-slate-500">
                   <tr>
                     <th className="p-3 font-medium w-12 text-center">#</th>
                     <th className="p-3 font-medium">Recipient</th>
                     <th className="p-3 font-medium w-24 text-center">Status</th>
                     <th className="p-3 font-medium w-24 text-center">Time</th>
                     <th className="p-3 font-medium w-16 text-center">Raw</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-[#e3e6ee]">
                   {results.map((r) => (
                     <tr key={r.index} className="hover:bg-slate-50 transition-colors">
                       <td className="p-3 text-center text-slate-400">{r.index}</td>
                       <td className="p-3 font-mono text-slate-600 truncate max-w-[200px]">{r.email}</td>
                       <td className="p-3 text-center">
                         <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium
                           ${r.status === 'success' ? 'bg-green-100 text-green-700' : 
                             r.status === 'failed' ? 'bg-red-100 text-red-700' : 
                             r.status === 'sending' ? 'bg-blue-100 text-blue-700' : 
                             'bg-slate-100 text-slate-500'}`}>
                           {r.status}
                         </span>
                       </td>
                       <td className="p-3 text-center text-slate-500">{r.time || "-"}</td>
                       <td className="p-3 text-center">
                          {r.rawResponse && (
                             <Dialog>
                               <DialogTrigger asChild>
                                 <button className="text-slate-400 hover:text-blue-500 transition-colors">
                                   <Eye className="w-4 h-4" />
                                 </button>
                               </DialogTrigger>
                               <DialogContent>
                                 <DialogHeader>
                                   <DialogTitle>Server Response</DialogTitle>
                                   <DialogDescription>Raw output from PHP script</DialogDescription>
                                 </DialogHeader>
                                 <pre className="bg-slate-100 p-4 rounded-lg text-xs font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                                   {r.rawResponse}
                                 </pre>
                               </DialogContent>
                             </Dialog>
                          )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};