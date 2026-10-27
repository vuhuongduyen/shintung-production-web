"use client";
import {useContext} from 'react';
import {MenuHeadingContext} from './MenuHeadingContext';
import type {ComponentProps,ReactNode} from 'react';
export function PageHeader({title,children,variant='default',...props}:Omit<ComponentProps<'header'>,'title'>&{title:ReactNode;variant?:'default'|'menu-root'}) {
 const hideMenuHeading=useContext(MenuHeadingContext)&&variant==='menu-root';
 return <header {...props} className={`onspa-page-header ${hideMenuHeading?'onspa-menu-root-header':''} ${props.className||''}`}><h1 className={hideMenuHeading?'onspa-menu-root-title':undefined}>{title}</h1>{children}</header>;
}
