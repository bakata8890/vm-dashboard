import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/store/uiStore';

describe('uiStore — localStorage persistencia de tema', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ darkMode: false });
  });

  it('inicializa darkMode=true si localStorage tiene "true"', () => {
    localStorage.setItem('darkMode', 'true');
    useUiStore.setState({ darkMode: localStorage.getItem('darkMode') === 'true' });
    expect(useUiStore.getState().darkMode).toBe(true);
  });

  it('toggleDarkMode escribe el nuevo valor en localStorage', () => {
    useUiStore.getState().toggleDarkMode();
    expect(localStorage.getItem('darkMode')).toBe('true');

    useUiStore.getState().toggleDarkMode();
    expect(localStorage.getItem('darkMode')).toBe('false');
  });
});
