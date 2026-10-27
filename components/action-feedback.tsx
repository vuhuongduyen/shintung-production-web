'use client';
import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type Ref} from 'react';
import {ACTION_FEEDBACK_EVENT, ACTION_FEEDBACK_CLEAR_EVENT, ACTION_FEEDBACK_DURATION, withActionFeedback, actionFeedbackVersion, isCancelledAction, actionFeedbackMessage, notifyActionFailure, type ActionFeedbackDetail} from '../lib/action-feedback';
import {permissionDeniedMessage} from '../lib/permission-feedback';
import {subscribeToolbarLocale, toolbarLocale} from './standard-toolbar/translations';
import styles from './action-feedback.module.css';
import {useOperationNotices} from './use-operation-notices';
import {operationResolution} from '../lib/operation-notice.mjs';
import {createPortal} from 'react-dom';

/** One overlay above dialogs, independent of table/row layout and mounted for every account. */
export function ActionFeedbackHost() {
  useOperationNotices();
  const [notice, setNotice] = useState<ActionFeedbackDetail | null>(null);
  const panel = useRef<HTMLElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const locale = useSyncExternalStore(subscribeToolbarLocale, toolbarLocale, () => 'vi');
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<ActionFeedbackDetail>).detail;
      if (detail && typeof detail.message === 'string' && detail.message.trim()) {
        const resolved = detail.resolveTrigger?.() || detail.trigger;
        const focused = resolved?.isConnected ? resolved : document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // Keep the live region and close control inside the active modal focus scope.
        const dialog = focused?.closest<HTMLElement>('[role="dialog"]');
        setContainer(dialog || null);
        setNotice(detail);
      }
    };
    const clear = () => {setNotice(null);setContainer(null);};
    window.addEventListener(ACTION_FEEDBACK_EVENT, receive);
    window.addEventListener(ACTION_FEEDBACK_CLEAR_EVENT, clear);
    return () => {window.removeEventListener(ACTION_FEEDBACK_EVENT, receive);window.removeEventListener(ACTION_FEEDBACK_CLEAR_EVENT, clear);};
  }, []);
  useEffect(() => {
    if (!notice) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Do not close a dialog underneath this notification with the same Escape.
      event.preventDefault(); event.stopPropagation();
      const target = notice.resolveTrigger?.() || notice.trigger;
      if (panel.current?.contains(document.activeElement) && target?.isConnected) target.focus();
      notice.onDismiss?.();setNotice(null);
    };
    const timer = window.setTimeout(() => {
      const target = notice.resolveTrigger?.() || notice.trigger;
      if(panel.current?.contains(document.activeElement) && target?.isConnected)target.focus();
      notice.onDismiss?.();setNotice(current => current === notice ? null : current);
    }, notice.kind==='success'?6000:ACTION_FEEDBACK_DURATION);
    window.addEventListener('keydown', dismiss, true);
    return () => {window.clearTimeout(timer);window.removeEventListener('keydown', dismiss, true);};
  }, [notice]);
  if (!notice) return null;
  const content = <section ref={panel} data-global-operation-notice="true" className={`${styles.notice} ${notice.kind==='success'?styles.success:''}`} role={notice.kind==='success'?'status':'alert'} aria-live="assertive" aria-atomic="true">
    <span className={styles.icon} aria-hidden="true">{notice.kind==='success'?'✓':'!'}</span>
    <div className={styles.body}><strong className={styles.heading}>{notice.kind==='success'?(locale==='en'?'Operation completed':locale==='zh'?'操作成功':'Thao tác thành công'):(locale==='en'?'Operation unsuccessful':locale==='zh'?'操作未成功':'Thao tác không thành công')}</strong>{notice.kind!=='success'&&<b>{locale==='en'?'Reason':locale==='zh'?'原因':'Nguyên nhân'}</b>}<p>{notice.message}</p>{notice.kind!=='success'&&<p className={styles.resolution}><b>{locale==='en'?'How to resolve':locale==='zh'?'處理方式':'Hướng xử lý'}:</b><br/>{operationResolution(notice.message,locale)}</p>}</div>
    <button type="button" aria-label={locale === 'en' ? 'Close notification' : locale === 'zh' ? '關閉通知' : 'Đóng thông báo'} onClick={() => {
      const target = notice.resolveTrigger?.() || notice.trigger;
      if (panel.current?.contains(document.activeElement) && target?.isConnected) target.focus();
      notice.onDismiss?.();setNotice(null);
    }}>×</button>
  </section>;
  return container?.isConnected ? createPortal(content, container) : content;
}

export type FeedbackActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  disabledExplanation?: string;
  stableContainer?: boolean;
  allowed?: boolean;
  deniedExplanation?: string;
};
/** Explanation target is separate: a blocked mutation remains natively disabled. */
export function FeedbackActionButton({stableContainer=true, disabled, disabledExplanation, allowed = true, deniedExplanation, onClick, children, ref: forwardedRef, ...props}: FeedbackActionButtonProps) {
  const locale = useSyncExternalStore(subscribeToolbarLocale, toolbarLocale, () => 'vi');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const explanationRef = useRef<HTMLSpanElement | null>(null);
  const restoreFocus = useRef(false);
  const assignButton = (node: HTMLButtonElement | null) => {
    if (!node && buttonRef.current === document.activeElement) restoreFocus.current = true;
    buttonRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node;
  };
  const assignExplanation = (node: HTMLSpanElement | null) => {
    if (!node && explanationRef.current === document.activeElement) restoreFocus.current = true;
    explanationRef.current = node;
  };
  useLayoutEffect(() => {
    if (restoreFocus.current) { (!allowed||disabled||pending?explanationRef.current:buttonRef.current)?.focus(); restoreFocus.current = false; }
  });
  const blocked = !allowed || disabled || pending;
  const reason = !allowed ? deniedExplanation || permissionDeniedMessage(locale) : pending ? actionFeedbackMessage('busy', locale) : disabledExplanation || actionFeedbackMessage('unavailable', locale);
  const button = <button {...props} data-onspa-action={props.className?'custom':'default'} ref={assignButton} type={!allowed ? 'button' : props.type} disabled={Boolean(blocked)}
    aria-disabled={blocked || undefined} tabIndex={blocked ? -1 : props.tabIndex} aria-hidden={blocked ? true : props['aria-hidden']}
    onClick={async event => {
      if (!allowed || disabled || busy.current) {
        event.preventDefault(); event.stopPropagation();
        notifyActionFailure(busy.current ? actionFeedbackMessage('busy', locale) : reason, event.currentTarget, undefined, busy.current && allowed);
        return;
      }
      const trigger = event.currentTarget;
      busy.current = true;
      const feedbackBefore = actionFeedbackVersion();
      try {
        const result: unknown = withActionFeedback(() => onClick?.(event),trigger);
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          setPending(true); await result;
        }
      } catch(error) { if (!isCancelledAction(error) && actionFeedbackVersion() === feedbackBefore) notifyActionFailure(actionFeedbackMessage('failed', locale), explanationRef.current || buttonRef.current || trigger, () => explanationRef.current?.getAttribute('role')==='button'?explanationRef.current:buttonRef.current); }
      finally { busy.current = false; setPending(false); }
    }}>{children}</button>;
  return blocked || stableContainer ? <span ref={assignExplanation} data-feedback-button="true" className={blocked?styles.explanation:styles.stable} role={blocked?"button":undefined} tabIndex={blocked?(props.tabIndex === -1 ? -1 : 0):undefined}
    aria-label={blocked?props['aria-label']:undefined} title={blocked?reason:undefined} aria-disabled={blocked?"true":undefined}
    onClick={blocked?event => {event.preventDefault(); event.stopPropagation(); notifyActionFailure(reason, event.currentTarget, () => explanationRef.current?.getAttribute('role')==='button'?explanationRef.current:buttonRef.current, pending && allowed);}:undefined}
    onKeyDown={blocked?event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); event.stopPropagation(); notifyActionFailure(reason, event.currentTarget, () => explanationRef.current?.getAttribute('role')==='button'?explanationRef.current:buttonRef.current, pending && allowed);}}:undefined}>
    <span className={styles.accessibleLabel} aria-hidden={blocked?undefined:true}>{props['aria-label'] || children}</span>{button}
  </span> : button;
}
