// Evento de ventana para abrir el cuadro "Cambiar contraseña" desde el menú de usuario.
export const OPEN_CHANGE_PASSWORD_EVENT = "crm:open-change-password";
export const PW_NOTICE_DISMISSED_KEY = "crm:pw-notice-dismissed";

export function openChangePassword() {
  window.dispatchEvent(new CustomEvent(OPEN_CHANGE_PASSWORD_EVENT));
}
