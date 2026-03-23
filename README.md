# Clalit Clinic Accessibility Map


## Technology Stack

- **React.js** - Frontend framework
- **Mapbox GL JS** - Interactive mapping
- **CSS3** - Glassmorphism styling
- **JSON** - Data integration

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/artemnktn/clalit_accessibility_map.git
```

2. Install dependencies:
```bash
npm install
```

3. Mapbox token (required for the map):
```bash
cp .env.example .env.local
```
Edit `.env.local` and set `REACT_APP_MAPBOX_TOKEN` to your [Mapbox public access token](https://account.mapbox.com/access-tokens/).

4. Start the development server:
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) to view it in the browser (or the path set in `homepage` in `package.json` when using `npm start`).

## GitHub Pages (https://artemnktn.github.io/clalit_accessibility_map/)

The live site is deployed from the **`gh-pages`** branch (static `build/` output), not from `main` directly.

**Automatic deploy:** on every push to `main`, the workflow `.github/workflows/deploy-gh-pages.yml` builds and pushes to `gh-pages`. You must add a repository secret:

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `REACT_APP_MAPBOX_TOKEN` — value: your Mapbox public token (same as in `.env.local`)

Also check **Settings** → **Pages** → **Build and deployment** → source should be **Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**.

**Manual deploy** (from your machine, if you prefer):

```bash
# .env.local must contain REACT_APP_MAPBOX_TOKEN for a correct map build
npm run deploy
```

## Data Sources

- **Clalit POI Data**: Clinic locations and accessibility metrics
- **Demographics Data**: Population statistics by age groups
- **Transport Analysis**: Walking, driving, and transit accessibility

## Features Overview

### Map Interface
- Toggle clinic visibility
- Custom Clalit icons
- Zoom to Be'er-Sheva area

### Accessibility Analysis
- Real-time filtering by transport mode
- Dynamic range selection
- Age-specific coverage statistics

### UI/UX
- Mobile-optimized interface
- Intuitive controls and legends

## Collaboration

Developed in collaboration with **Negev Urban Research**.

## License

This project is for research and educational purposes.
