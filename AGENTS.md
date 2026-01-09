# Project Instructions

## Code Style
For the frontend (soci-frontend), whenever possible be terse and concise. Don't overuse try/catch flows. Don't define variables that are only used once. The frontend package size is extremely important - don't be wasteful. 
DRY practices are a must - if a similar function is in place somewhere else, consolidate it into a shared function. If a similar UI pattern is reused in multiple places, consider creating a new webcomponent for it. 

## soci-frontend rules
This is the frontend of the system. NEVER update the generated `.html` files directly. **CSS source-of-truth is now `soci-frontend/soci.css`** (Stylus is deprecated). Create a webcomponent if it would make the semantic readability of the html better.

## CSS nesting (required)
When writing CSS (including component `css()` strings and `soci-frontend/soci.css`), **use modern CSS nesting** where it improves readability and reduces repetition.

- Prefer nesting with the `&` selector for pseudo-classes / pseudo-elements and compound selectors.
- Avoid duplicating the parent selector when nesting can express it once.
- Reference: [MDN `&` nesting selector](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Nesting_selector)

### Quick reference

#### Pseudo-classes / no-whitespace attachment

```css
.button {
  color: var(--text);

  &:hover {
    color: var(--text-secondary);
  }
}
```

#### Pseudo-elements

```css
.fade {
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
}
```

#### Descendant nesting (whitespace implied)

```css
.card {
  padding: 12px;

  .title {
    font-weight: 600;
  }
}
```

#### “Reverse context” (`.featured .card`) using `&`

```css
.card {
  .featured & {
    border-color: var(--brand-color);
  }
}
```

## CURRENT_STATE.md
This file should always be updated with the latest focus. We may have multiple ongoing focuses, so date any update you make. Consider this a handy changelog. Never delete things from this file, but feel free to consolidate. Make sure this has a persistent changelog. It will be cleared manually by the user when changelogs are posted or features are finished. 