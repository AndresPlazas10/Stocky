# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** StockyPOS
**Generated:** 2026-06-09 19:54:09
**Category:** Restaurant/Food Service

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#003B46` | `--color-primary` |
| Secondary | `#07575B` | `--color-secondary` |
| Accent | `#66A5AD` | `--color-accent` |
| Background | `#E8F4F6` | `--color-background` |
| Text | `#022225` | `--color-text` |
| Success | `#22C55E` | `--color-success` |
| Error | `#EF4444` | `--color-error` |

**Color Notes:** Dark teal palette with muted accent tones

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** minimal, clean, swiss, functional, neutral, professional
- **Google Fonts:** [Inter + Inter](https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgba(7,87,91,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px -1px rgba(7,87,91,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px -3px rgba(7,87,91,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px -5px rgba(7,87,91,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #003B46;
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #07575B;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 59, 70, 0.3);
}

/* Secondary Button */
.btn-secondary {
  background: #07575B;
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #003B46;
  transform: translateY(-1px);
}
```

### Cards

```css
.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(102, 165, 173, 0.32);
  box-shadow: 0 4px 6px -1px rgba(7, 87, 91, 0.1);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: 0 10px 15px -3px rgba(7, 87, 91, 0.1);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid rgba(102, 165, 173, 0.32);
  border-radius: 12px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #003B46;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 59, 70, 0.2);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Vibrant & Block-based

**Keywords:** Bold, energetic, playful, block layout, geometric shapes, high color contrast, duotone, modern, energetic

**Best For:** Startups, creative agencies, gaming, social media, youth-focused, entertainment, consumer

**Key Effects:** Large sections (48px+ gaps), animated patterns, bold hover (color shift), scroll-snap, large type (32px+), 200-300ms

### Page Pattern

**Pattern Name:** Minimal Single Column

- **Conversion Strategy:** Single CTA focus. Large typography. Lots of whitespace. No nav clutter. Mobile-first.
- **CTA Placement:** Center, large CTA button
- **Section Order:** 1. Hero headline, 2. Short description, 3. Benefit bullets (3 max), 4. CTA, 5. Footer

---

## Anti-Patterns (Do NOT Use)

- ❌ Low-quality imagery
- ❌ Outdated hours

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
