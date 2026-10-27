'use client';
import type {ReactNode} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import './production-stage-trial.css';
/** Shared presentation for existing production actions; retains their existing submit handlers. */
export default function ProductionWorkActionDialog({enabled=true,title,onBack,busy=false,children}:{enabled?:boolean;title:string;onBack:()=>void;busy?:boolean;children:ReactNode}){
 if(!enabled)return <>{children}</>;
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onBack();}}><DialogContent className="stage-trial stage-trial-dialog production-existing-action-dialog" showCloseButton={!busy} onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}><DialogTitle>{title}</DialogTitle><DialogDescription>Thao tác chính thức · Xác nhận sẽ ghi vào dữ liệu sản xuất.</DialogDescription><div className="stage-trial-scroll">{children}</div></DialogContent></Dialog>;
}
