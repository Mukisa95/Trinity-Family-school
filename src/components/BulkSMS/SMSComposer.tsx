'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Anchor as PopoverAnchor } from '@radix-ui/react-popover';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FEES_SMS_NAME_FORMATS, FEES_SMS_TEXT_CASES } from '@/lib/utils/fees-sms';
import { readSMSDocument, writeSMSDocument, smsFieldLabel, smsDocumentText, type SMSField, type SMSFieldFormat, type SMSPart } from '@/lib/utils/sms-document';

export interface SMSComposerHandle {
  insertField: (field: SMSField) => void;
  insertText: (text: string) => void;
  markBalanceSelection: () => void;
}
interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
  placeholder?: string;
}
const newId = () => `sms-${crypto.randomUUID()}`;
const selectClass = 'min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm';

function build(parts: SMSPart[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const part of parts) {
    if (part.type === 'text') { fragment.append(document.createTextNode(part.text)); continue; }
    const button = document.createElement('button');
    button.type = 'button';
    button.contentEditable = 'false';
    button.setAttribute('aria-haspopup', 'dialog');
    button.dataset.smsControl = 'true';
    button.className = 'mx-0.5 inline-flex max-w-full cursor-pointer items-center rounded-md border border-brand-300 bg-brand-surface-100 px-1.5 py-0.5 align-baseline text-xs font-medium text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-ring dark:border-brand-700 dark:bg-brand-surface-900 dark:text-brand-ink-100';
    if (part.type === 'field') {
      button.dataset.smsField = part.field;
      button.dataset.smsId = part.id;
      button.dataset.smsFormat = JSON.stringify(part.format);
      const variant = part.format.name && part.format.name !== 'all' ? part.format.name === 'both' ? 'Surname + first' : part.format.name === 'surname' ? 'Surname' : 'First name'
        : part.field === 'class' && part.format.class === 'code' ? 'Code'
          : part.field === 'term' && part.format.term && part.format.term !== 'original' ? ({ words: 'Term One', number: 'Term 1', short: 'T 1' }[part.format.term]) : '';
      button.textContent = `${smsFieldLabel(part.field)}${variant ? ` · ${variant}` : ''} ▾`;
      button.setAttribute('aria-label', `Format ${smsFieldLabel(part.field)}`);
      fragment.append(button);
    } else {
      const section = document.createElement('span');
      section.dataset.smsBalance = part.id;
      section.className = 'rounded-md border border-dashed border-amber-500 bg-amber-50/60 px-0.5 dark:bg-amber-950/30';
      button.textContent = 'Only with a balance ▾';
      button.dataset.smsConditionControl = 'true';
      button.setAttribute('aria-label', 'Edit balance condition');
      button.className += ' !border-amber-300 !bg-amber-100 !text-amber-950 dark:!border-amber-700 dark:!bg-amber-900 dark:!text-amber-100';
      section.append(button, build(part.children));
      fragment.append(section);
    }
  }
  return fragment;
}
function readNodes(parent: Node): SMSPart[] {
  const parts: SMSPart[] = [];
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) { parts.push({ type: 'text', text: node.textContent || '' }); continue; }
    if (!(node instanceof HTMLElement)) continue;
    if (node.dataset.smsField) {
      parts.push({ type: 'field', id: node.dataset.smsId!, field: node.dataset.smsField as SMSField, format: JSON.parse(node.dataset.smsFormat || '{}') as SMSFieldFormat });
    } else if (node.dataset.smsBalance) parts.push({ type: 'balance', id: node.dataset.smsBalance, children: readNodes(node) });
    else if (node.dataset.smsControl) continue;
    else if (node.tagName === 'BR') parts.push({ type: 'text', text: '\n' });
    else {
      if (['DIV', 'P'].includes(node.tagName) && parts.length) parts.push({ type: 'text', text: '\n' });
      parts.push(...readNodes(node));
    }
  }
  return parts;
}

/** DOM-owned editing keeps the caret stable; storage and sending use a validated document. */
export const SMSComposer = forwardRef<SMSComposerHandle, Props>(function SMSComposer({ value, onChange, placeholder = 'Type your message…', ...props }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const lastValue = useRef<string>();
  const savedRange = useRef<Range | null>(null);
  const activeElement = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState<{ id: string; field?: SMSField; format: SMSFieldFormat } | null>(null);
  const [notice, setNotice] = useState('');
  const [empty, setEmpty] = useState(!value);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const render = useCallback((next: string) => {
    root.current?.replaceChildren(build(readSMSDocument(next).parts));
    lastValue.current = next;
    savedRange.current = null;
    setEmpty(!smsDocumentText(next));
  }, []);
  const remember = useCallback((next: string) => {
    if (history.current[historyIndex.current] === next) return;
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(next);
    if (history.current.length > 100) history.current.shift();
    historyIndex.current = history.current.length - 1;
  }, []);
  useEffect(() => {
    if (value === lastValue.current) return;
    render(value);
    remember(value);
    setActive(null);
  }, [value, render, remember]);
  function capture() {
    const selection = window.getSelection();
    if (selection?.rangeCount && root.current?.contains(selection.anchorNode) && root.current.contains(selection.focusNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  }
  function commit(captureSelection = true) {
    if (!root.current) return;
    // Deleting a condition badge removes the rule too; never leave an invisible exclusion.
    for (const section of Array.from(root.current.querySelectorAll<HTMLElement>('[data-sms-balance]')).reverse()) {
      if (!Array.from(section.children).some(child => (child as HTMLElement).dataset.smsConditionControl)) section.replaceWith(...Array.from(section.childNodes));
      else if (!readNodes(section).length) section.remove();
    }
    const next = writeSMSDocument(readNodes(root.current));
    lastValue.current = next;
    setEmpty(!smsDocumentText(next));
    remember(next);
    onChange(next);
    if (captureSelection) capture();
  }
  function restore(): Range | null {
    if (!root.current) return null;
    root.current.focus();
    let range = savedRange.current;
    if (!range || !root.current.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(root.current);
      range.collapse(false);
    }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return range;
  }
  function insert(parts: SMSPart[]) {
    const range = restore();
    if (!range) return;
    range.deleteContents();
    const fragment = build(parts);
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) { range.setStartAfter(last); range.collapse(true); }
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    commit();
  }
  function markBalanceSelection() {
    const range = restore();
    if (!range || range.collapsed) { setNotice('Highlight the words or lines to exclude first, then choose this option.'); return; }
    const conditions = root.current!.querySelectorAll('[data-sms-balance]');
    if (Array.from(conditions).some(element => range.intersectsNode(element))) {
      setNotice('This selection already includes conditional text. Remove that condition before selecting a different section.'); return;
    }
    // Expand partial chip selections to keep automatic fields indivisible.
    const chips = root.current!.querySelectorAll('[data-sms-field]');
    for (const chip of Array.from(chips)) {
      if (!range.intersectsNode(chip)) continue;
      if (chip.contains(range.startContainer)) range.setStartBefore(chip);
      if (chip.contains(range.endContainer)) range.setEndAfter(chip);
    }
    const selected = range.extractContents();
    const children = readNodes(selected);
    const section = build([{ type: 'balance', id: newId(), children }]);
    const last = section.lastChild!;
    range.insertNode(section);
    range.setStartAfter(last); range.collapse(true);
    savedRange.current = range;
    setNotice('Selected text will be left out for pupils whose balance is zero or in credit.');
    commit();
    root.current?.scrollIntoView({ block: 'nearest' });
  }
  useImperativeHandle(ref, () => ({
    insertField: field => insert([{ type: 'field', id: newId(), field, format: {} }]),
    insertText: text => insert(readSMSDocument(text).parts),
    markBalanceSelection,
  }));
  function updateFormat(format: SMSFieldFormat) {
    if (!active?.field || !activeElement.current) return;
    const element = activeElement.current;
    const replacement = build([{ type: 'field', id: active.id, field: active.field, format }]).firstChild as HTMLElement;
    element.replaceWith(replacement);
    activeElement.current = replacement;
    setActive({ ...active, format });
    commit(false);
    const range = document.createRange();
    range.setStartAfter(replacement); range.collapse(true);
    savedRange.current = range;
  }
  function remove(keepText = false) {
    const element = activeElement.current;
    if (!element) return;
    if (keepText && element.dataset.smsBalance) {
      element.querySelector('[data-sms-control]')?.remove();
      element.replaceWith(...Array.from(element.childNodes));
    } else element.remove();
    setActive(null);
    commit();
  }
  const format = active?.format || {};
  const choice = (label: string, key: keyof SMSFieldFormat, choices: readonly (readonly [string, string])[], fallback: string) => (
    <label className="block space-y-1 text-sm">{label}<select aria-label={label} className={selectClass} value={String(format[key] ?? fallback)} onChange={event => updateFormat({ ...format, [key]: event.target.value })}>
      {choices.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
    </select></label>
  );
  return (
    <div className="relative min-w-0">
      {empty && <span aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">{placeholder}</span>}
      <div {...props} ref={root} role="textbox" aria-multiline="true" contentEditable suppressContentEditableWarning
        className="min-h-[144px] max-h-[360px] w-full overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm leading-8 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onInput={() => commit()} onKeyUp={capture} onMouseUp={capture} onTouchEnd={capture}
        onBlur={event => { if (!active) capture(); props.onBlur?.(event); }}
        onClick={event => {
          const button = (event.target as HTMLElement).closest<HTMLElement>('[data-sms-control]');
          if (!button) return;
          const element = button.dataset.smsField ? button : button.parentElement!;
          activeElement.current = element;
          const range = document.createRange();
          range.setStartAfter(element); range.collapse(true);
          savedRange.current = range;
          setActive({ id: element.dataset.smsId || element.dataset.smsBalance!, field: element.dataset.smsField as SMSField | undefined, format: JSON.parse(element.dataset.smsFormat || '{}') as SMSFieldFormat });
        }}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
            event.preventDefault();
            const next = historyIndex.current + (event.key.toLowerCase() === 'y' || event.shiftKey ? 1 : -1);
            if (next >= 0 && next < history.current.length) { historyIndex.current = next; const previous = history.current[next]; render(previous); onChange(previous); restore(); }
          } else if (event.key === 'Enter' && !(event.target as HTMLElement).dataset.smsControl) { event.preventDefault(); capture(); insert([{ type: 'text', text: '\n' }]); }
        }}
        onPaste={event => {
          event.preventDefault(); capture();
          // Never insert clipboard HTML or executable markup into the composer.
          const parts = readSMSDocument(event.clipboardData.getData('application/x-trinity-sms') || event.clipboardData.getData('text/plain')).parts;
          const rekey = (items: SMSPart[]): SMSPart[] => items.map(part => part.type === 'text' ? part : part.type === 'field' ? { ...part, id: newId() } : { ...part, id: newId(), children: rekey(part.children) });
          insert(rekey(parts));
        }}
        onCopy={event => {
          const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
          if (!range || range.collapsed) return;
          event.preventDefault();
          const fragment = writeSMSDocument(readNodes(range.cloneContents()));
          event.clipboardData.setData('text/plain', smsDocumentText(fragment));
          event.clipboardData.setData('application/x-trinity-sms', fragment);
        }}
        onCut={event => {
          const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
          if (!range || range.collapsed) return;
          event.preventDefault();
          const fragment = writeSMSDocument(readNodes(range.cloneContents()));
          event.clipboardData.setData('text/plain', smsDocumentText(fragment));
          event.clipboardData.setData('application/x-trinity-sms', fragment);
          range.deleteContents();
          commit();
        }}
        onDrop={event => event.preventDefault()}
      />
      {notice && <p role="status" className="mt-1 text-xs text-muted-foreground">{notice}</p>}
      <Popover open={Boolean(active)} onOpenChange={open => { if (!open) setActive(null); }}>
        <PopoverAnchor virtualRef={activeElement} />
        <PopoverContent align="start" className="max-h-[65dvh] w-72 space-y-3 overflow-y-auto" aria-label={active?.field ? `Format ${smsFieldLabel(active.field)}` : 'Balance condition'} onCloseAutoFocus={event => { event.preventDefault(); restore(); }}>
          <p className="text-sm font-semibold">{active?.field ? smsFieldLabel(active.field) : 'Only with a balance'}</p>
          {active?.field ? <>
            {['pupil_name', 'guardian_name'].includes(active.field) && choice('Name format', 'name', FEES_SMS_NAME_FORMATS, 'all')}
            {active.field === 'class' && choice('Class format', 'class', [['name', 'Class name'], ['code', 'Class code'], ['both', 'Name and code']], 'name')}
            {active.field === 'term' && choice('Term format', 'term', [['original', 'As recorded'], ['words', 'Term One'], ['number', 'Term 1'], ['short', 'T 1']], 'original')}
            {active.field === 'year' && choice('Year format', 'year', [['original', 'As recorded'], ['numbers', 'Year numbers only']], 'original')}
            {['balance', 'amount_paid', 'total_fees'].includes(active.field) && choice('Amount format', 'amount', [['currency', 'Shs. 10,000'], ['number', '10,000'], ['plain', '10000']], 'currency')}
            {choice('Text case', 'textCase', FEES_SMS_TEXT_CASES, 'unchanged')}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(format.label)} onChange={event => updateFormat({ ...format, label: event.target.checked })} />Include field label</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(format.omitIfMissing)} onChange={event => updateFormat({ ...format, omitIfMissing: event.target.checked })} />Leave blank if unavailable</label>
          </> : <>
            <p className="text-xs text-muted-foreground">Send this section only when the pupil owes more than zero for the selected fees and period. The rest of the message still sends.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => remove(true)}>Remove condition, keep text</Button>
          </>}
          <div className="flex justify-between gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => remove()}>Remove {active?.field ? 'field' : 'section'}</Button><Button type="button" size="sm" onClick={() => setActive(null)}>Done</Button></div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
