import Tesseract from 'tesseract.js'

async function performOCR(imagePath) {
    await Tesseract.recognize(
        imagePath,
        'eng',
        { logger: m => console.log(m) }
      ).then(({ data: { text } }) => {
        console.log(text);
        return text;
      })
  }

  export default performOCR;