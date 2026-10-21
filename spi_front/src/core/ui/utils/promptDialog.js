export const promptDialog = ({
  title = "Ingresa un valor",
  message = "",
  placeholder = "",
  defaultValue = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  required = false,
} = {}) =>
  new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "50";
    overlay.style.background = "rgba(15,23,42,0.6)";
    overlay.style.backdropFilter = "blur(4px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";

    const modal = document.createElement("div");
    modal.style.width = "100%";
    modal.style.maxWidth = "560px";
    modal.style.background = "#FFFFFF";
    modal.style.border = "1px solid #E5E7EB";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 20px 60px rgba(15,23,42,0.18)";
    modal.style.padding = "20px";

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.margin = "0 0 8px 0";
    heading.style.fontSize = "18px";
    heading.style.fontWeight = "600";
    heading.style.color = "#1F2937";

    const text = document.createElement("p");
    text.textContent = message;
    text.style.margin = "0 0 12px 0";
    text.style.fontSize = "14px";
    text.style.color = "#6B7280";

    const input = document.createElement("input");
    input.type = "text";
    input.value = String(defaultValue || "");
    input.placeholder = placeholder;
    input.style.width = "100%";
    input.style.minHeight = "44px";
    input.style.border = "1px solid #D1D5DB";
    input.style.borderRadius = "12px";
    input.style.padding = "10px 12px";
    input.style.fontSize = "14px";
    input.style.outline = "none";
    input.style.boxSizing = "border-box";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "14px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = cancelText;
    cancelBtn.style.minHeight = "44px";
    cancelBtn.style.borderRadius = "16px";
    cancelBtn.style.border = "1px solid #D1D5DB";
    cancelBtn.style.background = "#FFFFFF";
    cancelBtn.style.padding = "8px 16px";
    cancelBtn.style.cursor = "pointer";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = confirmText;
    confirmBtn.style.minHeight = "44px";
    confirmBtn.style.borderRadius = "16px";
    confirmBtn.style.border = "0";
    confirmBtn.style.background = "#2563EB";
    confirmBtn.style.color = "#FFFFFF";
    confirmBtn.style.padding = "8px 16px";
    confirmBtn.style.cursor = "pointer";

    const cleanup = (value) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(value);
    };

    const submit = () => {
      const value = String(input.value || "");
      if (required && !value.trim()) {
        input.style.border = "1px solid #DC2626";
        input.focus();
        return;
      }
      cleanup(value);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") cleanup(null);
      if (event.key === "Enter") submit();
    };

    cancelBtn.onclick = () => cleanup(null);
    confirmBtn.onclick = submit;
    overlay.onclick = (event) => {
      if (event.target === overlay) cleanup(null);
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(heading);
    if (message) modal.appendChild(text);
    modal.appendChild(input);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKeyDown);
    input.focus();
    input.select();
  });
