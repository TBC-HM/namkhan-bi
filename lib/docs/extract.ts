// lib/docs/extract.ts
// Extracts plain text from common document formats. Returns "" if extraction
// fails — the classifier will fall back to filename-only.

export async function extractText(opts: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const { buffer, mimeType, fileName } = opts;
  const lower = fileName.toLowerCase();

  try {
    if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
      // pdf-parse v2.x: class-based API. Instantiate with { data }, then getText().
      // Wrap in 30s timeout — large/scanned compressed PDFs can hang pdf-parse.
      // @ts-ignore — no types
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await Promise.race([
          parser.getText(),
          new Promise<{ text: string }>((_, reject) =>
            setTimeout(() => reject(new Error('pdf-parse_timeout_30s')), 30_000)
          ),
        ]);
        return result?.text || '';
      } catch (e: any) {
        // Treat any extraction failure (timeout, malformed PDF, scanned-only) as empty text.
        // The classifier will fall back to filename + classification still works.
        return '';
      } finally {
        try { await parser.destroy(); } catch {}
      }
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lower.endsWith('.docx')
    ) {
      // mammoth converts DOCX → raw text or HTML. We want raw text for indexing.
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (
      mimeType === 'text/markdown' || mimeType === 'text/plain' ||
      lower.endsWith('.md') || lower.endsWith('.txt')
    ) {
      return buffer.toString('utf-8');
    }

    if (
      mimeType === 'text/csv' ||
      lower.endsWith('.csv')
    ) {
      // Just return raw — keywords more useful than parsed cells for indexing
      return buffer.toString('utf-8');
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      lower.endsWith('.pptx')
    ) {
      // PPTX = ZIP of XML. Each slide lives at ppt/slides/slide{N}.xml.
      // Text nodes are <a:t>...</a:t>. Extract them in slide order.
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => {
          const ai = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0');
          const bi = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0');
          return ai - bi;
        });
      const out: string[] = [];
      for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.files[slideFiles[i]].async('string');
        // Extract all <a:t>...</a:t> contents
        const texts: string[] = [];
        const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml)) !== null) {
          // Decode common XML entities
          const t = m[1]
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
          if (t.trim()) texts.push(t);
        }
        if (texts.length > 0) out.push(`=== Slide ${i + 1} ===\n${texts.join('\n')}`);
      }
      // Also pull speaker notes if present
      const notesFiles = Object.keys(zip.files)
        .filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
      if (notesFiles.length > 0) {
        out.push('\n=== Speaker notes ===');
        for (const nf of notesFiles) {
          const xml = await zip.files[nf].async('string');
          const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(xml)) !== null) {
            const t = m[1].replace(/&amp;/g, '&').trim();
            if (t) out.push(t);
          }
        }
      }
      return out.join('\n').slice(0, 200_000);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      lower.endsWith('.xlsx') || lower.endsWith('.xls')
    ) {
      // Iterate every sheet, dump as TSV text. Caps at 200k chars for huge workbooks.
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const out: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        // sheet_to_csv with TSV delimiter — readable by classifier + Q/A
        const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false, strip: true });
        if (tsv.trim().length > 0) {
          out.push(`=== Sheet: ${sheetName} ===\n${tsv}`);
        }
      }
      return out.join('\n\n').slice(0, 200_000);
    }

    // PPTX, images: skip extraction for v1, classifier uses filename only
    return '';
  } catch (e: any) {
    console.error('[docs/extract] failed:', fileName, e?.message);
    return '';
  }
}
