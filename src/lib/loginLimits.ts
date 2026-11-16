// Bloqueo temporal por intentos fallidos de contraseña.
export const MAX_FAILED_LOGINS = 5; // al 5.º error seguido se bloquea la cuenta
export const WARN_FROM_FAILED = 3; // desde el 3.er error se avisa cuántos intentos quedan
export const LOCK_MINUTES = 15;

// Códigos que `authorize` lanza para que la pantalla de login muestre el mensaje correcto.
export const LOGIN_LOCKED = "LOCKED";
export const LOGIN_INACTIVE = "INACTIVE";
export const LOGIN_REMAINING_PREFIX = "REMAINING:";
