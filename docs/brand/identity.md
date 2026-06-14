# DiscWeave Identity

DiscWeave should look like a precise local archive for careful music collectors:
quiet, structured, fast, and free from streaming or marketplace signals.

The official identity direction is **Woven Catalog Grid**. It combines record
grooves, index-card rows, and relationship lines into one mark. It fits the
product name without using a play button, headphones, waveform, shopping cart,
social graph, or generic database cylinder.

SuperDesign exploration:

- Project: <https://app.superdesign.dev/teams/62703528-4d89-458f-b1ee-8f649c2c209e/projects/d4ec09cd-2d7d-448c-b71a-68351be16fe5>
- Draft: <https://p.superdesign.dev/draft/d10971ea-2e9f-435b-8052-800537c7b4be>

## Primary Logo

Use these canonical assets for product and repository surfaces:

| Asset                                         | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `docs/brand/assets/logo-mark.svg`             | Primary standalone Woven Catalog Grid mark. |
| `docs/brand/assets/logo-lockup.svg`           | README and documentation header lockup.     |
| `app/public/favicon.svg`                      | Vite/browser favicon.                       |
| `app/resources/icon.svg`                      | Source artwork for packaged desktop icons.  |
| `app/resources/icon.icns`                     | macOS application icon used by Electron.    |
| `app/src/app/DiscWeaveLogo.tsx`               | Product sidebar mark component.             |
| `docs/brand/assets/github-social-preview.svg` | GitHub repository social preview source.    |

The exploratory alternates remain in `docs/brand/assets/` for history only:
`logo-monogram-dw.svg` and `logo-archive-compass.svg`.

## Core Style

- Palette: use the existing product tokens first.
- Primary mark color: `#171c18`.
- Quiet accent: `#244733`, only for the central owned-item node or small
  anchor details.
- Canvas: `#f3f4f1`.
- Surface: `#ffffff`.
- Border: `#dfe3dc` and `#cbd1c7`.
- Typography: Inter/system UI.
- Radius: 6-8px in product UI, up to 32px only for standalone large brand art.
- Rendering: flat vector, 1px-style line logic, no neon gradients, no shadows.

## Application Map

Apply the identity in these places:

- `app/public/favicon.svg` for the Vite/browser favicon.
- `app/src/app/DiscWeaveLogo.tsx` for the in-product sidebar brand mark.
- `app/resources/icon.icns` for packaged macOS application icons.
- `README.md` hero lockup and screenshots.
- GitHub repository social preview using
  `docs/brand/assets/github-social-preview.svg` as the source artwork.
- Release notes and DMG artwork if DiscWeave adds branded release packaging.
- Product docs that need a cover or title image.

Do not add logo banners to GitHub issue or pull request templates by default.
Those templates should stay dense and task-focused; the repository header and
README are enough branding for GitHub contribution flows.
