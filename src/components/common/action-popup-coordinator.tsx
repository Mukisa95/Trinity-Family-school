"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export const ActionBarPopupContext = createContext(false);
export const ActionPopupRootContext = createContext<{ replaced: { current: boolean } } | null>(null);
const openPopups = new Map<string, { owner: HTMLElement | null; close: () => void }>();
let currentAction: HTMLElement | null = null;

function beginAction(control: HTMLElement) {
  currentAction = control;
  for (const [id, popup] of Array.from(openPopups)) {
    // Leave the current trigger to Radix so a second tap still toggles it closed.
    if (popup.owner === control) continue;
    openPopups.delete(id);
    popup.close();
  }
}

/** Native capture also covers controls React portals mount into a dock slot. */
export function observeActionBarPopups(root: HTMLElement) {
  let touch: { x: number; y: number; cancelled: boolean } | null = null;
  const controlAt = (target: EventTarget | null) => {
    const control = target instanceof Element ? target.closest<HTMLElement>('button, a[href], select, input, [role="button"]') : null;
    return control && root.contains(control) && !control.matches(':disabled, [aria-disabled="true"]') ? control : null;
  };
  const down = (event: PointerEvent) => {
    touch = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY, cancelled: !event.isPrimary } : null;
    const control = controlAt(event.target);
    if (!control || event.defaultPrevented || event.button !== 0 || !event.isPrimary || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    currentAction = control;
    if (event.pointerType !== 'touch') beginAction(control);
  };
  const move = (event: PointerEvent) => { if (touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) touch.cancelled = true; };
  const cancel = () => { if (touch) touch.cancelled = true; };
  const click = (event: MouseEvent) => {
    const cancelled = touch?.cancelled; touch = null;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (cancelled && event.detail !== 0)) return;
    const control = controlAt(event.target); if (control) beginAction(control);
  };
  const key = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !['Enter', ' '].includes(event.key)) return;
    const control = controlAt(event.target); if (control) beginAction(control);
  };
  root.addEventListener('pointerdown', down, true);
  root.addEventListener('pointermove', move, { capture: true, passive: true });
  root.addEventListener('pointercancel', cancel, true);
  root.addEventListener('click', click, true);
  root.addEventListener('keydown', key, true);
  return () => {
    root.removeEventListener('pointerdown', down, true); root.removeEventListener('pointermove', move, true);
    root.removeEventListener('pointercancel', cancel, true); root.removeEventListener('click', click, true); root.removeEventListener('keydown', key, true);
    if (currentAction && root.contains(currentAction)) currentAction = null;
  };
}

/** Controlled and uncontrolled popup roots share the same action-switch contract. */
export function useActionPopupState(controlledOpen?: boolean, defaultOpen = false, onOpenChange?: (open: boolean) => void) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const inActionBar = useContext(ActionBarPopupContext);
  const id = useId();
  const replaced = useRef(false);
  const context = useMemo(() => ({ replaced }), []);
  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);
  const close = useRef(setOpen); close.current = setOpen;
  useBrowserLayoutEffect(() => {
    if (!open) return;
    replaced.current = false;
    openPopups.set(id, { owner: inActionBar ? currentAction : null, close: () => { replaced.current = true; close.current(false); } });
    return () => { openPopups.delete(id); };
  }, [open, id, inActionBar]);
  return { open, setOpen, context, inActionBar };
}

/** A replaced popup must not move focus back over the newly opened one. */
export function useActionPopupCloseAutoFocus<E extends Event>(handler?: (event: E) => void) {
  const context = useContext(ActionPopupRootContext);
  return (event: E) => {
    handler?.(event);
    if (context?.replaced.current) { event.preventDefault(); context.replaced.current = false; }
  };
}

type PopupProps = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void };
export function withActionPopup<Props extends PopupProps>(Root: ComponentType<Props>, trackOutsideBar = false) {
  function TrackedPopup(props: Props) {
    const state = useActionPopupState(props.open, props.defaultOpen, props.onOpenChange);
    return <ActionPopupRootContext.Provider value={state.context}><Root {...props} open={state.open} onOpenChange={state.setOpen} /></ActionPopupRootContext.Provider>;
  }
  return function ActionPopup(props: Props) {
    const inBar = useContext(ActionBarPopupContext);
    // Dense timetable grids keep their original popup roots and pay no extra
    // state/registration cost; coordination is for action bars and dialogs.
    return inBar || trackOutsideBar ? <TrackedPopup {...props} /> : <Root {...props} />;
  };
}
