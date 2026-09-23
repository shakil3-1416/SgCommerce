export interface ConfirmActionOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirmAction(
  options: ConfirmActionOptions,
): Promise<boolean> {
  if (
    typeof document ===
    'undefined'
  ) {
    return Promise.resolve(
      false,
    );
  }

  return new Promise(
    (resolve) => {
      const dialog =
        document.createElement(
          'dialog',
        );

      const titleId =
        `confirm-title-${Date.now()}`;

      const descriptionId =
        `confirm-description-${Date.now()}`;

      dialog.setAttribute(
        'aria-labelledby',
        titleId,
      );

      dialog.setAttribute(
        'aria-describedby',
        descriptionId,
      );

      dialog.className =
        'm-auto w-[min(92vw,440px)] rounded-3xl border border-[#e8e2ef] bg-white p-0 shadow-2xl backdrop:bg-[#1f1235]/45';

      const panel =
        document.createElement(
          'div',
        );

      panel.className =
        'p-6';

      const eyebrow =
        document.createElement(
          'p',
        );

      eyebrow.className =
        'text-xs font-bold uppercase tracking-[0.18em] text-[#6f6679]';

      eyebrow.textContent =
        options.destructive
          ? 'Confirm deletion'
          : 'Confirm action';

      const title =
        document.createElement(
          'h2',
        );

      title.id =
        titleId;

      title.className =
        'mt-2 text-xl font-bold text-[#1f1235]';

      title.textContent =
        options.title;

      const description =
        document.createElement(
          'p',
        );

      description.id =
        descriptionId;

      description.className =
        'mt-3 text-sm leading-6 text-[#6f6679]';

      description.textContent =
        options.description;

      const actions =
        document.createElement(
          'div',
        );

      actions.className =
        'mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end';

      const cancel =
        document.createElement(
          'button',
        );

      cancel.type =
        'button';

      cancel.className =
        'min-h-11 rounded-xl border border-[#e8e2ef] px-5 py-2.5 text-sm font-bold text-[#38205f]';

      cancel.textContent =
        options.cancelLabel ??
        'Cancel';

      const confirm =
        document.createElement(
          'button',
        );

      confirm.type =
        'button';

      confirm.className =
        options.destructive
          ? 'min-h-11 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700'
          : 'min-h-11 rounded-xl bg-[#1f1235] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#38205f]';

      confirm.textContent =
        options.confirmLabel ??
        'Confirm';

      actions.append(
        cancel,
        confirm,
      );

      panel.append(
        eyebrow,
        title,
        description,
        actions,
      );

      dialog.append(
        panel,
      );

      document.body.append(
        dialog,
      );

      let completed =
        false;

      const finish = (
        result: boolean,
      ) => {
        if (completed) {
          return;
        }

        completed = true;

        dialog.close();
        dialog.remove();

        resolve(
          result,
        );
      };

      cancel.addEventListener(
        'click',
        () =>
          finish(false),
      );

      confirm.addEventListener(
        'click',
        () =>
          finish(true),
      );

      dialog.addEventListener(
        'cancel',
        (
          event,
        ) => {
          event.preventDefault();

          finish(false);
        },
      );

      dialog.addEventListener(
        'click',
        (
          event,
        ) => {
          if (
            event.target ===
            dialog
          ) {
            finish(false);
          }
        },
      );

      dialog.showModal();

      cancel.focus();
    },
  );
}
