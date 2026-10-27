export type BomHierarchyNode={key:string;parentKey:string|null;parentCode:string|null;code:string;layer:number;item:Record<string,any>|null;bom:Record<string,any>|null;childKeys:string[];warning?:string};
export function buildBomHierarchy(root:Record<string,any>,catalog:Record<string,any>[],options?:{date?:string;maxDepth?:number;maxRows?:number}):{nodes:BomHierarchyNode[];warnings:Array<{key:string;code:string;parentCode:string|null;kind:string}>;date:string};
export function visibleBomHierarchy(nodes:BomHierarchyNode[],expanded:Set<string>,maxLayer?:number):BomHierarchyNode[];
