import { describe, expect, it } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  parseThemePreference,
  readStoredPreference,
  storePreference,
} from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {
    throw new Error('denied');
  },
};

function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
    removeAttribute: (name: string) => void attrs.delete(name),
  };
}

describe('parseThemePreference', () => {
  it('acepta light y dark', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it.each(['system', '', 'DARK', 'blue', null, undefined, 42])('trata %j como system', (value) => {
    expect(parseThemePreference(value)).toBe('system');
  });
});

describe('readStoredPreference', () => {
  it('lee la preferencia guardada', () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });

  it('sin nada guardado es system', () => {
    expect(readStoredPreference(fakeStorage())).toBe('system');
  });

  it('ignora un valor guardado inválido', () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'violeta' }))).toBe('system');
  });

  it('si localStorage lanza, es system y no rompe', () => {
    expect(readStoredPreference(brokenStorage)).toBe('system');
  });

  it('sin storage disponible, es system', () => {
    expect(readStoredPreference(null)).toBe('system');
  });
});

describe('storePreference', () => {
  it('guarda light y dark', () => {
    const storage = fakeStorage();
    storePreference(storage, 'dark');
    expect(storage.data[THEME_STORAGE_KEY]).toBe('dark');
    storePreference(storage, 'light');
    expect(storage.data[THEME_STORAGE_KEY]).toBe('light');
  });

  it('system borra la clave (así el script inicial no aplica nada)', () => {
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'dark' });
    storePreference(storage, 'system');
    expect(THEME_STORAGE_KEY in storage.data).toBe(false);
  });

  it('si localStorage lanza, no rompe', () => {
    expect(() => storePreference(brokenStorage, 'dark')).not.toThrow();
  });

  it('sin storage disponible, no rompe', () => {
    expect(() => storePreference(null, 'dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('dark y light ponen data-theme', () => {
    const root = fakeRoot();
    applyTheme(root, 'dark');
    expect(root.attrs.get('data-theme')).toBe('dark');
    applyTheme(root, 'light');
    expect(root.attrs.get('data-theme')).toBe('light');
  });

  it('system quita el atributo', () => {
    const root = fakeRoot();
    applyTheme(root, 'dark');
    applyTheme(root, 'system');
    expect(root.attrs.has('data-theme')).toBe(false);
  });
});