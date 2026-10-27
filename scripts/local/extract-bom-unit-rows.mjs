import {readFileSync,writeFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {bomRowsFromPdfTextItems,analyzeBomUnitRows} from '../../lib/bom-unit-rows.mjs';

const [input,output]=process.argv.slice(2);
if(!input)throw new Error('Usage: node scripts/local/extract-bom-unit-rows.mjs <input.pdf> [output.json]');
const pdf=await pdfjs.getDocument({data:new Uint8Array(readFileSync(resolve(input)))}).promise;
const rows=[];
for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
 const page=await pdf.getPage(pageNumber),content=await page.getTextContent();
 rows.push(...bomRowsFromPdfTextItems(content.items));
}
const analysis=analyzeBomUnitRows(rows);
if(output)writeFileSync(resolve(output),JSON.stringify({sourceFile:basename(input),rows},null,2));
console.log(JSON.stringify({pages:pdf.numPages,rows:rows.length,totalProductCodes:analysis.totalProductCodes,validLevel0:Object.keys(analysis.units).length,missingLevel0:analysis.missingLevel0.length,blankLevel0:analysis.blankLevel0.length,duplicateLevel0:analysis.duplicateLevel0.length,conflictingLevel0:analysis.conflictingLevel0.length,example102XS02001:analysis.units['102XS02001']||null},null,2));
