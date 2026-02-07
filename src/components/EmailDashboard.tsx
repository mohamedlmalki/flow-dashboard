import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Play, Pause, Trash2, Clock, User, FileText, Eye, Save, Send } from "lucide-react";

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

const StatusBadge = ({ status }: { status: EmailStatus }) => {
  const styles = {
    pending: "bg-muted text-muted-foreground",
    sending: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  const labels = {
    pending: "Pending",
    sending: "Sending...",
    success: "Success",
    failed: "Failed",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
};

export const EmailDashboard = () => {
  const { toast } = useToast();
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("");
  const [delay, setDelay] = useState(2);
  const [emailBody, setEmailBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const savedName = localStorage.getItem("defaultFromName");
    const savedEmail = localStorage.getItem("defaultFromEmail");
    
    if (savedName) {
      setFromName(savedName);
    } else {
      setFromName("Upsun User"); 
    }
    
    if (savedEmail) {
      setFromEmail(savedEmail);
    } else {
      const hostname = window.location.hostname.replace(/^www\./, '');
      const defaultEmail = `no-reply@${hostname}`;
      setFromEmail(defaultEmail);
    }
  }, []);

  const saveDefaults = () => {
    localStorage.setItem("defaultFromName", fromName);
    localStorage.setItem("defaultFromEmail", fromEmail);
    toast({
      title: "Settings Saved",
      description: "Your sender details have been saved as default.",
    });
  };

  const parseEmails = (text: string): string[] => {
    const emails = text
      .split(/[\n,]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email && email.includes("@"));
    return [...new Set(emails)];
  };

  const sendEmail = async (email: string): Promise<{ success: boolean; message?: string; raw?: any }> => {
    try {
      const response = await fetch("/api/index.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          fromName,
          fromEmail,
          subject,
          body: emailBody,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: "Non-JSON response", rawText: text };
      }

      if (!response.ok) {
        throw { message: data.message || `HTTP ${response.status}`, raw: data };
      }

      return { success: true, message: data.message, raw: data };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Unknown error",
        raw: error.raw || error,
      };
    }
  };

  const startSending = useCallback(async () => {
    const emails = parseEmails(recipients);

    if (emails.length === 0) return;

    if (currentIndexRef.current === 0 || results.length === 0) {
      const initialResults: EmailResult[] = emails.map((email, index) => ({
        index: index + 1,
        email,
        status: "pending",
        time: null,
        message: null,
        rawResponse: undefined,
      }));
      setResults(initialResults);
    }

    setIsRunning(true);
    isPausedRef.current = false;

    const emailList = currentIndexRef.current === 0 ? emails : emails;

    for (let i = currentIndexRef.current; i < emailList.length; i++) {
      if (isPausedRef.current) {
        currentIndexRef.current = i;
        setIsRunning(false);
        return;
      }

      const email = emailList[i];

      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "sending" as EmailStatus } : r
        )
      );

      const result = await sendEmail(email);
      const timestamp = new Date().toLocaleTimeString();

      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? {
                ...r,
                status: result.success ? "success" : "failed",
                time: timestamp,
                message: result.message || "Done",
                rawResponse: JSON.stringify(result.raw, null, 2),
              }
            : r
        )
      );

      if (i < emailList.length - 1 && !isPausedRef.current) {
        await sleep(delay * 1000);
      }
    }

    currentIndexRef.current = 0;
    setIsRunning(false);
  }, [recipients, fromName, fromEmail, subject, emailBody, delay, results.length]);

  const pauseSending = () => {
    isPausedRef.current = true;
  };

  const clearResults = () => {
    setResults([]);
    currentIndexRef.current = 0;
    setIsRunning(false);
    isPausedRef.current = false;
  };

  const totalEmails = results.length;
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const pendingCount = results.filter((r) => r.status === "pending" || r.status === "sending").length;

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 flex justify-center">
      {/* CHANGED: max-w-6xl to max-w-2xl for a centered single column layout */}
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Send className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Bulk Emailer</h1>
            <p className="text-sm text-muted-foreground">Send sequences via Upsun PHP</p>
          </div>
        </div>

        {/* SECTION 1: Sender & Configuration */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Configuration
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={saveDefaults} className="h-8 text-xs">
                <Save className="w-3 h-3 mr-2" />
                Save Defaults
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Name & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromName" className="text-xs">From Name</Label>
                <Input
                  id="fromName"
                  placeholder="Upsun User"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromEmail" className="text-xs">From Email</Label>
                <Input
                  id="fromEmail"
                  placeholder="no-reply@..."
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Delay & Subject */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 space-y-2">
                <Label htmlFor="delay" className="text-xs">Delay (s)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label htmlFor="subject" className="text-xs">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Subject line..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Message Body */}
        <Card className="shadow-sm">
           <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Message Body
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="body"
              placeholder="Hello HTML content supported..."
              className="min-h-[150px] resize-y"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* SECTION 3: Recipients & Actions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Recipients List
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              id="recipients"
              placeholder="Paste emails here (one per line)..."
              className="min-h-[120px] font-mono text-sm"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
            
            <div className="flex gap-3">
               {!isRunning ? (
                  <Button
                    onClick={startSending}
                    className="flex-1"
                    disabled={!recipients.trim()}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {currentIndexRef.current > 0 ? "Resume" : "Start Sending"}
                  </Button>
                ) : (
                  <Button
                    onClick={pauseSending}
                    variant="secondary"
                    className="flex-1"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                )}
                <Button
                  onClick={clearResults}
                  variant="outline"
                  disabled={isRunning}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: Results Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Log</CardTitle>
              <div className="flex gap-3 text-xs">
                <span className="text-muted-foreground">Sent: <b className="text-green-600">{successCount}</b></span>
                <span className="text-muted-foreground">Fail: <b className="text-red-600">{failedCount}</b></span>
                <span className="text-muted-foreground">Left: <b className="text-blue-600">{pendingCount}</b></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
              <div className="max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[40px] text-center">#</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[80px] text-center">Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-xs">
                          Waiting to start...
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.map((result) => (
                        <TableRow key={result.index}>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {result.index}
                          </TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[150px]">
                            {result.email}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={result.status} />
                          </TableCell>
                          <TableCell className="text-center">
                            {result.rawResponse && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[500px] max-h-[80vh] overflow-auto">
                                  <DialogHeader>
                                    <DialogTitle>Raw Response</DialogTitle>
                                  </DialogHeader>
                                  <pre className="mt-2 p-3 bg-muted rounded-md text-[10px] whitespace-pre-wrap">
                                    {result.rawResponse}
                                  </pre>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};