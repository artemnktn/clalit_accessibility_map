# Clalit Clinic Accessibility Map

Interactive map application showing accessibility to Clalit clinics in Be'er-Sheva, Israel.

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

The live site is the static **`build/`** output published by GitHub Actions (official **Deploy to GitHub Pages** flow), not `main` as raw source.

**Automatic deploy:** on every push to `main`, `.github/workflows/deploy-gh-pages.yml` builds and uploads the artifact. Add a repository secret:

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `REACT_APP_MAPBOX_TOKEN` — value: your Mapbox public token (same as in `.env.local`)

**Pages source (required once):** **Settings** → **Pages** → **Build and deployment** → source **GitHub Actions** (not “Deploy from a branch”).

**Manual deploy** (pushes to the `gh-pages` branch from your machine, if you prefer):

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
