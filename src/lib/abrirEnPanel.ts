/**
 * Un clic normal en el nombre o en "Editar" abre el lead en el panel lateral. Con Ctrl, Cmd, Shift o clic medio
 * se respeta el comportamiento del enlace (abrirlo en otra pestaña con la ficha completa).
 */
export function clicSimple(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
