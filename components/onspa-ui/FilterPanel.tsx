import type {ComponentProps} from 'react';
export function FilterPanel({children,...props}:ComponentProps<'div'>) {
 return <div {...props} className={`onspa-filter-panel ${props.className||''}`}>{children}</div>;
}
