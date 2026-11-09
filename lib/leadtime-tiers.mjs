export function validLeadtimeTiers(tiers) {
 return Array.isArray(tiers)&&tiers.length>0&&tiers.length<=100&&tiers.every(t=>t&&typeof t.moq==='number'&&Number.isFinite(t.moq)&&t.moq>=0&&typeof t.value==='number'&&Number.isInteger(t.value)&&t.value>=0)&&new Set(tiers.map(t=>t.moq)).size===tiers.length;
}
export function pickLeadtimeTier(tiers,quantity) {
 if(!validLeadtimeTiers(tiers)||typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<0)return null;
 const sorted=[...tiers].sort((a,b)=>a.moq-b.moq);
 return (sorted.find(t=>t.moq>=quantity)||sorted.at(-1)).value;
}
