//pdf file se text extract 
//github repo se kya kya detail nikalna hai 
const path = require("path");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const wordExtractor = require("word-extractor");

async function textExtractor(file) {
    if (!file) {
        return "";
    }
    const fileType = path.extname(file.originalname).toLowerCase();

    let fileContent = "";
    if (fileType === ".pdf") {
        try {
            const parser = new PDFParse({
                data: new Uint8Array(file.buffer),
                verbosity: 0
            });
            await parser.load();
            const rawText = parser.getText();
            // getText() may return an array of page strings or a single string
            fileContent = Array.isArray(rawText) ? rawText.join("\n") : String(rawText || "");
        } catch (err) {
            console.error("PDF extraction error:", err);
            fileContent = "";
        }
    }
    if (fileType === ".docx") {
        const docObject = await mammoth.extractRawText({ buffer: file.buffer });
        fileContent = docObject.value || "";
    }

    if (fileType === ".doc") {
        const extractor = new wordExtractor();
        const doc = await extractor.extract(file.buffer);
        fileContent = doc.getBody() || "";
    }
    return fileContent;
}

module.exports = { textExtractor }