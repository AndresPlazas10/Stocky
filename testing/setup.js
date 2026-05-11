import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    tr: 'tr',
    section: 'section',
    span: 'span',
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    li: 'li',
    ul: 'ul',
    button: 'button',
    img: 'img',
    a: 'a',
    nav: 'nav',
  },
  AnimatePresence: ({ children }) => children,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const createIcon = (name) => () => name;
  return {
    // Generic fallback
    ...new Proxy({}, { get: (_, name) => createIcon(name) }),
    // Explicitly used in components we test
    AlertCircle: createIcon('AlertCircle'),
    Printer: createIcon('Printer'),
    X: createIcon('X'),
    Save: createIcon('Save'),
    Trash2: createIcon('Trash2'),
    CheckCircle2: createIcon('CheckCircle2'),
    Search: createIcon('Search'),
    ShoppingCart: createIcon('ShoppingCart'),
    Download: createIcon('Download'),
    ShieldCheck: createIcon('ShieldCheck'),
    Smartphone: createIcon('Smartphone'),
    Monitor: createIcon('Monitor'),
  };
});
