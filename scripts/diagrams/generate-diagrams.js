const { chromium } = require('playwright');
const path = require('path');

const diagramsDir = '/home/z/my-project/scripts/diagrams';
const diagrams = [
  { html: 'architecture-systeme.html', png: 'architecture-systeme.png', width: 1400, height: 900 },
  { html: 'pipeline-rag.html', png: 'pipeline-rag.png', width: 1400, height: 950 },
  { html: 'flux-utilisateur.html', png: 'flux-utilisateur.png', width: 1400, height: 1050 },
  { html: 'schema-entite-relation.html', png: 'schema-entite-relation.png', width: 1400, height: 1050 },
];

(async () => {
  const browser = await chromium.launch();
  
  for (const d of diagrams) {
    const context = await browser.newContext({
      viewport: { width: d.width, height: d.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    
    const filePath = path.join(diagramsDir, d.html);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });
    
    // Small delay to ensure rendering is complete
    await page.waitForTimeout(500);
    
    const outputPath = path.join(diagramsDir, d.png);
    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: d.width, height: d.height },
    });
    
    console.log(`✓ Generated: ${outputPath}`);
    await context.close();
  }
  
  await browser.close();
  console.log('\nAll 4 diagrams generated successfully!');
})();
