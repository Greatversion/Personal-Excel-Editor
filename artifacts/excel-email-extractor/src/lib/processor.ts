import * as XLSX from "xlsx";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

export interface CleanedRow {
  name: string;
  email: string;
  id: string;
  source: string;
}

export interface ProcessingStats {
  originalRows: number;
  finalRows: number;
  emailsExtracted: number;
  duplicatesRemoved: number;
  invalidSkipped: number;
  processingTimeMs: number;
  filesProcessed: number;
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

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const EMAIL_IN_TEXT_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
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
    if (nameColIdx === -1 && NAME_COL_VARIANTS.includes(cleanHeader)) nameColIdx = i;
    if (emailColIdx === -1 && EMAIL_COL_VARIANTS.includes(cleanHeader)) emailColIdx = i;
  }

  return { nameColIdx, emailColIdx };
}

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n");
}

async function processSpreadsheet(
  file: File,
  seenEmails: Set<string>,
  idCounter: { value: number }
): Promise<{
  rows: CleanedRow[];
  originalRows: number;
  emailsExtracted: number;
  duplicatesRemoved: number;
  invalidSkipped: number;
}> {
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
    throw new Error(`"${file.name}" must contain at least a header row and one data row.`);
  }

  const headers = data[0] || [];
  const { nameColIdx, emailColIdx } = detectColumns(headers.map(String));

  if (emailColIdx === -1) {
    throw new Error(`"${file.name}": Could not detect an email column. Ensure the file has a column named 'Email'.`);
  }

  const originalRows = data.length - 1;
  let emailsExtracted = 0;
  let invalidSkipped = 0;
  let duplicatesRemoved = 0;
  const rows: CleanedRow[] = [];

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

      rows.push({
        id: `row-${idCounter.value++}`,
        name,
        email: emailLower,
        source: file.name,
      });
    }
  }

  return { rows, originalRows, emailsExtracted, duplicatesRemoved, invalidSkipped };
}

async function processPdf(
  file: File,
  seenEmails: Set<string>,
  idCounter: { value: number }
): Promise<{
  rows: CleanedRow[];
  originalRows: number;
  emailsExtracted: number;
  duplicatesRemoved: number;
  invalidSkipped: number;
}> {
  const text = await extractTextFromPdf(file);
  const allMatches = text.match(EMAIL_IN_TEXT_REGEX) || [];

  const originalRows = allMatches.length;
  let emailsExtracted = 0;
  let duplicatesRemoved = 0;
  const rows: CleanedRow[] = [];

  for (const rawEmail of allMatches) {
    const email = rawEmail.trim().toLowerCase();
    emailsExtracted++;

    if (seenEmails.has(email)) {
      duplicatesRemoved++;
      continue;
    }

    seenEmails.add(email);

    rows.push({
      id: `row-${idCounter.value++}`,
      name: "",
      email,
      source: file.name,
    });
  }

  return { rows, originalRows, emailsExtracted, duplicatesRemoved, invalidSkipped: 0 };
}

export async function processMultipleFiles(files: File[]): Promise<ProcessingResult> {
  const startTime = performance.now();
  const seenEmails = new Set<string>();
  const idCounter = { value: 1 };

  let allRows: CleanedRow[] = [];
  let totalOriginalRows = 0;
  let totalEmailsExtracted = 0;
  let totalDuplicatesRemoved = 0;
  let totalInvalidSkipped = 0;

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let result;

    if (ext === "pdf") {
      result = await processPdf(file, seenEmails, idCounter);
    } else {
      result = await processSpreadsheet(file, seenEmails, idCounter);
    }

    allRows = allRows.concat(result.rows);
    totalOriginalRows += result.originalRows;
    totalEmailsExtracted += result.emailsExtracted;
    totalDuplicatesRemoved += result.duplicatesRemoved;
    totalInvalidSkipped += result.invalidSkipped;
  }

  const processingTimeMs = performance.now() - startTime;

  return {
    rows: allRows,
    stats: {
      originalRows: totalOriginalRows,
      finalRows: allRows.length,
      emailsExtracted: totalEmailsExtracted,
      duplicatesRemoved: totalDuplicatesRemoved,
      invalidSkipped: totalInvalidSkipped,
      processingTimeMs: Math.round(processingTimeMs),
      filesProcessed: files.length,
    },
  };
}

export function downloadXLSX(rows: CleanedRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map(({ name, email }) => ({ name, email })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cleaned Emails");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const data = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(data, "cleaned_emails.xlsx");
}

export function downloadCSV(rows: CleanedRow[]) {
  const csvStr = Papa.unparse(rows.map(({ name, email }) => ({ name, email })));
  const data = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
  saveAs(data, "cleaned_emails.csv");
}
