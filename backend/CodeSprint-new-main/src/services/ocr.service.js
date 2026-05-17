const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function extractTextFromImage(filePath) {
    const processedPath = filePath + '_processed.png';
    
    try {
        await sharp(filePath)
            .resize({ width: 2000, withoutEnlargement: false })
            .greyscale()
            .normalize()
            .sharpen()
            .toFile(processedPath);
    } catch (e) {
        console.log('Sharp error, используем оригинал:', e.message);
    }

    const imageToUse = fs.existsSync(processedPath) ? processedPath : filePath;

    const result = await Tesseract.recognize(imageToUse, 'rus+eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                process.stdout.write(`\rOCR progress: ${Math.round(m.progress * 100)}%`);
            }
        }
    });

    if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);

    console.log('');
    return result.data.text ? result.data.text.trim() : '';
}

module.exports = { extractTextFromImage };