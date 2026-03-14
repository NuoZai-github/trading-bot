import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.error('PAGE EXCEPTION:', error.message);
  });

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 5000 });
  } catch (e) {
    console.error('GOTO ERROR:', e.message);
  }
  
  await browser.close();
})();
