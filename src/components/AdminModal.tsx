import { Show, createEffect, onCleanup, type JSX } from "solid-js";
import { Portal } from "solid-js/web";

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  size?: "default" | "wide";
  children: JSX.Element;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4.5 4.5L13.5 13.5"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
      <path
        d="M13.5 4.5L4.5 13.5"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

export default function AdminModal(props: AdminModalProps) {
  createEffect(() => {
    if (!props.open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    });
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div class="pm-admin-modal__overlay" onClick={props.onClose}>
          <section
            class={`pm-admin-modal__dialog${
              props.size === "wide" ? " pm-admin-modal__dialog--wide" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={props.title}
            onClick={event => event.stopPropagation()}
          >
            <header class="pm-admin-modal__header">
              <div>
                <Show when={props.eyebrow}>
                  {value => <p class="pm-admin-modal__eyebrow">{value()}</p>}
                </Show>
                <h2 class="pm-admin-modal__title">{props.title}</h2>
                <Show when={props.subtitle}>
                  {value => <p class="pm-admin-modal__subtitle">{value()}</p>}
                </Show>
              </div>

              <button
                class="pm-admin-modal__close"
                type="button"
                aria-label="Close dialog"
                onClick={props.onClose}
              >
                <CloseIcon />
              </button>
            </header>

            <div class="pm-admin-modal__body">{props.children}</div>
          </section>
        </div>
      </Portal>
    </Show>
  );
}
