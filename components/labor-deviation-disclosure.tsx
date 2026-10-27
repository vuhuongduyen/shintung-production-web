"use client";
import {FeedbackActionButton} from './action-feedback';
import {useState} from 'react';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';

/** Portaled warning never participates in table row layout. Radix handles Escape,
 * outside interaction, focus return and collision-aware positioning on scroll. */
export default function LaborDeviationDisclosure({value,warning,explanation,label,closeLabel='Close'}:{value:string;warning:boolean;explanation:string;label:string;closeLabel?:string}) {
 const [open,setOpen]=useState(false);
 if(!warning)return <span className="labor-deviation-value">{value}</span>;
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild><FeedbackActionButton type="button" className="labor-deviation-disclosure" aria-label={`${value} · ${label}`}>
   <span className="labor-deviation-value">{value}</span>
   <span className="labor-deviation-arrow" aria-hidden="true">▸</span>
  </FeedbackActionButton></PopoverTrigger>
  <PopoverContent className="production-reason-popover labor-deviation-popover" aria-label={label} side="bottom" align="end" sideOffset={6} collisionPadding={12} hideWhenDetached>
   <div className="production-reason-heading"><span>{label}</span><FeedbackActionButton type="button" aria-label={closeLabel} onClick={()=>setOpen(false)}>×</FeedbackActionButton></div>
   <p>{explanation}</p>
  </PopoverContent>
 </Popover>;
}
