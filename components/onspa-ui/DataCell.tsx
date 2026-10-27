import type {ComponentProps} from 'react';
export type CellKind='text'|'code'|'date'|'time'|'number';
type Props=ComponentProps<'td'>&{kind?:CellKind;'data-type'?:CellKind};
/** Column semantics are supplied by the caller, never guessed from the value. */
export function DataCell({children,kind,...props}:Props) {
 const numericClass=props.className?.split(/\s+/).some(name=>['number','numeric','qty-cell'].includes(name));
 const type=props['data-type']??kind??(numericClass?'number':undefined);
 return <td {...props} data-type={numericClass && type === 'number' ? undefined : type}>{children}</td>;
}
