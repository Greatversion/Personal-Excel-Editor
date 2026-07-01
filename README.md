# Excel Email Extractor

A fast, privacy-first email extraction and cleaning tool that runs entirely in your browser. Upload messy contact files — PDFs, Excel spreadsheets, or CSVs — and get back a single clean, deduplicated list of valid email addresses ready to download.

No server. No uploads. Your files never leave your machine.

---

## What it does

1. **Accepts multiple files at once** — drop in any combination of PDFs, Excel (.xlsx / .xls), and CSV files.
2. **Detects email and name columns automatically** — works regardless of how the column is labelled in your spreadsheet.
3. **Extracts every email it can find** — including multiple emails stuffed into a single cell, and any email address embedded anywhere in a PDF document.
4. **Cleans and validates** — strips whitespace, invisible characters, and filters out anything that isn't a real email address.
5. **Removes duplicates** — even across multiple files. Each email address appears only once in the output.
6. **Lets you preview, search, and sort** results in a table before downloading.
7. **Exports to Excel (.xlsx) or CSV** with exactly two columns: `name` and `email`.

---

## Supported file types

| Format | Extension | How emails are found |
|--------|-----------|----------------------|
| Excel  | `.xlsx`, `.xls` | Reads the first sheet, auto-detects name and email columns |
| CSV    | `.csv` | Parses with header detection, auto-detects name and email columns |
| PDF    | `.pdf` | Scans all text on every page and extracts any valid email address found |

---

## How to use it

1. **Drop files** onto the upload zone, or click it to browse. You can select multiple files at once.
2. Review the **file queue** — each file shows its type, name, and size. Remove any you don't want with the ✕ button.
3. Click **"Extract Emails from X files"** to start processing.
4. View the **statistics panel** to see how many emails were found, how many duplicates were removed, and how many invalid entries were skipped.
5. **Search or sort** the results table. A Source column shows which file each email came from.
6. Click **Download CSV** or **Download Excel (.xlsx)** to save the cleaned list.

---

## Column detection (Excel & CSV)

The tool automatically recognises name and email columns regardless of capitalisation or exact wording.

**Recognised name column headers:**
`Name`, `Full Name`, `Contact Name`, `First Name`, `Last Name`, `Person`, `Client`, `Lead`

**Recognised email column headers:**
`Email`, `Emails`, `Email Address`, `Contact Email`, `E-mail`

The output always uses lowercase `name` and `email` as column headers.

---

## Email splitting

If a single cell contains multiple email addresses, the tool splits them into separate rows and duplicates the name on each row.

**Supported separators:**
- Comma `,`
- Semicolon `;`
- Pipe `|`
- Slash `/`
- Newline

**Example:**

| Name | Emails |
|------|--------|
| John Doe | john@gmail.com; john@yahoo.com |

Becomes:

| name | email |
|------|-------|
| John Doe | john@gmail.com |
| John Doe | john@yahoo.com |

---

## Data cleaning rules

- Trims leading and trailing whitespace
- Collapses multiple internal spaces into one
- Removes invisible/zero-width characters (`\u00A0`, `\u200B`, `\u200C`, `\u200D`, `\uFEFF`)
- Validates emails against the pattern: `name@domain.tld`
- Discards anything that does not match
- Deduplicates case-insensitively (e.g. `John@Gmail.com` and `john@gmail.com` count as the same address)
- All output emails are lowercased

---

## Statistics explained

| Stat | Meaning |
|------|---------|
| Original Rows | Total rows read from all files (excluding header rows) |
| Emails Found | Total individual email addresses parsed (before validation) |
| Invalid Skipped | Addresses that failed the email format check |
| Duplicates Removed | Addresses that appeared more than once across all files |
| Final Clean Rows | Unique valid email addresses in the output |

---

## Output format

The downloaded file always contains exactly two columns:

```
name, email
John Doe, john@gmail.com
Alice, alice@example.com
```

For PDF files where no name is available, the `name` column is left blank.

---

## Privacy

All processing happens locally in your browser using JavaScript. No data is sent to any server. Closing the tab clears everything.

---

## Tech stack

| Library | Purpose |
|---------|---------|
| React + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS + shadcn/ui | Styling and components |
| [SheetJS (xlsx)](https://sheetjs.com/) | Excel file parsing and export |
| [PapaParse](https://www.papaparse.com/) | CSV parsing and export |
| [PDF.js (pdfjs-dist)](https://mozilla.github.io/pdf.js/) | PDF text extraction |
| [FileSaver.js](https://github.com/eligrey/FileSaver.js/) | Client-side file downloads |

---

## Deployment

This is a fully static frontend application. No server or backend is required.

**Build for production:**
```bash
pnpm --filter @workspace/excel-email-extractor run build
```

The output is in `dist/`. Deploy it to any static host:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- Any web server that can serve static files
