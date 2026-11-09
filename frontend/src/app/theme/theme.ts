/** Preferencia de tema del usuario. 'system' = sin elección: manda el sistema (lo resuelve el CSS). */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme-preference';

/** Cualquier valor que no sea 'light' o 'dark' (vacío, inválido, de otra versión) es 'system'. */
export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

/** localStorage puede lanzar (modo privado, política del navegador): en ese caso no hay preferencia. */
export function readStoredPreference(storage: ReadableStorage | null): ThemePreference {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function storePreference(storage: WritableStorage | null, preference: ThemePreference): void {
  try {
    if (preference === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Sin almacenamiento disponible: la elección sigue valiendo en esta sesión, pero no se recuerda.
  }
}

/** Sin atributo = seguir al sistema (el CSS usa :root:not([data-theme]) con prefers-color-scheme). */
export function applyTheme(
  root: Pick<Element, 'setAttribute' | 'removeAttribute'>,
  preference: ThemePreference,
): void {
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}