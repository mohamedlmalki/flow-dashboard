import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  Trash2, Play, Pause, Save, AlertCircle, 
  CheckCircle2, Clock, Upload, Eraser, 
  Eye, Terminal, Mail, Settings, Activity 
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // --- Effects ---
  useEffect(() => {
    const savedName = localStorage.getItem("defaultFromName");
    const savedEmail = localStorage.getItem("defaultFromEmail");
    
    if (savedName) setFromName(savedName);
    else setFromName("Upsun User"); 
    
    if (savedEmail) setFromEmail(savedEmail);
    else {
      const hostname = window.location.hostname.replace(/^www\./, '');
      setFromEmail(`no-reply@${hostname}`);
    }
  }, []);

  // --- Helpers ---
  const parseEmails = (text: string): string[] => {
    return text
      .split(/[\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));
  };

  const totalRecipients = parseEmails(recipients).length;
  // Progress is now calculated based on how many have been processed vs total input
  const progressPercentage = totalRecipients > 0 ? (results.length / totalRecipients) * 100 : 0;
  
  // --- Actions ---
  const saveDefaults = () => {
    localStorage.setItem("defaultFromName", fromName);
    localStorage.setItem("defaultFromEmail", fromEmail);
    toast({ title: "Saved", description: "Sender configuration updated.", duration: 2000 });
  };

  const cleanList = () => {
    const currentList = parseEmails(recipients);
    const uniqueList = [...new Set(currentList)];
    setRecipients(uniqueList.join("\n"));
    toast({ title: "List Cleaned", description: `Removed duplicates. Total: ${uniqueList.length}` });
  };

  const clearLogs = () => {
    setResults([]);
    currentIndexRef.current = 0;
    setIsRunning(false);
    isPausedRef.current = false;
    toast({ title: "Reset", description: "Campaign logs cleared." });
  };

  // --- Core Logic ---
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

  const startSending = useCallback(async () => {
    const emails = parseEmails(recipients);
    if (emails.length === 0) {
      toast({ title: "Missing Recipients", description: "Please add at least one email.", variant: "destructive" });
      return;
    }

    // NOTE: Removed the pre-filling logic. 
    // We now start with whatever results we have (empty or from previous run)

    setIsRunning(true);
    isPausedRef.current = false;
    const emailList = emails;

    for (let i = currentIndexRef.current; i < emailList.length; i++) {
      if (isPausedRef.current) { currentIndexRef.current = i; setIsRunning(false); return; }

      const currentEmail = emailList[i];
      const currentId = i + 1;

      // 1. ADD NEW ROW TO TOP (Sending Status)
      setResults(prev => [
        {
          index: currentId,
          email: currentEmail,
          status: "sending",
          time: null,
          message: null,
          rawResponse: undefined
        },
        ...prev // Put existing rows AFTER the new one
      ]);

      // 2. SEND EMAIL
      const result = await sendEmail(currentEmail);
      
      // 3. UPDATE ROW (Success/Failed)
      setResults(prev => prev.map(r => r.index === currentId ? {
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
    toast({ title: "Complete", description: "All emails processed." });
  }, [recipients, fromName, fromEmail, subject, emailBody, delay]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Upsun Dispatcher</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> PHP Backend</span>
                <span>•</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> System Ready</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
             {isRunning && (
               <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full animate-pulse">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                 Sending...
               </div>
             )}
             <Button variant="outline" size="sm" onClick={clearLogs} className="ml-auto">
               <Trash2 className="w-4 h-4 mr-2" /> Clear Logs
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* --- LEFT COLUMN: RECIPIENTS (5 cols) --- */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card className="flex-1 flex flex-col shadow-sm border-slate-200">
              <CardHeader className="pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-md font-medium">Recipients</CardTitle>
                  <Badge variant="secondary" className="font-mono">{totalRecipients}</Badge>
                </div>
                <CardDescription>Enter email addresses (duplicates allowed).</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 min-h-[500px]">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="xs" onClick={cleanList} className="h-7 text-xs">
                    <Eraser className="w-3 h-3 mr-1" /> Remove Duplicates
                  </Button>
                  <Button variant="ghost" size="xs" className="h-7 text-xs">
                    <Upload className="w-3 h-3 mr-1" /> Import CSV
                  </Button>
                </div>
                <Textarea 
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="alice@example.com&#10;alice@example.com"
                  className="flex-1 font-mono text-sm resize-none bg-slate-50 focus:bg-white transition-colors border-slate-200" 
                />
              </CardContent>
            </Card>
          </div>

          {/* --- RIGHT COLUMN: CONFIGURATION (7 cols) --- */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* CONFIG CARD */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-md font-medium flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-500" /> Campaign Settings
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={saveDefaults} className="h-8 text-xs">
                    <Save className="w-3 h-3 mr-1" /> Save Default
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Identity */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">FROM NAME</Label>
                    <Input 
                      value={fromName} 
                      onChange={(e) => setFromName(e.target.value)} 
                      className="h-9 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">FROM EMAIL</Label>
                    <Input 
                      value={fromEmail} 
                      onChange={(e) => setFromEmail(e.target.value)} 
                      className="h-9 bg-slate-50/50 font-mono text-xs"
                    />
                  </div>
                </div>
                
                <Separator />

                {/* Subject & Delay */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-9 space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">SUBJECT LINE</Label>
                    <Input 
                      value={subject} 
                      onChange={(e) => setSubject(e.target.value)} 
                      placeholder="Special Offer for you..."
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-3 space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">DELAY (S)</Label>
                    <div className="relative">
                      <Clock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <Input 
                        type="number" 
                        value={delay} 
                        onChange={(e) => setDelay(Number(e.target.value))} 
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <Tabs defaultValue="editor" className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold text-slate-500">EMAIL CONTENT</Label>
                    <TabsList className="h-7">
                      <TabsTrigger value="editor" className="text-[10px] h-5 px-2">Write</TabsTrigger>
                      <TabsTrigger value="preview" className="text-[10px] h-5 px-2">Preview</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="editor" className="mt-0">
                    <Textarea 
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="<h1>Hello World</h1>"
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-0">
                    <div className="min-h-[200px] border rounded-md p-4 prose prose-sm max-w-none overflow-y-auto bg-slate-50">
                      {emailBody ? (
                        <div dangerouslySetInnerHTML={{ __html: emailBody }} />
                      ) : (
                        <p className="text-slate-400 italic">No content to preview</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* ACTION BAR */}
            <div className="grid grid-cols-1 gap-4">
              {results.length > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Progress</span>
                    <span>{Math.round(progressPercentage)}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              )}
              
              {!isRunning ? (
                <Button 
                  size="lg" 
                  onClick={startSending} 
                  disabled={!recipients.trim()} 
                  className="w-full h-12 text-md shadow-md hover:shadow-lg transition-all"
                >
                  {currentIndexRef.current > 0 ? (
                    <><Play className="w-5 h-5 mr-2" /> Resume Campaign ({totalRecipients - currentIndexRef.current} left)</>
                  ) : (
                    <><Play className="w-5 h-5 mr-2" /> Start Campaign ({totalRecipients} emails)</>
                  )}
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => isPausedRef.current = true} 
                  className="w-full h-12 text-md border-2 border-slate-200"
                >
                  <Pause className="w-5 h-5 mr-2" /> Pause Campaign
                </Button>
              )}
            </div>

          </div>
        </div>

        {/* --- LOGS SECTION --- */}
        {results.length > 0 && (
          <Card className="shadow-sm border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-slate-50 border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Execution Terminal</h3>
              </div>
              <div className="flex gap-4 text-xs font-mono">
                <span className="text-green-600">SUCCESS: {results.filter(r => r.status === 'success').length}</span>
                <span className="text-red-500">FAILED: {results.filter(r => r.status === 'failed').length}</span>
              </div>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm text-slate-500">
                    <tr>
                      <th className="p-3 font-medium w-16 text-center">#</th>
                      <th className="p-3 font-medium">Recipient</th>
                      <th className="p-3 font-medium w-32 text-center">Status</th>
                      <th className="p-3 font-medium w-24 text-center">Time</th>
                      <th className="p-3 font-medium w-16 text-center">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {results.map((r) => (
                      <tr key={r.index} className="hover:bg-slate-50 group transition-colors">
                        <td className="p-3 text-center text-slate-400">{r.index}</td>
                        <td className="p-3 text-slate-700">{r.email}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                            ${r.status === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 
                              r.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-100' : 
                              r.status === 'sending' ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' : 
                              'text-slate-400'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-400">{r.time || "--:--:--"}</td>
                        <td className="p-3 text-center">
                          {r.rawResponse && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3 h-3 text-slate-500" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Server Response</DialogTitle>
                                  <DialogDescription>Raw JSON output from backend.</DialogDescription>
                                </DialogHeader>
                                <div className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto">
                                  <pre className="text-xs font-mono">{r.rawResponse}</pre>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </Card>
        )}

      </div>
    </div>
  );
};