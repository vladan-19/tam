const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { execSync } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const originalHtmlPath = path.join(__dirname, 'uploads', 'tara.html');

// Osiguraj da direktorijum 'uploads' postoji
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/replace-text', async (req, res) => {
  const replaceText = req.body.replaceText;

  try {
    if (!fs.existsSync(originalHtmlPath)) {
      console.error('Originalni HTML fajl ne postoji.');
      return res.status(500).send('Originalni HTML fajl nije pronađen.');
    }

    let htmlContent = fs.readFileSync(originalHtmlPath, 'utf-8');
    htmlContent = htmlContent.replace(/UNA/g, replaceText);

    const modifiedHtmlPath = path.join(__dirname, 'uploads', 'tara_modified.html');
    fs.writeFileSync(modifiedHtmlPath, htmlContent);

    const pdfBuffer = await convertHtmlToPdf(modifiedHtmlPath);

    fs.unlinkSync(modifiedHtmlPath);

    const tempPdfPath = path.join(__dirname, 'uploads', `${Date.now()}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    res.download(tempPdfPath, (err) => {
      if (!err) {
        setTimeout(() => fs.unlinkSync(tempPdfPath), 10000);
      } else {
        console.error('Greška pri preuzimanju fajla:', err);
        res.status(500).send('Došlo je do greške pri preuzimanju fajla.');
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Došlo je do greške pri zameni teksta i generisanju PDF-a.');
  }
});

async function convertHtmlToPdf(htmlFilePath) {
  try {
    // Pokreni Puppeteer sa potrebnim argumentima i putanjom do Chromium-a
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: path.resolve(__dirname, '.cache/puppeteer/chrome/linux-131.0.6778.85/chrome-linux64/chrome'),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    console.log(`Učitavanje HTML fajla: ${htmlFilePath}`);
    await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('PDF je generisan');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      scale: 1
    });

    await browser.close();
    return pdfBuffer;

  } catch (error) {
    console.error('Greška pri generisanju PDF-a:', error);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`Server je pokrenut na http://localhost:${port}`);
});
