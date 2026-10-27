'use client';
/** Only exposes removal of grants already present on the record being edited. */
export default function ExistingPermissionGrants({existing,known,value,onChange,disabled=false}:{existing:string[];known:string[];value:string[];onChange:(value:string[])=>void;disabled?:boolean}) {
  const legacy=[...new Set(existing)].filter(grant=>grant&&!known.includes(grant));
  if(!legacy.length)return null;
  return <fieldset disabled={disabled} className="permission-field">
    <legend>Quyền hiện có ngoài danh mục</legend>
    <small>Các quyền này được giữ nguyên. Bỏ chọn quyền cần gỡ, rồi chọn Lưu lại để áp dụng.</small>
    {legacy.map(grant=><label key={grant}><input type="checkbox" aria-label={grant} checked={value.includes(grant)} onChange={event=>onChange(event.target.checked?[...new Set([...value,grant])]:value.filter(item=>item!==grant))}/><span>{grant}</span></label>)}
  </fieldset>;
}
