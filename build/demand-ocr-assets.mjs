import {mkdirSync,copyFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
// Reproducible, same-origin OCR runtime. Images remain in the user's browser.
export function prepareDemandOcrAssets(){
 const target=resolve('public/ocr');mkdirSync(target,{recursive:true});
 copyFileSync(resolve('node_modules/tesseract.js/dist/worker.min.js'),resolve(target,'worker.min.js'));
 for(const name of readdirSync('node_modules/tesseract.js-core').filter(n=>n.endsWith('.wasm.js')))copyFileSync(resolve('node_modules/tesseract.js-core',name),resolve(target,name));
 copyFileSync(resolve('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),resolve(target,'eng.traineddata.gz'));
}
