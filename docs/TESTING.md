# Testing

## Unit Tests (Vitest)

```bash
npm run test:unit     # Run all unit tests once
npm run test:watch    # Watch mode (auto-rerun on changes)
npm run test:coverage # Generate coverage report
```

**Coverage**: 98 tests across 14 files
- `testing/cambio.test.js` — Change calculation (20 tests)
- `testing/formatters.test.js` — Price formatting (10 tests)
- `testing/receiptTemplate.test.js` — Receipt template (10 tests)
- `testing/printTemplates.test.js` — Print templates (2 tests)
- `testing/useDebounce.test.js` — Debounce hook (5 tests)
- `testing/useCloseOrderLocks.test.js` — Lock hook (8 tests)
- `testing/usePermissions.test.js` — Permissions hook (6 tests)
- `testing/MesaDeleteModal.test.jsx` — Delete modal (5 tests)
- `testing/PrintReceiptConfirmModal.test.jsx` — Print modal (8 tests)
- `testing/MesaOrderFooter.test.jsx` — Order footer (6 tests)
- `testing/offline-sale-flow.test.js` — Offline sales (4 tests)
- `testing/offline-snapshots.test.js` — Offline snapshots (4 tests)
- `testing/offline-network.test.js` — Network detection (4 tests)
- `testing/offline-recovery.test.js` — Recovery (5 tests)

## Legacy Tests (Node.js)

```bash
npm test              # Run all legacy tests
npm run test:offline  # Run offline-specific tests
```

14 test files in `testing/` using Node.js native test runner.

## E2E Tests (Playwright)

```bash
npm run test:e2e      # Run E2E tests (headless)
npm run test:e2e:ui   # Run E2E tests (UI mode)
```

Requires: `npx playwright install chromium`

- `testing/e2e/app-health.spec.js` — App loading, PWA meta, console errors
- `testing/e2e/public-pages.spec.js` — Download page, terms, legal pages
