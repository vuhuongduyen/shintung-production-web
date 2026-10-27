"use client";
import {useContext} from 'react';
import {MenuHeadingContext} from './MenuHeadingContext';
import type {ComponentProps} from 'react';
export function PageTitle({children,variant='default',...props}:ComponentProps<'h1'>&{variant?:'default'|'menu-root'}) {
 const hideMenuHeading=useContext(MenuHeadingContext)&&variant==='menu-root';
 return <h1 {...props} className={`onspa-page-title ${hideMenuHeading?'onspa-menu-root-title':''} ${props.className||''}`}>{children}</h1>;
}
