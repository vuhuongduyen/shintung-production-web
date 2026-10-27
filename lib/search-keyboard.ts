import type {KeyboardEvent} from 'react';

export function isSearchPickerInput(input: HTMLInputElement): boolean {
  return !!input.list || input.getAttribute('aria-expanded') === 'true' ||
    !!input.getAttribute('aria-activedescendant');
}

/** Only mounted search inputs opt in. Never intercept a page, editor, or picker. */
export function isSearchEnter(event: KeyboardEvent<HTMLInputElement>): boolean {
  const input = event.currentTarget;
  return event.key === 'Enter' && !event.defaultPrevented && !event.repeat &&
    !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
    !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 &&
    input.tagName === 'INPUT' && !input.disabled && !input.readOnly &&
    ['text', 'search', 'email', 'tel', 'url', 'number', 'date', 'month', 'week', 'time', 'datetime-local'].includes(input.type) &&
    !input.isContentEditable && !isSearchPickerInput(input);
}

/** Prevent implicit editor submission even when a held Enter is ignored. */
export function dispatchSearchEnter(event: KeyboardEvent<HTMLInputElement>, activate: () => void): void {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || isSearchPickerInput(event.currentTarget)) return;
  const accepted = isSearchEnter(event);
  event.preventDefault();
  if (accepted) activate();
}

/** A blocked attempt activates only its explanation, never the disabled action. */
export function activateSearchButton(button: HTMLButtonElement | null): void {
  if (!button) return;
  if (button.disabled) {
    const explanation = button.parentElement;
    if (explanation?.matches('[data-feedback-button="true"]')) explanation.click();
    return;
  }
  button.click();
}

// Native popup visibility is not exposed consistently on older browsers. Keep a
// conservative fallback: the Enter which closes a picker only selects its option.
const selectPicker = new WeakMap<HTMLSelectElement, boolean>();
export function markSearchSelectOpen(select: HTMLSelectElement): void { selectPicker.set(select, true); }
export function markSearchSelectClosed(select: HTMLSelectElement): void { selectPicker.delete(select); }
function isSelectPickerOpen(select: HTMLSelectElement): boolean {
  try { return select.matches(':open'); }
  catch { return selectPicker.get(select) === true; }
}
export function dispatchSearchSelectEnter(event: KeyboardEvent<HTMLSelectElement>, activate: () => void): void {
  const select = event.currentTarget;
  if (event.key === 'Escape') { markSearchSelectClosed(select); return; }
  if (event.key === ' ' || event.key === 'F4' || (event.altKey && event.key === 'ArrowDown')) {
    markSearchSelectOpen(select); return;
  }
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.defaultPrevented) return;
  if (isSelectPickerOpen(select)) { markSearchSelectClosed(select); return; }
  // A closed dropdown is a completed criterion. Reuse the button, never a save.
  event.preventDefault();
  if (!event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !select.disabled) activate();
}
