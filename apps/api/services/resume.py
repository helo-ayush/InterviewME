import io
import re
from fastapi import HTTPException


def extract_text(filename: str, data: bytes) -> str:
    lower = filename.lower()
    text = ""

    if lower.endswith(".pdf"):
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(data))
            extracted_pages = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    extracted_pages.append(page_text.strip())
            text = "\n\n".join(extracted_pages)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Failed to read PDF file: {exc}")

    elif lower.endswith(".docx"):
        import docx
        try:
            document = docx.Document(io.BytesIO(data))
            # Extract paragraphs
            lines = [p.text.strip() for p in document.paragraphs if p.text.strip()]
            # Extract table cells
            for table in document.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        lines.append(row_text)
            text = "\n".join(lines)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Failed to read DOCX file: {exc}")

    elif lower.endswith(".txt") or lower.endswith(".md"):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("latin-1", errors="ignore")

    else:
        raise HTTPException(status_code=400, detail="Supported formats: PDF, DOCX, TXT, MD")

    # Normalize whitespace to save database space while maintaining clarity
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail="No readable text could be extracted. If this is a scanned PDF image, please upload a text-based PDF or DOCX.",
        )

    # Cap at 80,000 characters to conserve database space
    return text[:80_000]

