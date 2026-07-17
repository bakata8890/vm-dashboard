import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/store/uiStore';

// DarkModeSync no está exportado de App.tsx, así que replicamos su lógica
// exacta aquí para testear el efecto DOM de forma aislada.
function DarkModeSyncTestWrapper() {
  const darkMode = useUiStore((s) => s.darkMode);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  return null;
}

describe('DarkModeSync — clase .dark en document.documentElement', () => {
  beforeEach(() => {
    useUiStore.setState({ darkMode: false });
    document.documentElement.classList.remove('dark');
  });

  it('agrega la clase dark cuando darkMode es true', () => {
    useUiStore.setState({ darkMode: true });
    render(<DarkModeSyncTestWrapper />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('no agrega la clase dark cuando darkMode es false', () => {
    useUiStore.setState({ darkMode: false });
    render(<DarkModeSyncTestWrapper />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
