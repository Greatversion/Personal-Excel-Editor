import { useState, useCallback, useRef, useMemo } from "react";
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Download, FileSpreadsheet, Search, ArrowUpDown, Loader2 } from "lucide-react";
import { processFile, downloadCSV, downloadXLSX, type CleanedRow, type ProcessingStats } from "@/lib/processor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [filename, setFilename] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [rows, setRows] = useState<CleanedRow[]>([]);
  
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "email">("email");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const rowsPerPage = 25;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.",
        variant: "destructive",
      });
      return;
    }

    setFilename(file.name);
    setIsProcessing(true);
    setProgress(0);
    setStats(null);
    setRows([]);
    setSearch("");
    setPage(1);

    // Simulate progress for UI feedback
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 15, 90));
    }, 100);

    try {
      // Small delay to let the UI update
      await new Promise(r => setTimeout(r, 100));
      
      const result = await processFile(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setTimeout(() => {
        setStats(result.stats);
        setRows(result.rows);
        setIsProcessing(false);
      }, 500);

      toast({
        title: "Processing complete",
        description: `Cleaned ${result.stats.finalRows} emails in ${result.stats.processingTimeMs}ms.`,
      });

    } catch (err: any) {
      clearInterval(progressInterval);
      setIsProcessing(false);
      toast({
        title: "Error processing file",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive"
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
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const lowerSearch = search.toLowerCase();
    return rows.filter(r => 
      r.name.toLowerCase().includes(lowerSearch) || 
      r.email.toLowerCase().includes(lowerSearch)
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortCol, sortAsc]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, page]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  const toggleSort = (col: "name" | "email") => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans selection:bg-primary/20">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Excel Email Extractor</h1>
          <p className="text-muted-foreground mt-2 font-medium max-w-2xl">
            Precision data-cleaning utility for messy contact lists. Upload a CSV or Excel file to extract, validate, and deduplicate emails instantly.
          </p>
        </header>

        {/* Upload Zone */}
        <Card className={`border-2 border-dashed transition-all duration-200 overflow-hidden ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
          <div 
            className="p-12 flex flex-col items-center justify-center text-center cursor-pointer"
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
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
                // Reset to allow re-upload of same file
                if (e.target) e.target.value = '';
              }}
              data-testid="input-file"
            />
            
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              {isProcessing ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8 text-primary" />
              )}
            </div>
            
            <h3 className="text-xl font-semibold mb-2">
              {isProcessing ? "Processing file..." : "Drop your file here or click to browse"}
            </h3>
            
            <p className="text-sm text-muted-foreground max-w-md">
              Accepts .xlsx, .xls, and .csv. We automatically detect Name and Email columns, split multiple emails in single cells, and remove invalid or duplicate entries. All processing is done locally in your browser.
            </p>
            
            {filename && !isProcessing && (
              <div className="mt-6 flex items-center gap-2 text-sm font-medium bg-muted px-4 py-2 rounded-full">
                <FileType className="h-4 w-4" />
                {filename}
              </div>
            )}
          </div>
          
          {isProcessing && (
            <div className="bg-muted px-12 py-6 border-t border-border">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span>Analyzing data...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </Card>

        {stats && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Row */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Processing Results
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Completed in {stats.processingTimeMs}ms)
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card border rounded-lg p-4 shadow-sm">
              <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search clean emails..." 
                  className="pl-9 w-full max-w-sm"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
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
                      className="cursor-pointer hover:bg-muted/80 transition-colors w-[40%]"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        Name
                        {sortCol === "name" && (
                          <ArrowUpDown className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => toggleSort("email")}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        Email Address
                        {sortCol === "email" && (
                          <ArrowUpDown className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-32 text-center text-muted-foreground">
                        {search ? "No matches found for your search." : "No data available."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-muted-foreground">{row.name || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.email}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{(page - 1) * rowsPerPage + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * rowsPerPage, sortedRows.length)}</span> of <span className="font-medium text-foreground">{sortedRows.length}</span> results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm font-medium px-2">
                      Page {page} of {totalPages}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
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
