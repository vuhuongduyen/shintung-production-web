export type BomUnitRow={productCode:string;level:string;unit:string};
export type BomUnitAnalysis={totalProductCodes:number;units:Record<string,string>;missingLevel0:string[];blankLevel0:string[];duplicateLevel0:string[];conflictingLevel0:Array<{productCode:string;units:string[]}>};
export function bomRowsFromPdfTextItems(items:Array<{str?:string;transform?:number[]}>):BomUnitRow[];
export function analyzeBomUnitRows(rows:BomUnitRow[]):BomUnitAnalysis;
