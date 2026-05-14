/**
 * Text Extractor — Extracts plain text from various file formats.
 * Designed for Netlify Functions (serverless) compatibility.
 *
 * Supports: PDF, DOCX, XLSX, PPTX, TXT, CSV, HTML
 * Skips: Images, Videos, Audio (not processable without OCR)
 */

export interface ExtractionResult {
    text: string;
    pageCount?: number;
    error?: string;
}

/**
 * Extract text from a file buffer based on its MIME type.
 */
export async function extractText(
    buffer: Buffer,
    mimeType: string,
    fileName: string
): Promise<ExtractionResult> {
    try {
        let result: ExtractionResult;

        if (mimeType === 'application/pdf') {
            result = await extractFromPdf(buffer, fileName);
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimeType === 'application/msword'
        ) {
            result = await extractFromDocx(buffer);
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel' ||
            mimeType === 'text/csv'
        ) {
            result = await extractFromSpreadsheet(buffer);
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            mimeType === 'application/vnd.ms-powerpoint'
        ) {
            result = await extractFromPptx(buffer);
        } else if (mimeType === 'text/plain' || mimeType === 'text/html' || mimeType === 'application/rtf') {
            result = extractFromText(buffer, mimeType);
        } else {
            return { text: '', error: `Tipo file non supportato: ${mimeType}` };
        }

        // Universal sanity gate: any extractor that returns garbage (binary noise,
        // mostly-non-printable bytes) is treated as a failure here, not downstream.
        // Avoids 144k-char buffer dumps reaching the embedder.
        if (result.text && !looksLikeRealText(result.text)) {
            return {
                text: '',
                pageCount: result.pageCount,
                error: 'Testo estratto non riconoscibile (probabile contenuto binario/scansione). Necessita OCR.',
            };
        }

        return result;
    } catch (error: any) {
        console.error(`[text-extractor] Errore "${fileName}":`, error.message);
        return { text: '', error: `Errore estrazione: ${error.message}` };
    }
}

/**
 * Heuristic: real prose has a high ratio of printable characters and reasonable
 * average word length. Binary buffers leaked through PDF "fallback" extractors
 * fail both checks (lots of control bytes, very long pseudo-words).
 */
function looksLikeRealText(text: string): boolean {
    if (text.length < 50) return true; // too short to judge — let upstream decide

    const sample = text.length > 20000 ? text.slice(0, 20000) : text;

    // Count printable: letters, digits, common punctuation, whitespace, accented (incl. CJK ranges)
    let printable = 0;
    for (let i = 0; i < sample.length; i++) {
        const code = sample.charCodeAt(i);
        const isControl = code < 32 && code !== 9 && code !== 10 && code !== 13;
        const isReplacement = code === 0xfffd;
        if (!isControl && !isReplacement) printable++;
    }
    const printableRatio = printable / sample.length;
    if (printableRatio < 0.85) return false;

    // Avg "word" length — binary garbage tends to either have huge runs of
    // non-space bytes (very long fake words) or clusters of single chars
    const words = sample.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 5) return false;
    const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
    if (avgLen > 30 || avgLen < 1.5) return false;

    return true;
}

// --- PDF ---
// unpdf is serverless-native: zero-canvas, no DOMMatrix polyfill needed,
// dynamically imported to keep cold start light.
async function extractFromPdf(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
    try {
        const { extractText: unpdfExtract } = await import('unpdf');
        const data = await unpdfExtract(new Uint8Array(buffer), { mergePages: true });

        const text = (data.text || '').trim();
        const pageCount = data.totalPages || 0;

        // Almost no extractable text → likely a scanned/image PDF
        if (text.length < 50 && pageCount > 0) {
            return {
                text: '',
                pageCount,
                error: `PDF scansionato (immagine) - ${pageCount} pagine senza testo estraibile. Necessita OCR.`,
            };
        }

        return { text, pageCount };
    } catch (pdfError: any) {
        console.warn(`[text-extractor] unpdf failed for "${fileName}":`, pdfError.message);
        // No buffer-regex fallback — it produces garbage on FlateDecode-compressed
        // PDFs (Google Docs export, modern producers). Fail loudly instead.
        return { text: '', error: `Impossibile estrarre testo dal PDF: ${pdfError.message}` };
    }
}

// --- DOCX ---
async function extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value || '' };
    } catch (error: any) {
        return { text: '', error: `Errore DOCX: ${error.message}` };
    }
}

// --- Spreadsheet (XLSX, XLS, CSV) ---
async function extractFromSpreadsheet(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const textParts: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;
            textParts.push(`--- Foglio: ${sheetName} ---`);
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            for (const row of rows) {
                const rowText = row.map((c: any) => String(c).trim()).filter((c: string) => c.length > 0).join(' | ');
                if (rowText) textParts.push(rowText);
            }
        }

        return { text: textParts.join('\n'), pageCount: workbook.SheetNames.length };
    } catch (error: any) {
        return { text: '', error: `Errore spreadsheet: ${error.message}` };
    }
}

// --- PPTX ---
async function extractFromPptx(buffer: Buffer): Promise<ExtractionResult> {
    try {
        const JSZip = (await import('jszip')).default;
        const archive = await JSZip.loadAsync(buffer);
        const textParts: string[] = [];
        let slideCount = 0;

        const slideFiles = Object.keys(archive.files)
            .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
            .sort();

        for (const slidePath of slideFiles) {
            slideCount++;
            const content = await archive.files[slidePath].async('string');
            const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
            if (textMatches) {
                const slideText = textMatches
                    .map(match => match.replace(/<\/?a:t>/g, '').trim())
                    .filter(t => t.length > 0)
                    .join(' ');
                if (slideText) {
                    textParts.push(`--- Slide ${slideCount} ---`);
                    textParts.push(slideText);
                }
            }
        }

        return { text: textParts.join('\n'), pageCount: slideCount };
    } catch (error: any) {
        return { text: '', error: `Errore PPTX: ${error.message}` };
    }
}

// --- Plain text / HTML ---
function extractFromText(buffer: Buffer, mimeType: string): ExtractionResult {
    let text = buffer.toString('utf-8');

    if (mimeType === 'text/html') {
        text = text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    return { text };
}
