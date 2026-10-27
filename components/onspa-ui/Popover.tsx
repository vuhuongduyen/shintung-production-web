'use client';
import type {ComponentProps,ReactNode} from 'react';
import {Popover as Root,PopoverTrigger,PopoverContent} from '../ui/popover';
import {Popover as Primitive} from 'radix-ui';
/** Opt-in detail surface. Existing Capacity row details remain unchanged pending UI-06. */
export function Popover({trigger,children,closeLabel,...props}:ComponentProps<typeof Root>&{trigger:ReactNode;closeLabel:string}) {
 return <Root {...props}><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align="start" collisionPadding={12} className="onspa-popover"><Primitive.Close className="onspa-popover-close" aria-label={closeLabel}>{closeLabel} ×</Primitive.Close>{children}</PopoverContent></Root>;
}
