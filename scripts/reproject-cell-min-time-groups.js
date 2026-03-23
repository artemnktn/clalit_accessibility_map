/**
 * Reads UPD/cell_min_time_groups.geojson (EPSG:2039 polygons).
 * Reprojects to WGS84; adds walk_min / car_min / transit_min as min of
 * min_*_1_24, min_*_25, min_*_26 (times to nearest clinic in each group for the filtered spec).
 * Writes public/cell_min_time_groups.geojson
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

function minOfKeys(props, keys) {
  const nums = keys.map((k) => Number(props[k])).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.min(...nums) : 0;
}

function addGroupMinProps(props) {
  const p = props || {};
  return {
    ...p,
    walk_min: minOfKeys(p, ['min_walk_1_24', 'min_walk_25', 'min_walk_26']),
    car_min: minOfKeys(p, ['min_car_1_24', 'min_car_25', 'min_car_26']),
    transit_min: minOfKeys(p, ['min_transit_1_24', 'min_transit_25', 'min_transit_26']),
  };
}

const root = path.join(__dirname, '..');
const inputPath = path.join(root, 'UPD', 'cell_min_time_groups.geojson');
const outputPath = path.join(root, 'public', 'cell_min_time_groups.geojson');

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const features = raw.features.map((f) => ({
  type: 'Feature',
  properties: addGroupMinProps(f.properties),
  geometry: transformGeometry(f.geometry),
}));

const out = { type: 'FeatureCollection', features };
fs.writeFileSync(outputPath, JSON.stringify(out));
// eslint-disable-next-line no-console
console.log('Wrote', outputPath, 'features:', features.length);
