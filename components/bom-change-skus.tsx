"use client";

import {FeedbackActionButton} from './action-feedback';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "./ui/dialog";

export function BomChangeSkus({ sku, skus, id }: { sku: string; skus?: string[]; id: string }) {
  const codes = skus?.length ? skus : [sku];
  return <span className="bom-change-skus">
    <span>{codes[0]}</span>
    {codes.length > 1 && <Dialog>
      <DialogTrigger asChild>
        <FeedbackActionButton type="button" className="bom-sku-more" aria-label={`Xem ${codes.length} SKU của phiếu ${id}`}
          onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
          +{codes.length - 1} ▾
        </FeedbackActionButton>
      </DialogTrigger>
      <DialogContent className="bom-sku-dialog" showCloseButton={false}
        onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Danh sách SKU</DialogTitle>
          <DialogDescription>{id} · {codes.length} SKU</DialogDescription>
        </DialogHeader>
        <DialogClose asChild><FeedbackActionButton type="button" className="bom-sku-dialog-close" aria-label="Đóng danh sách SKU">×</FeedbackActionButton></DialogClose>
        <div className="bom-sku-list">{codes.map(code => <div key={code}>{code}</div>)}</div>
      </DialogContent>
    </Dialog>}
  </span>;
}
