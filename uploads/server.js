const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const { execSync } = require('child_process');  // Dodajte ovaj import

// Proverite da li je puppeteer instaliran i ako nije, instalirajte ga
try {
  require.resolve('puppeteer');  // Pokušava da pronađe puppeteer
} catch (error) {
  console.log('Puppeteer nije pronađen. Instaliram puppeteer...');
  execSync('npm install puppeteer', { stdio: 'inherit' });  // Pokreće npm install puppeteer
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

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
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    scale: 1
  });

  await browser.close();
  return pdfBuffer;
}

app.use('/downloads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
  console.log(`Server je pokrenut na http://localhost:${port}`);
});
