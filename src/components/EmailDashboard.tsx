import { useState, useRef, useCallback } from "react";
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
import { Mail, Play, Pause, Trash2, Clock, User, FileText } from "lucide-react";

type EmailStatus = "pending" | "sending" | "success" | "failed";

interface EmailResult {
  index: number;
  email: string;
  status: EmailStatus;
  time: string | null;
  message: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const StatusBadge = ({ status }: { status: EmailStatus }) => {
  const styles = {
    pending: "bg-muted text-muted-foreground",
    sending: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    failed: "bg-destructive/10 text-destructive",
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
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("");
  const [delay, setDelay] = useState(2);
  const [emailBody, setEmailBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);

  const parseEmails = (text: string): string[] => {
    const emails = text
      .split(/[\n,]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email && email.includes("@"));
    return [...new Set(emails)];
  };

  const sendEmail = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch("http://localhost:5000/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          fromName,
          subject,
          body: emailBody,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const startSending = useCallback(async () => {
    const emails = parseEmails(recipients);

    if (emails.length === 0) {
      return;
    }

    // Initialize results if starting fresh
    if (currentIndexRef.current === 0 || results.length === 0) {
      const initialResults: EmailResult[] = emails.map((email, index) => ({
        index: index + 1,
        email,
        status: "pending",
        time: null,
        message: null,
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

      // Update status to sending
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "sending" as EmailStatus } : r
        )
      );

      const result = await sendEmail(email);
      const timestamp = new Date().toLocaleTimeString();

      // Update with final status
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? {
                ...r,
                status: result.success ? ("success" as EmailStatus) : ("failed" as EmailStatus),
                time: timestamp,
                message: result.message || null,
              }
            : r
        )
      );

      // Apply delay before next email (except for the last one)
      if (i < emailList.length - 1 && !isPausedRef.current) {
        await sleep(delay * 1000);
      }
    }

    currentIndexRef.current = 0;
    setIsRunning(false);
  }, [recipients, fromName, subject, emailBody, delay, results.length]);

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
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk Email Dashboard</h1>
            <p className="text-muted-foreground">Send emails sequentially with custom delays</p>
          </div>
        </div>

        {/* Row 1: Sender Settings & Email Content side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sender Settings */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" />
                Sender Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="John Doe"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delay">Delay (seconds)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="delay"
                      type="number"
                      min={0}
                      className="pl-10"
                      value={delay}
                      onChange={(e) => setDelay(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                Email Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="body">Email Body</Label>
                <Textarea
                  id="body"
                  placeholder="Write your email content here..."
                  className="min-h-[140px] resize-none"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Recipients */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5 text-primary" />
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-2">
                <Label htmlFor="recipients">
                  Bulk Email Addresses
                  <span className="text-muted-foreground text-sm ml-2">
                    (comma or newline separated)
                  </span>
                </Label>
                <Textarea
                  id="recipients"
                  placeholder="john@example.com&#10;jane@example.com&#10;bob@example.com"
                  className="min-h-[120px] resize-none font-mono text-sm"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                />
              </div>
              <div className="flex flex-col justify-end gap-3">
                {!isRunning ? (
                  <Button
                    onClick={startSending}
                    className="w-full"
                    disabled={!recipients.trim()}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {currentIndexRef.current > 0 ? "Resume Sending" : "Start Sending"}
                  </Button>
                ) : (
                  <Button
                    onClick={pauseSending}
                    variant="secondary"
                    className="w-full"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                )}
                <Button
                  onClick={clearResults}
                  variant="outline"
                  className="w-full"
                  disabled={isRunning}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Results
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 3: Sending Results */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Sending Results</CardTitle>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{totalEmails}</span>
                </span>
                <span className="text-muted-foreground">
                  Sent: <span className="font-semibold text-success">{successCount}</span>
                </span>
                <span className="text-muted-foreground">
                  Failed: <span className="font-semibold text-destructive">{failedCount}</span>
                </span>
                <span className="text-muted-foreground">
                  Pending: <span className="font-semibold text-info">{pendingCount}</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="w-[50px] text-center">#</TableHead>
                      <TableHead>Recipient Email</TableHead>
                      <TableHead className="w-[100px] text-center">Status</TableHead>
                      <TableHead className="w-[90px] text-center">Time</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-[150px] text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Mail className="w-10 h-10 text-muted-foreground/30" />
                            <p>No emails processed yet</p>
                            <p className="text-sm">
                              Add recipients and click "Start Sending"
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.map((result) => (
                        <TableRow key={result.index}>
                          <TableCell className="text-center font-medium text-muted-foreground">
                            {result.index}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {result.email}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={result.status} />
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {result.time || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {result.message || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};