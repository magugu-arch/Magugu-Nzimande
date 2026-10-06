"use client";

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const errorText = "text-[0.9rem] text-[#8a2c1f]";

type Common = { label: string; name: string; error?: string; hint?: string };

/** A labelled text input with its error wired to aria-describedby. */
export function Field({ label, name, error, hint, required, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="meta">
        {label}
        {!required && <span className="ml-2 normal-case tracking-normal opacity-70">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-[0.9rem] opacity-75">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className="min-h-12 border-0 border-b border-current/40 bg-transparent px-0 text-[1.05rem] transition-colors placeholder:opacity-50 focus:border-current aria-[invalid=true]:border-[#8a2c1f]"
        {...props}
      />
      {error && (
        <p id={`${id}-err`} className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({ label, name, error, hint, required, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="meta">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-[0.9rem] opacity-75">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        name={name}
        required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className="min-h-40 border border-current/30 bg-transparent p-4 text-[1.05rem] transition-colors focus:border-current aria-[invalid=true]:border-[#8a2c1f]"
        {...props}
      />
      {error && (
        <p id={`${id}-err`} className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
