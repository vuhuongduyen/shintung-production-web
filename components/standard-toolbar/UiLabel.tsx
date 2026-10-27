"use client";
import {useSyncExternalStore} from 'react';
import {subscribeToolbarLocale,toolbarLocale,translateToolbar} from './translations';
/** Controlled UI text: avoids mutating React-owned menu nodes during language changes. */
export function UiLabel({children}:{children:string}) {
 const locale=useSyncExternalStore(subscribeToolbarLocale,toolbarLocale,()=> 'vi' as const);
 return <span data-own-language="true" style={{display:"contents"}}>{translateToolbar(children,locale)}</span>;
}
