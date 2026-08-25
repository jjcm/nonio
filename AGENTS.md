# Project Instructions

## Repo layout
This is a single-tree monorepo. `nonio-frontend`, `nonio-backend`, and the four CDNs (`nonio-avatar-cdn`, `nonio-image-cdn`, `nonio-video-cdn`, `nonio-html-cdn`) are ordinary directories — there are no git submodules and no extra remotes. One `git clone` plus `./quickStart.sh` brings up the full stack (ports documented in README.md).

## Code Style
For the frontend (nonio-frontend), whenever possible be terse and concise. Don't overuse try/catch flows. Don't define variables that are only used once. The frontend package size is extremely important - don't be wasteful. 
DRY practices are a must - if a similar function is in place somewhere else, consolidate it into a shared function. If a similar UI pattern is reused in multiple places, consider creating a new webcomponent for it. 

## nonio-frontend rules
This is the frontend of the system. NEVER update the generated `.html` files directly. **CSS source-of-truth is now `nonio-frontend/nonio.css`** (Stylus is deprecated). Create a webcomponent if it would make the semantic readability of the html better.

## CSS nesting (required)
When writing CSS (including component `css()` strings and `nonio-frontend/nonio.css`), **use modern CSS nesting** where it improves readability and reduces repetition.

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

## DOM manipulation rules
render() like functions should ONLY be used for initial page loads or full page reloads. NEVER trigger a render() function just to add an element. All dom manipulations should be surgical in nature. .append, .prepend, and .delete functions should be the default first approach. Exceptions to this are clearing all children, in which case a .innerHTML = '' should be used instead of traversing every dom and triggering a delete. 

## Realtime update rules
Avoid polling patterns for continuously changing UI state. Prefer websocket-based subscriptions whenever possible for live/continuous updates.

## nonio-backend docs
When adding or removing backend routes in `nonio-backend/httpd/routes.go`, update `nonio-backend/docs/` accordingly. Update both the pug docs (and sidebar in `sidebar.pug`) and `LLM.md` so they stay in sync. Run the docs server from `nonio-backend/docs/` with `npm i && npm start` (port 8889).

## CURRENT_STATE.md
This file should always be updated with the latest focus. We may have multiple ongoing focuses, so date any update you make. Consider this a handy changelog. Never delete things from this file, but feel free to consolidate. Make sure this has a persistent changelog. It will be cleared manually by the user when changelogs are posted or features are finished. 