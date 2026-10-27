import type {ComponentProps,ReactNode} from 'react';
export function DataTable({children,...props}:ComponentProps<'div'>) {
 return <div {...props} className={`onspa-data-table ${props.className||''}`}>{children}</div>;
}
