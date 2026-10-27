'use client';
import {useEffect} from 'react';
// Keep the existing DOM and React ownership; all menus share the same measured stack.
export default function WorkspacePinnedHeader(){
 useEffect(()=>{
  let frame=0;const observed=new Set<HTMLElement>();let resizeObserver:ResizeObserver;const marked=new Set<HTMLElement>(),paths=new Set<HTMLElement>();
  const clear=()=>{for(const e of marked){e.removeAttribute('data-onspa-pinned');e.style.removeProperty('--onspa-pin-top');}for(const e of paths)e.removeAttribute('data-onspa-pin-path');marked.clear();paths.clear();};
  const measure=()=>{frame=0;reconcileObservers();const root=document.querySelector<HTMLElement>('.workspace-session:not([hidden]) .app-shell');if(!root)return;
   const main=root.querySelector<HTMLElement>('main');const table=main?.querySelector<HTMLElement>('table');const bars=Array.from(main?.querySelectorAll<HTMLElement>('[data-standard-toolbar]')||[]).filter(e=>e.getClientRects().length&&!e.closest('[role="dialog"],dialog,.drawer,.detail-panel,.page-overlay,.production-modal,.cap-adjust-backdrop'));const selectedToolbar=[...bars].reverse().find(e=>!table||e.getBoundingClientRect().top<table.getBoundingClientRect().top)||bars[0];const toolbar=selectedToolbar?.closest<HTMLElement>('.work-command-row')||selectedToolbar;
   if(main){const rect=main.getBoundingClientRect(),style=getComputedStyle(main);root.style.setProperty('--onspa-content-left',`${rect.left+(parseFloat(style.paddingLeft)||0)}px`);root.style.setProperty('--onspa-content-right',`${Math.max(0,document.documentElement.clientWidth-rect.right)+(parseFloat(style.paddingRight)||0)}px`);}
   root.style.setProperty('--onspa-header-height',`${root.querySelector('.topbar')?.getBoundingClientRect().height||96}px`);
   const stack:HTMLElement[]=[];const add=(e:Element|null)=>{if(e instanceof HTMLElement&&e.matches('.onspa-menu-root-title,.onspa-menu-root-header:not(:has(> :not(h1))),.safety-rules-title:has(> .onspa-menu-root-title)'))return;if(!(e instanceof HTMLElement)||!e.getClientRects().length||e.closest('[role="dialog"],dialog,.drawer,.detail-panel,.page-overlay,.production-modal,.cap-adjust-backdrop')||stack.some(parent=>parent===e||parent.contains(e)))return;if(e.matches('script,style,.overlay')||e.getBoundingClientRect().height>window.innerHeight*.45)return;stack.push(e);};
   add(root.querySelector('.workspace-tabs'));
   if(main&&toolbar){const chain:HTMLElement[]=[];for(let e:HTMLElement|null=toolbar;e&&e!==main;e=e.parentElement)chain.unshift(e);
    let parent:HTMLElement=main;for(const child of chain){for(const sibling of Array.from(parent.children)){if(sibling===child)break;if(!sibling.querySelector('table')&&!sibling.matches('table'))add(sibling);}parent.setAttribute('data-onspa-pin-path','true');paths.add(parent);parent=child;}add(toolbar);
   }
   main?.querySelectorAll<HTMLElement>('.production-inline-message,.plan-notice,.notice.success,.notice.error,[role="alert"]').forEach(add);
   for(const e of marked){if(!stack.includes(e)){e.removeAttribute('data-onspa-pinned');e.style.removeProperty('--onspa-pin-top');marked.delete(e);}}
   let top=root.querySelector('.topbar')?.getBoundingClientRect().height||96;for(const e of stack){if(!e.hasAttribute('data-onspa-pinned'))e.setAttribute('data-onspa-pinned','true');if(e.style.getPropertyValue('--onspa-pin-top')!==`${top}px`)e.style.setProperty('--onspa-pin-top',`${top}px`);marked.add(e);const style=getComputedStyle(e);top+=e.getBoundingClientRect().height+Math.max(0,parseFloat(style.marginTop)||0)+Math.max(0,parseFloat(style.marginBottom)||0);}
   root.style.setProperty('--onspa-pinned-height',`${top}px`);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  resizeObserver=new ResizeObserver(schedule);
  const reconcileObservers=()=>{
   const root=document.querySelector<HTMLElement>('.workspace-session:not([hidden]) .app-shell');
   const active=new Set<HTMLElement>();
   if(root){active.add(root);root.querySelectorAll<HTMLElement>('.topbar,.workspace-tabs,[data-standard-toolbar],.onspa-page-header,.onspa-page-title,.cap-daily-settings,.work-command-row').forEach(e=>active.add(e));}
   for(const node of observed)if(!active.has(node)){resizeObserver.unobserve(node);observed.delete(node);}
   for(const node of active)if(!observed.has(node)){resizeObserver.observe(node);observed.add(node);}
  };
  const mutation=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'?r.target instanceof Element&&r.target.classList.contains('workspace-session'):!(r.target instanceof Element&&r.target.closest('table,.table-pagination')))){reconcileObservers();schedule();}});mutation.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);reconcileObservers();schedule();
  return()=>{mutation.disconnect();resizeObserver.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);cancelAnimationFrame(frame);clear();};
 },[]);return null;
}
