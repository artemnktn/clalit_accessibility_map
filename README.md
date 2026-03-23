# Closer to Care

Interactive map of **accessibility to clinics** in Be’er-Sheva — walking, driving, and public transport.

## Technology Stack

- **React.js** — frontend
- **Mapbox GL JS** — map
- **CSS3** — UI styling
- **JSON / GeoJSON** — data

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

5. Open [http://localhost:3000](http://localhost:3000) in the browser (or the path implied by `homepage` in `package.json` when using `npm start`).

## GitHub Pages (https://artemnktn.github.io/clalit_accessibility_map/)

The live site is the static **`build/`** output published by GitHub Actions, not `main` as raw source.

**Important:** `homepage` in `package.json` must match the GitHub Pages URL (repo name). If you rename the repository (e.g. to `closer-to-care`), update `homepage` to `https://artemnktn.github.io/<new-repo-name>/` and redeploy.

**Automatic deploy:** on every push to `main`, `.github/workflows/deploy-gh-pages.yml` builds and uploads the artifact. Add a repository secret:

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `REACT_APP_MAPBOX_TOKEN` — value: your Mapbox public token (same as in `.env.local`)

**Pages source (required once):** **Settings** → **Pages** → **Build and deployment** → source **GitHub Actions**.

**Manual deploy** (pushes to the `gh-pages` branch from your machine, if you prefer):

```bash
# .env.local must contain REACT_APP_MAPBOX_TOKEN for a correct map build
npm run deploy
```

## Data Sources

- **Clinic POI data** — locations and specialisations
- **Grid + travel times + population by age** — `clinic_accessibility_matrix_full.geojson` (per cell: `age_*`, `walk_min` / `car_min` / `transit_min`, per-clinic columns); heatmap and **Accessibility by age groups** use this file (specialisation filter uses clinic list from POI GeoJSON)

## Features Overview

### Map Interface

- Toggle clinic visibility
- Custom clinic markers
- Focus on Be’er-Sheva area

### Accessibility Analysis

- Filtering by transport mode
- Dynamic time threshold
- Age-specific coverage statistics

### UI/UX

- Mobile-friendly layout
- Controls and legends aligned with the map

## Collaboration

Developed in collaboration with **Negev Urban Research**.

## License

This project is for research and educational purposes.
