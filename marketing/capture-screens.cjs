// Capture the actual project template/controller at 3x pixel density.
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage({viewport:{width:1000,height:650},deviceScaleFactor:3});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../preview/index.html')).href);
  await page.waitForFunction(()=>chessPage.screen==='board'&&chessPage.heading.includes('红方走'));
  await page.locator('.piece').nth(54).click();
  await page.locator('.piece').nth(45).click();
  await page.locator('#watch').screenshot({path:path.join(__dirname,'01-真实界面-完整棋盘.png')});
  await page.getByRole('button',{name:'菜单',exact:true}).click();
  await page.getByRole('button',{name:'人机关卡 · 选择难度',exact:true}).click();
  await page.locator('#watch').screenshot({path:path.join(__dirname,'02-真实界面-五关人机.png')});
  await page.getByRole('button',{name:'返回菜单',exact:true}).click();
  await page.getByRole('button',{name:'作者主页',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.author-avatar').complete);
  await page.locator('#watch').screenshot({path:path.join(__dirname,'03-真实界面-作者主页.png')});
  console.log('Saved three 3x-resolution actual app preview captures.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
