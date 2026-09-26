import io

from fastapi import HTTPException


def extract_text(filename: str, data: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    elif lower.endswith(".docx"):
        import docx

        document = docx.Document(io.BytesIO(data))
        text = "\n".join(p.text for p in document.paragraphs)
    else:
        raise HTTPException(status_code=400, detail="Only PDF or DOCX files are supported")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="No extractable text found in the file")
    return text[:200_000]
