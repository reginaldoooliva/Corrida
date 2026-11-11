"use client";

import { useRef } from "react";

import { SubmitButton } from "./submit-button";

// A destructive action asked twice (DEL-01/07): the trigger opens a modal <dialog> with the exact
// confirmation text; "Cancelar" closes it and changes nothing (DEL-03), "Excluir" submits `action`
// with `fields` as hidden inputs.
export function ConfirmDialog({
  label,
  message,
  confirmLabel = "Excluir",
  action,
  fields,
}: {
  label: string;
  message: string;
  confirmLabel?: string;
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn-danger btn-block" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog ref={dialog} className="dialog" aria-label={label}>
        <p>{message}</p>
        <form action={action} className="row between">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>
            Cancelar
          </button>
          <SubmitButton pendingText="Excluindo..." className="btn-danger">
            {confirmLabel}
          </SubmitButton>
        </form>
      </dialog>
    </>
  );
}
