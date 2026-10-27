export const initialProgressSearchFilters=(line)=>({field:'',value:'',line:line||'all',state:'all'});
export const progressSearchHasField=(filters)=>Boolean(filters.field);

// Empty SKU/LSX/name searches must not replace an already applied filter.
export const progressSearchCanApply=(filters)=>!filters.field||filters.field==='week'||Boolean(String(filters.value??'').trim());
