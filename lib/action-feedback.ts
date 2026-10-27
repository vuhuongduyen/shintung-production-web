import {recordClientAttempt} from './client-action-audit';
function submittedForm(target?:HTMLElement|null){
 if(typeof document==='undefined')return undefined;
 const form=target?.closest('form,[role="dialog"],.department-change-dialog,.production-modal')||document.querySelector('[role="dialog"]')||target?.closest('main');if(!form)return undefined;
 const fields:Record<string,string|boolean>={};let index=0,budget=18000;
 for(const node of Array.from(form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea')).slice(0,100)){
 const label=node.getAttribute('aria-label')||node.name||node.closest('label')?.textContent?.trim().slice(0,100)||`Trường ${++index}`;
 if(/password|hidden|file/.test(node.type)||/password|passwd|pwd|secret|token|credential|authorization|cookie|mật.?khẩu|密碼/i.test(`${label} ${node.name} ${node.id} ${node.autocomplete}`))continue;
 if(budget<=0)break;budget-=label.length+Math.min(node.value.length,1000)+30;
 fields[`${index++ +1}. ${label}`]=node instanceof HTMLInputElement&&['checkbox','radio'].includes(node.type)?node.checked:node.tagName==='SELECT'?Array.from((node as HTMLSelectElement).selectedOptions).map(o=>o.textContent||o.value).join(', '):node.value.slice(0,1000);
 }
 return fields;
}
let actionAttemptDepth = 0;
let attemptContext:{operation:string;submittedInput:unknown;at:number}|undefined;
export function currentActionContext(){return attemptContext&&Date.now()-attemptContext.at<60000?attemptContext:undefined;}
export function isExplicitActionAttempt() { return actionAttemptDepth > 0; }
/** Only the synchronous start of an explicitly wired action; never infer intent from global events. */
export function withActionFeedback<T>(run: () => T,trigger?:HTMLElement|null): T { if(trigger)attemptContext={operation:trigger.textContent?.trim().slice(0,120)||'Thao tác',submittedInput:submittedForm(trigger),at:Date.now()};actionAttemptDepth++; try { return run(); } finally { actionAttemptDepth--; } }
/** Explicit UI notifications only. Never intercept global clicks or expose raw API errors. */
let feedbackVersion = 0;
let feedbackScope = 0;
export const ACTION_FEEDBACK_CLEAR_EVENT = 'onspa-action-feedback-clear';
export const ACTION_FEEDBACK_DURATION = 12000;
export function actionFeedbackScope() { return feedbackScope; }
export function clearActionFeedback() { attemptContext=undefined;feedbackScope++; feedbackVersion++; if(typeof window!=='undefined')window.dispatchEvent(new Event(ACTION_FEEDBACK_CLEAR_EVENT)); }
export function actionFeedbackVersion() { return feedbackVersion; }
export function isCancelledAction(error: unknown) { return error instanceof Error && (error.name === 'AbortError' || error.name === 'ClientSessionReadCancelled'); }
export const ACTION_FEEDBACK_EVENT = 'onspa-action-feedback';
export type ActionFeedbackDetail = {message: string; kind?: 'success'|'error'; onDismiss?:()=>void; trigger?: HTMLElement | null; resolveTrigger?: () => HTMLElement | null};
export function notifyActionFailure(message: string, trigger?: HTMLElement | null, resolveTrigger?: () => HTMLElement | null, transientProgress = false, scope = feedbackScope, audit = true) {
  if (typeof window === 'undefined' || scope !== feedbackScope) return;
  const target = resolveTrigger?.() || trigger;
  if (target && (!target.isConnected || target.closest('[hidden]'))) return;
  // Busy explanations must not suppress a later failure from the pending action.
  if (!transientProgress) {feedbackVersion++;if(audit)recordClientAttempt({outcome:target?.closest('nav[aria-label*="trang"]')?'ui-unavailable':/kết nối|Failed to fetch|NetworkError/i.test(message)?'network-unknown':'ui-blocked',reasonCode:/quyền|permission|權限/i.test(message)?'permission':/hợp lệ|bắt buộc|invalid|required/i.test(message)?'validation':'unavailable',operation:target?.textContent?.trim().slice(0,120)||currentActionContext()?.operation||'Thao tác không thành công',submittedInput:submittedForm(target)||currentActionContext()?.submittedInput,validationMessage:message});}
  window.dispatchEvent(new CustomEvent<ActionFeedbackDetail>(ACTION_FEEDBACK_EVENT, {detail: {message, trigger, resolveTrigger}}));
}
export function actionFeedbackMessage(kind: 'busy' | 'unavailable' | 'failed', locale = 'vi') {
  const messages = {
    vi: {busy: 'Đang xử lý. Vui lòng chờ hoàn tất rồi thử lại.', unavailable: 'Chưa thể thực hiện. Kiểm tra lựa chọn và thông tin bắt buộc rồi thử lại.', failed: 'Không thể hoàn tất thao tác. Vui lòng thử lại.'},
    en: {busy: 'Processing. Wait until it finishes, then try again.', unavailable: 'Action unavailable. Check the selection and required information, then try again.', failed: 'Unable to complete this action. Please try again.'},
    zh: {busy: '正在處理，請稍候再試。', unavailable: '目前無法執行。請檢查選取項目及必填資料後重試。', failed: '無法完成操作，請重試。'},
  };
  return messages[locale === 'en' || locale === 'zh' ? locale : 'vi'][kind];
}

/** Status-only messages: response bodies can contain SQL, stacks or private values. */
export function mutationFailureMessage(status: number) {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 409) return 'Dữ liệu hoặc trạng thái đã thay đổi. Tải lại danh sách và kiểm tra trước khi thử lại.';
  if (status === 400 || status === 422) return 'Dữ liệu chưa hợp lệ. Kiểm tra các trường bắt buộc và điều kiện thao tác.';
  if (status === 413) return 'Tệp quá lớn. Chọn tệp nhỏ hơn rồi thử lại.';
  if (status === 429) return 'Có quá nhiều yêu cầu. Chờ một lúc rồi thử lại.';
  return 'Không thể hoàn tất thao tác. Vui lòng thử lại; nếu vẫn lỗi, báo người quản trị.';
}
export function notifyInvalidAction(event: {target: EventTarget | null}) {
  const trigger = typeof HTMLElement !== 'undefined' && event.target instanceof HTMLElement ? event.target : null;
  notifyActionFailure('Thông tin chưa hợp lệ. Kiểm tra các trường bắt buộc và giá trị được đánh dấu trước khi tiếp tục.', trigger);
}
