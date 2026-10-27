'use client';
import { Children, Fragment, cloneElement, isValidElement, useId, useRef, useLayoutEffect, useState, useSyncExternalStore, createContext, useContext, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type ChangeEvent } from 'react';
import {LookupInput,type LookupOption} from './LookupInput';
import { flushSync } from 'react-dom';
import {FeedbackActionButton} from '../action-feedback';
import {withActionFeedback, actionFeedbackVersion, isCancelledAction, actionFeedbackMessage, notifyActionFailure} from '../../lib/action-feedback';
import styles from './StandardToolbar.module.css';
import {blockDeniedAction, permissionDeniedMessage} from '../../lib/permission-feedback';
import {activateSearchButton, dispatchSearchEnter, isSearchPickerInput, dispatchSearchSelectEnter, markSearchSelectOpen, markSearchSelectClosed} from '../../lib/search-keyboard';
import {FilterPanel} from '../onspa-ui/FilterPanel';
import { translateToolbar, toolbarLocale, subscribeToolbarLocale } from './translations';

type BackLevel = 'parent' | 'lookup' | 'detail';
type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { disabledExplanation?: string; onDisabledAttempt?: (reason: string, trigger: HTMLElement) => void };
type Action = { backLevel?: BackLevel; kind: 'action'; props: ActionButtonProps; label: ReactNode; allowed?: boolean; intent?: 'action' | 'lookup' | 'clear' | 'search' | 'back' };
type Input = { kind: 'input'; suggestions?: LookupOption[]; props: InputHTMLAttributes<HTMLInputElement> & {ref?: React.Ref<HTMLInputElement>} };
function ToolbarInput({suggestions,locale,onQueryEnter,...props}:Input['props']&{suggestions?:LookupOption[];locale:string;onQueryEnter?:()=>void}) {return suggestions?<LookupInput options={suggestions} locale={locale} onQueryEnter={onQueryEnter} {...props}/>:<input {...props}/>;}
type Select = { kind: 'select'; props: SelectHTMLAttributes<HTMLSelectElement>; options: ReactNode };
type Field = { kind: 'field'; label: ReactNode; items: Items };
type Note = { kind: 'note'; label: ReactNode };
export type Item = Action | Input | Select | Field | Note | { kind: 'group'; items: Items };
export type Items = readonly (Item | Items | string | number | false | null | undefined)[];
export const ExportPermissionContext = createContext(true);
export const ToolbarPermissions = createContext<(name:string,label:string)=>boolean>(()=>true);
export const toolbar = {
  action: (props: Action['props'], label: ReactNode, allowed = true, intent?: Action['intent'], backLevel?: BackLevel): Action => ({ kind: 'action', props, label, allowed, intent, backLevel }),
  input: (props: Input['props'], suggestions?: LookupOption[]): Input => ({ kind: 'input', props, suggestions }),
  select: (props: Select['props'], options: ReactNode): Select => ({ kind: 'select', props, options }),
  field: (label: ReactNode, items: Items): Field => {
    const children = flat(items);
    const headings = children.filter((n): n is Note => n.kind === 'note');
    return {kind:'field', label: text(label).trim() ? label : headings.map(n=>n.label), items: text(label).trim() ? items : children.filter(n=>n.kind!=='note')};
  },
  group: (items: Items): Item => ({ kind: 'group', items }),
  note: (label: ReactNode): Note => ({ kind: 'note', label }),
};
function flat(items: Items): Item[] {
  return items.flatMap(item => item === null || item === undefined || item === false ? [] : typeof item === 'string' || typeof item === 'number' ? [{kind:'note',label:item} as Note] : Array.isArray(item) ? flat(item) : (item as Item).kind === 'group' ? flat((item as {items: Items}).items) : [item as Item]);
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (isValidElement<{children?: ReactNode}>(node)) return text(node.props.children);
  return Children.toArray(node).map(n => isValidElement<{children?: ReactNode}>(n) ? text(n.props.children) : typeof n === 'string' || typeof n === 'number' ? String(n) : '').join('');
}
function role(action: Action): 'action' | 'lookup' | 'clear' | 'search' | 'back' {
  if(action.intent)return action.intent;
  const s = translateToolbar(text(action.label), 'vi').toLowerCase();
  if (/quay lại|trở về/.test(s)) return 'back';
  if (/xóa lọc|xóa điều kiện/.test(s)) return 'clear';
  if (/tìm kiếm/.test(s)) return 'search';
  if (/tra cứu/.test(s)) return 'lookup';
  return 'action';
}
/** Choose the current UI layer before permission filtering. A blocked layer must not
 * fall through to a different navigation callback. Equal levels keep source order. */
export function selectToolbarBack(actions: readonly Action[]): Action | undefined {
  const levels = {parent: 0, lookup: 1, detail: 2};
  return actions.filter(action => role(action) === 'back').reduce<Action | undefined>((selected, action) =>
    !selected || levels[action.backLevel || 'parent'] > levels[selected.backLevel || 'parent'] ? action : selected, undefined);
}
/** Shared rendering only; business callbacks and backend authorization remain with each menu. */
export function StandardToolbar({ items, name = 'ONSPA', permissionFeedback = true }: { items: Items; name?: string; permissionFeedback?: boolean }) {
  const canUse = useContext(ToolbarPermissions);
  const locale = useSyncExternalStore(subscribeToolbarLocale, toolbarLocale, () => 'vi');
  const id = useId();
  const searchButton = useRef<HTMLButtonElement>(null);
  const focusTargets = useRef(new Map<string, HTMLElement>());
  const restoreFocusKey = useRef<string | null>(null);
  function focusTarget(key: string) {const explanation=focusTargets.current.get(`${key}:explanation`);return explanation?.getAttribute('role')==='button'?explanation:focusTargets.current.get(`${key}:native`)||null;}
  function rememberTarget(key: string, kind: 'native' | 'explanation', node: HTMLElement | null) {
    const slot = `${key}:${kind}`;
    if (!node && focusTargets.current.get(slot) === document.activeElement) restoreFocusKey.current = key;
    if (node) focusTargets.current.set(slot, node); else focusTargets.current.delete(slot);
  }
  useLayoutEffect(() => { if (restoreFocusKey.current) { focusTarget(restoreFocusKey.current)?.focus(); restoreFocusKey.current = null; } });
  const list = flat(items);
  const backAction = selectToolbarBack(list.filter((i): i is Action => i.kind === 'action'));
  const actions = list.filter((i): i is Action => i.kind === 'action' && (permissionFeedback || i.allowed !== false && canUse(name,translateToolbar(text(i.label),'vi'))));
  // A denied explicit search must not turn into an unguarded draft-only search.
  const hasExplicitSearch = list.some(i => i.kind === 'action' && role(i) === 'search');
  const actionRegistry = useRef(actions); actionRegistry.current = actions;
  const fieldOrder = (item: Item) => {
    if (item.kind !== 'field') return 3;
    const label = translateToolbar(text(item.label), 'vi').trim();
    if (/tra theo|查詢依據|搜尋欄位/i.test(label)) return 0;
    if (/nội dung tra|查詢內容|搜尋內容/i.test(label)) return 1;
    return 2;
  };
  const fields = list.filter(i => i.kind !== 'action').sort((a,b)=>fieldOrder(a)-fieldOrder(b));
  const hasSearch = fields.some(i => i.kind === 'field' && /tra theo|查詢依據|搜尋欄位/i.test(text(i.label)));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const registry = useRef(new Map<string, (value: string) => void>());
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const reportFailure = (message: string, trigger?: HTMLElement) => notifyActionFailure(message, trigger);
  const draftRef = useRef(draft); draftRef.current = draft;
  function translated(node: ReactNode): ReactNode {
    if (typeof node === 'string') {const value=translateToolbar(node, locale);return /excel/i.test(value)?value.replace(/\.xml/gi,'.xlsx'):value;}
    if (isValidElement<{children?: ReactNode;value?: unknown}>(node)) return cloneElement(node, node.type === 'option' && node.props.value === undefined ? {value:text(node.props.children)} : {}, translated(node.props.children));
    if (Array.isArray(node)) return node.map((n,i)=><Fragment key={i}>{translated(n)}</Fragment>);
    return node;
  }
  function applyDraft() {
    for (const [key,value] of Object.entries(draftRef.current)) flushSync(() => registry.current.get(key)?.(value));
    setDraft({});
  }
  async function invoke(action: Action, event: React.MouseEvent<HTMLButtonElement>) {
    if (blockDeniedAction(action.allowed !== false && canUse(name,translateToolbar(text(action.label),'vi')), event, () => { if(action.props.onDisabledAttempt) action.props.onDisabledAttempt(permissionDeniedMessage(locale), event.currentTarget); else reportFailure(permissionDeniedMessage(locale), event.currentTarget); })) return;
    if (busy.current || action.props.disabled) {
      event.preventDefault(); event.stopPropagation();
      const reason = busy.current ? actionFeedbackMessage('busy', locale) : action.props.disabledExplanation || actionFeedbackMessage('unavailable', locale);
      if (action.props.onDisabledAttempt) action.props.onDisabledAttempt(reason, event.currentTarget); else notifyActionFailure(reason, event.currentTarget, undefined, busy.current);
      return;
    }
    const kind = role(action);
    const label=translateToolbar(text(action.label),'vi');
    if(name!=='ProductionPayroll'&&/xuất.*(?:excel|pdf)|export.*(?:excel|pdf)/i.test(label)){
      const request=new CustomEvent('onspa-table-export',{cancelable:true,detail:{button:event.currentTarget}});
      if(!window.dispatchEvent(request))return;
    }
    if (kind === 'search') applyDraft();
    if (kind === 'clear' || kind === 'back' || kind === 'lookup') { setDraft({}); }
    const trigger = event.currentTarget;
    const triggerKey = trigger.dataset?.feedbackAction;
    const feedbackBefore = actionFeedbackVersion();
    busy.current = true; setPending(true);
    try { await withActionFeedback(() => (kind === 'search' ? actionRegistry.current.find(a=>role(a)==='search') : action)?.props.onClick?.(event),trigger); }
    catch(error) { if (!isCancelledAction(error) && actionFeedbackVersion() === feedbackBefore) notifyActionFailure(actionFeedbackMessage('failed', locale), trigger, () => triggerKey ? focusTarget(triggerKey) : trigger); }
    finally { busy.current = false; setPending(false); }
  }
  function button(action: Action, key: string) {
    const denied = action.allowed === false || !canUse(name,translateToolbar(text(action.label),'vi'));
    if(denied && !permissionFeedback) return null;
    const kind = role(action), label = translateToolbar(text(action.label), 'vi');
    const primary = /thêm mới|thêm người|thêm demand|tạo thêm|thêm lệnh/i.test(label);
    const danger = /hủy xác nhận|hủy chuyển nhân sự|hủy phân công|xóa|hủy phiếu|hủy lệnh|từ chối/i.test(label) && kind !== 'clear';
    const missing = !action.props.onClick && action.props.type !== 'submit';
    const {disabledExplanation, onDisabledAttempt, ...buttonProps} = action.props;
    const disabled = pending || (!denied && action.props.disabled) || missing;
    const explanation = pending ? actionFeedbackMessage('busy', locale) : disabledExplanation || (missing ? translateToolbar('Chức năng chưa được kết nối', locale) : actionFeedbackMessage('unavailable', locale));
    const explain = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      event.preventDefault(); event.stopPropagation();
      const permitted = action.allowed !== false && canUse(name,translateToolbar(text(action.label),'vi'));
      const reason = permitted ? explanation : permissionDeniedMessage(locale);
      if (onDisabledAttempt) onDisabledAttempt(reason, event.currentTarget); else notifyActionFailure(reason, event.currentTarget, () => focusTarget(key), pending && permitted);
    };
    const element = <button {...buttonProps} ref={node=>{rememberTarget(key, 'native', node);if(kind === 'search')searchButton.current = node;}} data-feedback-action={key} key={key} type={denied ? 'button' : action.props.type || 'button'}
      className={`${styles.button} ${kind === 'search' ? styles.search : primary ? styles.primary : danger ? styles.danger : ''}`}
      title={denied ? permissionDeniedMessage(locale) : action.props.title || (missing ? translateToolbar('Chức năng chưa được kết nối', locale) : undefined)}
      disabled={disabled}
      aria-disabled={denied || undefined}
      aria-pressed={kind === 'lookup' ? hasSearch : undefined}
      onClick={event => void invoke(action, event)}>{kind === 'back' ? translateToolbar('Quay lại', locale) : translated(action.label)}</button>;
    // The real action stays natively disabled. This separate trigger only explains why.
    return <span key={key} ref={node=>rememberTarget(key, 'explanation', node)} data-feedback-button="true" className={disabled?styles.disabledExplanation:styles.actionShell} role={disabled?'button':undefined} tabIndex={disabled?0:undefined}
      aria-label={disabled?`${translateToolbar(text(action.label), locale)}: ${explanation}`:undefined} title={disabled?explanation:undefined}
      onClick={disabled?explain:undefined} onKeyDown={disabled?event=>{if(event.key==='Enter'||event.key===' '){explain(event);}}:undefined}>
      {cloneElement(element, {tabIndex:disabled?-1:action.props.tabIndex, 'aria-hidden':disabled?true:action.props['aria-hidden']})}
    </span>;
  }
  function control(item: Item, key: string, caption: ReactNode = ''): ReactNode {
    if (item.kind === 'field') return <label key={key} className={styles.field}><span className={styles.label}>{translated(item.label)}</span><span className={styles.controls}>{flat(item.items).map((n,i)=>control(n,`${key}-${i}`,item.label))}</span></label>;
    if (item.kind === 'note') return <span className={styles.note} key={key}>{translated(item.label)}</span>;
    if (item.kind === 'action') return button(item,key);
    if (item.kind === 'group') return flat(item.items).map((n,i)=>control(n,`${key}-${i}`,caption));
    const p = item.props;
    const defer = hasSearch && !/Plan week|Report type|tháng áp dụng/i.test(p['aria-label'] || '') && !/tra theo|查詢依據|搜尋欄位|tháng áp dụng|tuần kế hoạch/i.test(text(caption)) && !(item.kind === 'input' && ['file','checkbox','hidden'].includes(item.props.type || ''));
    const value = defer && draft[key] !== undefined ? draft[key] : p.value;
    registry.current.set(key, v => {
      const target = { value: v };
      if (item.kind === 'input') item.props.onChange?.({target,currentTarget:target} as ChangeEvent<HTMLInputElement>);
      else item.props.onChange?.({target,currentTarget:target} as ChangeEvent<HTMLSelectElement>);
    });
    const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (defer) setDraft(old=>({...old,[key]:event.target.value}));
      else { setDraft({}); if(item.kind === 'input') item.props.onChange?.(event as ChangeEvent<HTMLInputElement>); else item.props.onChange?.(event as ChangeEvent<HTMLSelectElement>); }
    };
    if (item.kind === 'select') return <select {...item.props} key={key} id={item.props.id || `${id}-${key}`} className={styles.control} disabled={pending || p.disabled} value={value}
      onChange={change}
      onPointerDown={event=>{item.props.onPointerDown?.(event);if(!event.defaultPrevented)markSearchSelectOpen(event.currentTarget);}}
      onBlur={event=>{markSearchSelectClosed(event.currentTarget);item.props.onBlur?.(event);}}
      onKeyUp={event=>{if(event.key==='Enter'||event.key==='Escape')markSearchSelectClosed(event.currentTarget);item.props.onKeyUp?.(event);}}
      onKeyDown={event=>{item.props.onKeyDown?.(event);if(hasExplicitSearch||hasSearch)dispatchSearchSelectEnter(event,()=>activateSearchButton(searchButton.current));}}
      >{translated(item.options)}</select>;
    return <ToolbarInput suggestions={item.suggestions} locale={locale} onQueryEnter={hasExplicitSearch||defer?()=>activateSearchButton(searchButton.current):undefined} {...item.props} key={key} id={item.props.id || `${id}-${key}`} className={styles.control} disabled={pending || p.disabled} value={value} onChange={change}
      placeholder={item.props.placeholder ? translateToolbar(item.props.placeholder,locale) : undefined}
      onKeyDown={event=>{
        if (event.key === 'Enter' && (hasExplicitSearch || defer)) {
          // Reuse the actual button: latest drafts, permission, validation and busy guard.
          // Do not also run legacy per-field Enter callbacks (or submit a containing form).
          if (isSearchPickerInput(event.currentTarget)) { item.props.onKeyDown?.(event); return; }
          dispatchSearchEnter(event, () => activateSearchButton(searchButton.current));
          return;
        }
        item.props.onKeyDown?.(event);
      }} />;
  }
  return <section className={styles.frame} data-own-language="true" data-standard-toolbar={name} aria-label={`${name}: ${translateToolbar('CHỨC NĂNG',locale)}`} aria-busy={pending}>
    <div className={styles.scroll} tabIndex={0} role="region" aria-label={translateToolbar('CHỨC NĂNG',locale)}>
      <div className={styles.row}>
        <div className={styles.actions} data-toolbar-actions="true">{actions.filter(a=>role(a)==='action').map((a,i)=>button(a,`a${i}`))}</div>
        <FilterPanel className={styles.fields}>{fields.map((f,i)=>control(f,`f${i}`))}</FilterPanel>
        {(['lookup','search'] as const).flatMap(kind=>actions.filter(a=>role(a)===kind).map((a,i)=>button(a,`${kind}${i}`)))}
        {hasSearch && !hasExplicitSearch && <FeedbackActionButton ref={searchButton} type="button" className={`${styles.button} ${styles.search}`} onClick={applyDraft} disabled={pending} disabledExplanation={actionFeedbackMessage('busy', locale)}>{translateToolbar('Tìm kiếm',locale)}</FeedbackActionButton>}
        {actions.filter(a=>role(a)==='clear').map((a,i)=>button(a,`clear${i}`))}
        {backAction && button(backAction, 'back')}
      </div>
    </div>
  </section>;
}
