/**
 * Reads UPD/clinic_accessibility_matrix_full.geojson (EPSG:2039 polygons),
 * reprojects to WGS84, adds walk_min / car_min / transit_min (min across clinics).
 * Writes public/clinic_accessibility_matrix_full.geojson
 */
const fs = require('fs');
const path = require('path');
const proj4 = require('proj4');

proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-24.002400025,-17.103200053,-17.844400039,-0.330900049,-1.85269001,1.66969001,5.42480005 +units=m +no_defs'
);

function ringToWgs84(ring) {
  return ring.map(([x, y]) => {
    const [lon, lat] = proj4('EPSG:2039', 'WGS84', [x, y]);
    return [lon, lat];
  });
}

function polygonToWgs84(coords) {
  return coords.map((ring) => ringToWgs84(ring));
}

function transformGeometry(geom) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: polygonToWgs84(geom.coordinates) };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly) => polygonToWgs84(poly)),
    };
  }
  return geom;
}

function addMinTravelProps(props) {
  const walkTimes = [];
  const carTimes = [];
  const transitTimes = [];
  for (const key of Object.keys(props)) {
    if (key.endsWith('_WALK_min')) walkTimes.push(Number(props[key]));
    else if (key.endsWith('_CAR_min')) carTimes.push(Number(props[key]));
    else if (key.endsWith('_TRANSIT_min')) transitTimes.push(Number(props[key]));
  }
  const safeMin = (arr) => (arr.length ? Math.min(...arr.filter((n) => !Number.isNaN(n))) : 0);
  return {
    ...props,
    walk_min: safeMin(walkTimes),
    car_min: safeMin(carTimes),
    transit_min: safeMin(transitTimes),
  };
}

const root = path.join(__dirname, '..');
const inputPath = path.join(root, 'UPD', 'clinic_accessibility_matrix_full.geojson');
const outputPath = path.join(root, 'public', 'clinic_accessibility_matrix_full.geojson');

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const features = raw.features.map((f) => ({
  type: 'Feature',
  properties: addMinTravelProps(f.properties || {}),
  geometry: transformGeometry(f.geometry),
}));

const out = { type: 'FeatureCollection', features };
fs.writeFileSync(outputPath, JSON.stringify(out));
// eslint-disable-next-line no-console
console.log('Wrote', outputPath, 'features:', features.length);
