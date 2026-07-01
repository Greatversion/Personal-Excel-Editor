import { useState, useCallback, useRef, useMemo } from "react";
import {
  UploadCloud, FileType, CheckCircle2, Download, FileSpreadsheet,
  Search, ArrowUpDown, Loader2, X, FileText, File
} from "lucide-react";
import { processMultipleFiles, downloadCSV, downloadXLSX, type CleanedRow, type ProcessingStats } from "@/lib/processor";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_EXTENSIONS = ["xlsx", "xls", "csv", "pdf"];

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (ext === "csv") return <FileType className="h-4 w-4 text-green-500" />;
  return <FileSpreadsheet className="h-4 w-4 text-blue-500" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const { toast } = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Analyzing data...");

  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [rows, setRows] = useState<CleanedRow[]>([]);

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "email">("email");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const rowsPerPage = 25;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid: File[] = [];
    const rejected: string[] = [];

    Array.from(incoming).forEach((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        valid.push(f);
      } else {
        rejected.push(f.name);
      }
    });

    if (rejected.length > 0) {
      toast({
        title: "Unsupported file type",
        description: `Skipped: ${rejected.join(", ")}`,
        variant: "destructive",
      });
    }

    if (valid.length > 0) {
      setQueuedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const deduped = valid.filter((f) => !existingNames.has(f.name));
        return [...prev, ...deduped];
      });
    }
  }, [toast]);

  const removeFile = useCallback((name: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleProcess = async () => {
    if (queuedFiles.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setStats(null);
    setRows([]);
    setSearch("");
    setPage(1);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 88));
    }, 120);

    try {
      for (let i = 0; i < queuedFiles.length; i++) {
        setStatusText(`Processing ${queuedFiles[i].name} (${i + 1}/${queuedFiles.length})…`);
        await new Promise((r) => setTimeout(r, 30));
      }

      const result = await processMultipleFiles(queuedFiles);

      clearInterval(progressInterval);
      setProgress(100);
      setStatusText("Done!");

      setTimeout(() => {
        setStats(result.stats);
        setRows(result.rows);
        setIsProcessing(false);
      }, 400);

      toast({
        title: "Processing complete",
        description: `${result.stats.finalRows.toLocaleString()} clean emails from ${result.stats.filesProcessed} file${result.stats.filesProcessed !== 1 ? "s" : ""} in ${result.stats.processingTimeMs}ms.`,
      });
    } catch (err: unknown) {
      clearInterval(progressInterval);
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({
        title: "Error processing files",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortCol, sortAsc]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, page]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  const toggleSort = (col: "name" | "email") => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans selection:bg-primary/20">
      <div className="max-w-6xl mx-auto space-y-8">

        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Excel Email Extractor</h1>
          <p className="text-muted-foreground mt-2 font-medium max-w-2xl">
            Upload PDFs, Excel, or CSV files — mix and match — and get one clean, deduplicated email list instantly.
          </p>
        </header>

        {/* Drop Zone */}
        <Card
          className={`border-2 border-dashed transition-all duration-200 overflow-hidden ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        >
          <div
            className="p-10 flex flex-col items-center justify-center text-center cursor-pointer"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-zone"
          >
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              multiple
              accept=".csv,.xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                if (e.target) e.target.value = "";
              }}
              data-testid="input-file"
            />

            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <UploadCloud className="h-8 w-8 text-primary" />
            </div>

            <h3 className="text-xl font-semibold mb-2">Drop files here or click to browse</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Accepts <strong>.pdf</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>, and <strong>.csv</strong>.
              Add multiple files — they will be processed together into one combined output.
              All processing is done locally in your browser.
            </p>
          </div>

          {isProcessing && (
            <div className="bg-muted px-10 py-5 border-t border-border">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {statusText}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </Card>

        {/* Queued Files */}
        {queuedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Files queued ({queuedFiles.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs h-7"
                onClick={() => setQueuedFiles([])}
                disabled={isProcessing}
                data-testid="button-clear-all"
              >
                Clear all
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {queuedFiles.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2.5 group"
                  data-testid={`file-item-${f.name}`}
                >
                  {getFileIcon(f.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                    disabled={isProcessing}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-1 flex-shrink-0"
                    data-testid={`button-remove-${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              onClick={handleProcess}
              disabled={isProcessing || queuedFiles.length === 0}
              className="w-full sm:w-auto font-semibold"
              size="lg"
              data-testid="button-process"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <File className="mr-2 h-4 w-4" />
                  Extract Emails from {queuedFiles.length} file{queuedFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results */}
        {stats && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Processing Results
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({stats.filesProcessed} file{stats.filesProcessed !== 1 ? "s" : ""} — completed in {stats.processingTimeMs}ms)
                </span>
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider">Original Rows</CardDescription>
                    <CardTitle className="text-2xl">{stats.originalRows.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider">Emails Found</CardDescription>
                    <CardTitle className="text-2xl">{stats.emailsExtracted.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider text-destructive">Invalid Skipped</CardDescription>
                    <CardTitle className="text-2xl">{stats.invalidSkipped.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-wider text-accent">Duplicates Removed</CardDescription>
                    <CardTitle className="text-2xl">{stats.duplicatesRemoved.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-primary">Final Clean Rows</CardDescription>
                    <CardTitle className="text-3xl text-primary">{stats.finalRows.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </div>

            {/* Actions bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card border rounded-lg p-4 shadow-sm">
              <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails or names..."
                  className="pl-9 w-full max-w-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => downloadCSV(rows)}
                  disabled={rows.length === 0}
                  className="flex-1 sm:flex-none font-medium"
                  data-testid="button-download-csv"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button
                  onClick={() => downloadXLSX(rows)}
                  disabled={rows.length === 0}
                  className="flex-1 sm:flex-none font-medium"
                  data-testid="button-download-excel"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Download Excel (.xlsx)
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors w-[35%]"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        Name
                        {sortCol === "name" && <ArrowUpDown className="h-3 w-3 text-primary" />}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => toggleSort("email")}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        Email Address
                        {sortCol === "email" && <ArrowUpDown className="h-3 w-3 text-primary" />}
                      </div>
                    </TableHead>
                    <TableHead className="w-[20%] text-muted-foreground font-medium">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                        {search ? "No matches found for your search." : "No data available."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-muted-foreground">{row.name || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{row.source}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    <span className="font-medium text-foreground">{(page - 1) * rowsPerPage + 1}</span>
                    {" "}to{" "}
                    <span className="font-medium text-foreground">{Math.min(page * rowsPerPage, sortedRows.length)}</span>
                    {" "}of{" "}
                    <span className="font-medium text-foreground">{sortedRows.length}</span> results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      Previous
                    </Button>
                    <div className="text-sm font-medium px-2">Page {page} of {totalPages}</div>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
