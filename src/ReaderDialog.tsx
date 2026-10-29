import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Native modal: focus containment, inert background and Android back dismissal. */
export function ReaderDialog({
  title,
  children,
  onClose,
  full = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  full?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const dialog = ref.current!;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const back = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      close.current();
    };
    // Own the back action before an editor or page-level navigation listener.
    window.addEventListener("zhizhan:back", back, true);
    return () => {
      window.removeEventListener("zhizhan:back", back, true);
      dialog.close();
      document.body.style.overflow = overflow;
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`reader-dialog${full ? " reader-fullscreen" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <header className="reader-dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="关闭阅读面板"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      <div className="reader-dialog-body">{children}</div>
    </dialog>,
    document.body,
  );
}
