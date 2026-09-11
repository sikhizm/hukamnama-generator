"use client";

import { useState, type ReactNode, type ComponentType } from "react";
import { ChevronDown } from "lucide-react";

export type IconType = ComponentType<{ size?: number | string; className?: string }>;

/* ---------------------------------------------------------------- */

export function Section(props: {
  icon: IconType;
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { icon: Icon, title, subtitle, children, defaultOpen = true } = props;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-white/[0.05]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-white/[0.025]"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-amber-300/15 bg-amber-400/10 text-amber-300">
          <Icon size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold tracking-wide text-zinc-100">
            {title}
          </span>
          {subtitle && (
            <span className="block truncate text-[10.5px] text-zinc-500">{subtitle}</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="space-y-3 px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}

/* ---------------------------------------------------------------- */

export function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const { label, value, min, max, step = 1, onChange, format, disabled } = props;
  return (
    <label className={`block ${disabled ? "pointer-events-none opacity-35" : ""}`}>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-[10.5px] text-amber-300/90">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        className="u-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

/* ---------------------------------------------------------------- */

export function ToggleRow(props: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { label, desc, checked, onChange } = props;
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-medium text-zinc-300">{label}</span>
        {desc && <span className="block text-[10px] leading-snug text-zinc-500">{desc}</span>}
      </span>
      <span
        className={`relative h-[19px] w-[34px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-amber-400" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-[2.5px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all duration-200 ${
            checked ? "left-[17px]" : "left-[2.5px]"
          }`}
        />
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- */

export function SegRow<T extends string>(props: {
  options: { value: T; label: string; icon?: IconType }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { options, value, onChange } = props;
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] p-[3px]">
      {options.map((o) => {
        const active = o.value === value;
        const I = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
              active
                ? "bg-amber-400 text-zinc-950 shadow"
                : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            }`}
          >
            {I && <I size={12} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function FieldLabel(props: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
      <span>{props.children}</span>
      {props.right}
    </div>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  gurmukhi?: boolean;
  mono?: boolean;
}) {
  const { value, onChange, placeholder, gurmukhi, mono } = props;
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/50 focus:bg-white/[0.06] ${
        gurmukhi ? "font-pa" : mono ? "font-mono" : ""
      }`}
    />
  );
}

export function TextArea(props: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  gurmukhi?: boolean;
}) {
  const { value, onChange, rows = 5, gurmukhi } = props;
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className={`studio-scroll w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-zinc-100 outline-none transition focus:border-amber-300/50 focus:bg-white/[0.06] ${
        gurmukhi ? "font-pa" : ""
      }`}
    />
  );
}
