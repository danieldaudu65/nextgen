'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption { value: string; label: string; disabled?: boolean }

export default function AnimatedSelect({ value, onChange, options, label, placeholder = 'Choose…', disabled = false }: {
  value: string; onChange: (value: string) => void; options: SelectOption[]; label: string; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (!open || !trigger.current) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const height = Math.min(270, options.length * 44 + 12);
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const openUp = below < Math.min(height + 20, 180) && above > below;
      const width = Math.min(rect.width, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      setMenuStyle({ position: 'fixed', left, width, maxHeight: Math.max(100, Math.min(height, openUp ? above - 16 : below - 16)), ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, options.length]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id, open]);

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); setActive(selectedIndex); return; }
      const direction = e.key === 'ArrowDown' ? 1 : -1;
      let next = active;
      for (let i = 0; i < options.length; i++) {
        next = (next + direction + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      setActive(next);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) { setOpen(true); setActive(selectedIndex); }
      else if (options[active]) choose(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault(); setOpen(false);
    } else if (e.key === 'Home' && open) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && open) { e.preventDefault(); setActive(options.length - 1); }
  };

  const menu = open && typeof document !== 'undefined' ? createPortal(<div ref={menuRef} id={`${id}-listbox`} style={menuStyle} className="animated-select-menu" role="listbox" aria-label={label}>
    {options.map((option, i) => <button id={`${id}-option-${i}`} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} key={`${option.value}-${i}`} className={`animated-select-option${i === active ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => choose(option)}>
      <span>{option.label}</span>{option.value === value && <b aria-hidden="true">✓</b>}
    </button>)}
  </div>, document.body) : null;

  return <div ref={root} className={`animated-select${open ? ' is-open' : ''}`}>
    <button ref={trigger} type="button" className="animated-select-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-listbox`} aria-activedescendant={open ? `${id}-option-${active}` : undefined} disabled={disabled} onClick={() => { setActive(selectedIndex); setOpen((v) => !v); }} onKeyDown={onKeyDown}>
      <span className={selected ? '' : 'select-placeholder'}>{selected?.label ?? placeholder}</span><i aria-hidden="true">⌄</i>
    </button>
    {menu}
  </div>;
}
