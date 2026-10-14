/**
 * Abrir la pantalla de mesa en otro monitor del mismo ordenador.
 * Chrome y Edge permiten ver los monitores y colocar una ventana en uno concreto (Window Management API,
 * pide permiso la primera vez). En otros navegadores se abre una ventana normal que se arrastra a mano.
 */

interface ScreenDetailed {
  label?: string;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
}

interface ScreenDetails {
  screens: ScreenDetailed[];
  currentScreen: ScreenDetailed;
}

export interface ScreenInfo {
  index: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  isPrimary: boolean;
  isCurrent: boolean;
}

type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> };

export function canPickScreens(): boolean {
  return typeof (window as WindowWithScreens).getScreenDetails === "function";
}

export async function listScreens(): Promise<ScreenInfo[]> {
  const details = await (window as WindowWithScreens).getScreenDetails!();
  return details.screens.map((s, i) => ({
    index: i,
    label: s.label?.trim() || `Pantalla ${i + 1}`,
    left: s.availLeft,
    top: s.availTop,
    width: s.availWidth,
    height: s.availHeight,
    isPrimary: !!s.isPrimary,
    isCurrent: s === details.currentScreen,
  }));
}

/** Abre (o reutiliza) la ventana de la TV. Debe llamarse directamente desde el clic para que no la bloqueen. */
export function openTvWindow(screen?: ScreenInfo): Window | null {
  const features = screen
    ? `popup,left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`
    : "popup,width=1280,height=720";
  const win = window.open("", "eclipse-tv", features);
  if (win && screen) {
    // si la ventana ya existía, la recolocamos en la pantalla elegida
    try {
      win.moveTo(screen.left, screen.top);
      win.resizeTo(screen.width, screen.height);
    } catch {
      // algunos navegadores no permiten mover ventanas: se queda donde esté
    }
  }
  return win;
}
