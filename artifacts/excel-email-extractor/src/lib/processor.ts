import * as XLSX from "xlsx";
import Papa from "papaparse";
import { saveAs } from "file-saver";

export interface CleanedRow {
  name: string;
  email: string;
  id: string; // for React keys
}

export interface ProcessingStats {
  originalRows: number;
  finalRows: number;
  emailsExtracted: number;
  duplicatesRemoved: number;
  invalidSkipped: number;
  processingTimeMs: number;
}

export interface ProcessingResult {
  rows: CleanedRow[];
  stats: ProcessingStats;
}

const NAME_COL_VARIANTS = [
  "name", "full name", "contact name", "first name", "last name", 
  "person", "client", "lead"
];

const EMAIL_COL_VARIANTS = [
  "email", "emails", "email address", "contact email", "e-mail"
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const WHITESPACE_REGEX = /[\s\u00A0\u200B\u200C\u200D\uFEFF]+/g;
const SPLIT_REGEX = /[,;|/\n\r]+/;

function cleanString(str: string): string {
  if (!str) return "";
  return str.replace(WHITESPACE_REGEX, " ").trim();
}

function detectColumns(headers: string[]): { nameColIdx: number; emailColIdx: number } {
  let nameColIdx = -1;
  let emailColIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const cleanHeader = headers[i]?.toLowerCase().trim() || "";
    
    if (nameColIdx === -1 && NAME_COL_VARIANTS.includes(cleanHeader)) {
      nameColIdx = i;
    }
    
    if (emailColIdx === -1 && EMAIL_COL_VARIANTS.includes(cleanHeader)) {
      emailColIdx = i;
    }
  }

  return { nameColIdx, emailColIdx };
}

export async function processFile(file: File): Promise<ProcessingResult> {
  const startTime = performance.now();
  
  let data: string[][] = [];
  
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    data = result.data;
  } else {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
  }

  if (data.length < 2) {
    throw new Error("File must contain at least a header row and one data row.");
  }

  // Handle object array if sheet_to_json returns objects instead of arrays (when header: 1 is used, it returns array of arrays)
  const headers = data[0] || [];
  
  const { nameColIdx, emailColIdx } = detectColumns(headers.map(String));
  
  if (emailColIdx === -1) {
    throw new Error("Could not detect an email column. Please ensure the file has a column named 'Email'.");
  }
  
  // If no name column is found, we'll just use an empty string for names
  
  const originalRows = data.length - 1;
  let emailsExtracted = 0;
  let invalidSkipped = 0;
  let duplicatesRemoved = 0;
  
  const cleanedRows: CleanedRow[] = [];
  const seenEmails = new Set<string>();
  
  let idCounter = 1;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const rawName = nameColIdx !== -1 ? String(row[nameColIdx] || "") : "";
    const rawEmailField = String(row[emailColIdx] || "");
    
    const name = cleanString(rawName);
    const emails = rawEmailField.split(SPLIT_REGEX).map(cleanString).filter(Boolean);
    
    for (const email of emails) {
      emailsExtracted++;
      
      if (!EMAIL_REGEX.test(email)) {
        invalidSkipped++;
        continue;
      }
      
      const emailLower = email.toLowerCase();
      
      if (seenEmails.has(emailLower)) {
        duplicatesRemoved++;
        continue;
      }
      
      seenEmails.add(emailLower);
      
      cleanedRows.push({
        id: `row-${idCounter++}`,
        name,
        email: emailLower
      });
    }
  }

  const processingTimeMs = performance.now() - startTime;

  return {
    rows: cleanedRows,
    stats: {
      originalRows,
      finalRows: cleanedRows.length,
      emailsExtracted,
      duplicatesRemoved,
      invalidSkipped,
      processingTimeMs: Math.round(processingTimeMs)
    }
  };
}

export function downloadXLSX(rows: CleanedRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map(({ name, email }) => ({ name, email })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cleaned Emails");
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(data, 'cleaned_emails.xlsx');
}

export function downloadCSV(rows: CleanedRow[]) {
  const csvStr = Papa.unparse(rows.map(({ name, email }) => ({ name, email })));
  const data = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
  saveAs(data, 'cleaned_emails.csv');
}
