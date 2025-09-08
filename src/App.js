import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [poiVisible, setPoiVisible] = useState(true);
  const [mode, setMode] = useState('walk');
  const [rangeMin, setRangeMin] = useState(15);
  const [mapLoaded, setMapLoaded] = useState(false);
  // Use the exact layer id from your style (lowercase)
  const poiLayerId = 'clalit-poi-200-1898zd';
  const heatmapLayerId = 'clalit-accessibility-heatmap-3v21at';

  // Refs to align icons exactly above buttons without moving buttons
  const iconsRowRef = useRef(null);
  const walkBtnRef = useRef(null);
  const carBtnRef = useRef(null);
  const transitBtnRef = useRef(null);
  const [iconLefts, setIconLefts] = useState({ walk: 0, car: 0, transit: 0 });
  const [ageGroup, setAgeGroup] = useState('5-18');
  const [coverageData, setCoverageData] = useState(null);

  // Load real data from JSON file
  useEffect(() => {
    fetch(process.env.PUBLIC_URL + '/demographics_accessibility.json')
      .then(response => response.json())
      .then(data => {
        // Transform data to match our expected format
        const transformedData = {};
        Object.keys(data).forEach(mode => {
          transformedData[mode] = {};
          Object.keys(data[mode]).forEach(timeRange => {
            const rangeNum = parseInt(timeRange.replace('min', ''));
            transformedData[mode][rangeNum] = {};
            Object.keys(data[mode][timeRange]).forEach(age => {
              transformedData[mode][rangeNum][age] = {
                percentage: Math.round(data[mode][timeRange][age].percentage),
                total: data[mode][timeRange][age].total_population,
                accessible: data[mode][timeRange][age].accessible_population
              };
            });
          });
        });
        setCoverageData(transformedData);
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error('Failed to load demographics data:', error);
        // Set fallback data to prevent crashes
        setCoverageData({});
      });
  }, []);

  useEffect(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoiYXJ0ZW1ua3RuIiwiYSI6ImNtN2t0eGJnMzAzcTAybnJ6eGIyNGVwZjQifQ.m31J0mxEu4qvB66LxdGkPg';

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/artemnktn/cmfaql8ym003q01sdadp15oqe',
      center: [34.791462, 31.252973],
      zoom: 13,
    });

    mapRef.current = map;

    map.on('load', () => {
      const hasLayer = map.getLayer(poiLayerId);
      if (!hasLayer) {
        // eslint-disable-next-line no-console
        console.warn(`Layer not found in style: ${poiLayerId}`);
      } else {
        // Always set POI layer to visible on first load
        try { map.setLayoutProperty(poiLayerId, 'visibility', 'visible'); } catch (_) {}
        setPoiVisible(true);
      }

      // Load custom icon for POI layer
      const loadCustomIcon = () => {
        if (!map.hasImage('clalit-icon')) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try { 
              map.addImage('clalit-icon', img, { pixelRatio: 2 }); 
              // Create symbol layer for POI points
              const layerDef = map.getStyle().layers.find((l) => l.id === poiLayerId);
              if (layerDef && layerDef.source && layerDef['source-layer']) {
                const symbolLayerId = 'clalit-poi-icons';
                if (!map.getLayer(symbolLayerId)) {
                  map.addLayer({
                    id: symbolLayerId,
                    type: 'symbol',
                    source: layerDef.source,
                    'source-layer': layerDef['source-layer'],
                    filter: ['==', ['geometry-type'], 'Point'],
                    layout: {
                      'icon-image': 'clalit-icon',
                      'icon-size': 0.8,
                      'icon-allow-overlap': true,
                      'icon-ignore-placement': true,
                    },
                  });
                  // Hide original layer and show symbol layer
                  try { map.setLayoutProperty(poiLayerId, 'visibility', 'none'); } catch (_) {}
                  try { map.setLayoutProperty(symbolLayerId, 'visibility', 'visible'); } catch (_) {}
                  // Ensure POI is visible by default
                  setPoiVisible(true);
                }
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('Failed to add custom icon:', e);
            }
          };
          img.onerror = () => {
            // eslint-disable-next-line no-console
            console.warn('Failed to load clalit-icon.svg. Place it in public/.');
          };
          img.src = process.env.PUBLIC_URL + '/clalit-icon.svg';
        }
      };

      loadCustomIcon();
      setMapLoaded(true);
      
      // Force initial heatmap update after a short delay to ensure style is fully loaded
      setTimeout(() => {
        const heatLayer = map.getLayer(heatmapLayerId);
        if (heatLayer) {
          const column = `${mode}_${rangeMin}min`;
          // eslint-disable-next-line no-console
          console.log('Initializing heatmap with column:', column);
          
          try { map.setLayoutProperty(heatmapLayerId, 'visibility', 'visible'); } catch (_) {}
          try {
            map.setFilter(heatmapLayerId, [
              'all',
              ['>', ['coalesce', ['to-number', ['get', column]], 0], 0],
              ['<=', ['coalesce', ['to-number', ['get', column]], 0], rangeMin]
            ]);
          } catch (_) {}
          
          const maxRange = rangeMin;
          const midRange = maxRange / 2;
          const colorRamp = [
            'interpolate', ['linear'], ['coalesce', ['to-number', ['get', column]], 0],
            0, '#0C7A2A',
            midRange, '#7EEA45',
            maxRange, '#FFD400'
          ];
          
          try {
            if (heatLayer.type === 'heatmap') {
              map.setPaintProperty(heatmapLayerId, 'heatmap-color', colorRamp);
              map.setPaintProperty(heatmapLayerId, 'heatmap-radius', 18);
              map.setPaintProperty(heatmapLayerId, 'heatmap-intensity', 1.1);
              map.setPaintProperty(heatmapLayerId, 'heatmap-opacity', 0.9);
            } else if (heatLayer.type === 'fill') {
              try { map.setPaintProperty(heatmapLayerId, 'fill-pattern', null); } catch (_) {}
              map.setPaintProperty(heatmapLayerId, 'fill-color', colorRamp);
              map.setPaintProperty(heatmapLayerId, 'fill-opacity', 0.9);
              map.setPaintProperty(heatmapLayerId, 'fill-outline-color', 'rgba(0,0,0,0)');
            } else if (heatLayer.type === 'circle') {
              map.setPaintProperty(heatmapLayerId, 'circle-color', colorRamp);
              map.setPaintProperty(heatmapLayerId, 'circle-opacity', 0.9);
              map.setPaintProperty(heatmapLayerId, 'circle-radius', 6);
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to set heatmap properties:', e);
          }
        }
      }, 1000);
    });

    return () => {
      map.remove();
    };
  }, []);

  const togglePoi = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const nextVisible = !poiVisible;
    
    // Toggle symbol layer if it exists, otherwise toggle original layer
    const symbolLayerId = 'clalit-poi-icons';
    const layerToToggle = map.getLayer(symbolLayerId) ? symbolLayerId : poiLayerId;
    
    if (map.getLayer(layerToToggle)) {
      map.setLayoutProperty(layerToToggle, 'visibility', nextVisible ? 'visible' : 'none');
      setPoiVisible(nextVisible);
    }
  };

  // Update heatmap when mode, range, or map loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;
    const heatLayer = map.getLayer(heatmapLayerId);
    if (!heatLayer) {
      // eslint-disable-next-line no-console
      console.warn(`Heatmap layer not found: ${heatmapLayerId}`);
      return;
    }

    const column = `${mode}_${rangeMin}min`;

    // Ensure layer is visible
    try { map.setLayoutProperty(heatmapLayerId, 'visibility', 'visible'); } catch (_) {}

    // Filter features to 0 < value <= selected range
    try {
      map.setFilter(heatmapLayerId, [
        'all',
        ['>', ['coalesce', ['to-number', ['get', column]], 0], 0],
        ['<=', ['coalesce', ['to-number', ['get', column]], 0], rangeMin]
      ]);
    } catch (_) {}

    // Gradient color ramp driven by selected column value
    // Use minutes directly within [0, rangeMin]
    const rawValue = ['coalesce', ['to-number', ['get', column]], 0];
    const value = rawValue;

    // Adaptive ramp: 0 -> mid -> max(selected range)
    const maxRange = rangeMin; // 10/15/20/30 depending on selection
    const midRange = maxRange / 2;
    const colorRamp = [
      'interpolate', ['linear'], value,
      0, '#0C7A2A',
      midRange, '#7EEA45',
      maxRange, '#FFD400'
    ];

    try {
      if (heatLayer.type === 'heatmap') {
        map.setPaintProperty(heatmapLayerId, 'heatmap-color', colorRamp);
        map.setPaintProperty(heatmapLayerId, 'heatmap-radius', 18);
        map.setPaintProperty(heatmapLayerId, 'heatmap-intensity', 1.1);
        map.setPaintProperty(heatmapLayerId, 'heatmap-opacity', 0.9);
      } else if (heatLayer.type === 'fill') {
        // Make sure pattern/outline do not override fill color
        try { map.setPaintProperty(heatmapLayerId, 'fill-pattern', null); } catch (_) {}
        map.setPaintProperty(heatmapLayerId, 'fill-color', colorRamp);
        map.setPaintProperty(heatmapLayerId, 'fill-opacity', 0.9);
        map.setPaintProperty(heatmapLayerId, 'fill-outline-color', 'rgba(0,0,0,0)');
      } else if (heatLayer.type === 'circle') {
        map.setPaintProperty(heatmapLayerId, 'circle-color', colorRamp);
        map.setPaintProperty(heatmapLayerId, 'circle-opacity', 0.9);
        map.setPaintProperty(heatmapLayerId, 'circle-radius', 6);
      }
    } catch (_) {}
  }, [mode, rangeMin, mapLoaded]);

  // Position icons exactly above button centers without moving the buttons
  useEffect(() => {
    const row = iconsRowRef.current;
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    const centerX = (el) => (el ? el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 : 0);
    const walkX = centerX(walkBtnRef.current) - rowRect.left;
    const carX = centerX(carBtnRef.current) - rowRect.left;
    const transitX = centerX(transitBtnRef.current) - rowRect.left;
    setIconLefts({ walk: walkX, car: carX, transit: transitX });
  }, []);

  return (
    <div className="App">
      <div ref={mapContainerRef} className="map-container" />
      <div className="side-panel">
        <div className="control-card">
        <h1 className="card-title">Clalit Clinic<br/>Accessibility Map</h1>
        <div className="row">
          <div className="section-title">Where are Clinic located?</div>
          <label className="switch" aria-label="Toggle clinic layer">
            <input type="checkbox" checked={poiVisible} onChange={togglePoi} />
            <span className="slider" />
          </label>
        </div>
        <p className="card-text">
          Toggle clinic locations on the map to see which areas are served and which are underserved
        </p>

        <div className="divider" />

        <div className="section-title">Select Transport Modes</div>
        <p className="section-text">
          Compare how walking, driving, or public transit impacts travel reach across the city
        </p>

        <div className="icons-row" ref={iconsRowRef}>
          <img
            src={process.env.PUBLIC_URL + "/walk.png"}
            alt="Walk"
            className={`icon-img ${mode === 'walk' ? 'active' : ''}`}
            style={{ left: iconLefts.walk }}
          />
          <img
            src={process.env.PUBLIC_URL + "/car.png"}
            alt="Car"
            className={`icon-img ${mode === 'car' ? 'active' : ''}`}
            style={{ left: iconLefts.car }}
          />
          <img
            src={process.env.PUBLIC_URL + "/transit.png"}
            alt="Transit"
            className={`icon-img ${mode === 'transit' ? 'active' : ''}`}
            style={{ left: iconLefts.transit }}
          />
        </div>

        <div className="modes-row">
          <button
            className={`mode-btn ${mode === 'walk' ? 'active' : ''}`}
            onClick={() => setMode('walk')}
            ref={walkBtnRef}
          >
            Walk
          </button>
          <button
            className={`mode-btn ${mode === 'car' ? 'active' : ''}`}
            onClick={() => setMode('car')}
            ref={carBtnRef}
          >
            Car
          </button>
          <button
            className={`mode-btn ${mode === 'transit' ? 'active' : ''}`}
            onClick={() => setMode('transit')}
            ref={transitBtnRef}
          >
            Transit
          </button>
        </div>

        <div className="divider" />

        <div className="section-title">Select Accessibility Range</div>
        <p className="section-text">
          See how far people can reach in 10, 20, or 30 minutes of travel
        </p>

        <div className="ranges-row">
          {[10, 15, 20, 30].map((m) => (
            <button
              key={m}
              className={`range-btn ${rangeMin === m ? 'active' : ''}`}
              onClick={() => setRangeMin(m)}
            >
              {m} min
            </button>
          ))}
        </div>

        </div>

        {/* Coverage by Age group card */}
        <div className="age-card">
          <div className="section-title">Coverage of City by the Age group</div>

          <div className="age-buttons">
            {['0-4', '5-18', '19-64', '65+'].map((g) => (
              <button
                key={g}
                className={`age-btn ${ageGroup === g ? 'active' : ''}`}
                onClick={() => setAgeGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="age-body">
            {(() => {
              if (!coverageData) {
                return <p className="card-text">Loading data...</p>;
              }
              
              const data = coverageData[mode]?.[rangeMin]?.[ageGroup];
              if (!data) return null;
              
              const ageLabel = ageGroup === '0-4' ? 'children' : ageGroup === '5-18' ? 'children' : ageGroup === '19-64' ? 'adults' : 'seniors';
              const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
              
              return (
                <>
                  <p className="card-text" style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
                    {data.percentage}% of {ageLabel} in Be'er-Sheva can {modeLabel} to a Clalit Clinic in {rangeMin}min.
                  </p>
                  <p className="card-text">
                    This means that {data.accessible.toLocaleString()} {ageLabel} in Be'er-Sheva have access, out of {data.total.toLocaleString()} {ageLabel}
                  </p>
                </>
              );
            })()}
          </div>

          <div className="divider" />

          <div className="card-text" style={{ color: '#666' }}>in collaboration with</div>
          <img src={process.env.PUBLIC_URL + "/nur-logo.png"} alt="Negev Urban Research" className="age-logo" />
        </div>
      </div>

      {/* Adaptive legend bottom-right */}
      <div className="legend">
        <div
          className="legend-bar"
          style={{ background: 'linear-gradient(90deg, #0C7A2A 0%, #7EEA45 50%, #FFD400 100%)' }}
        />
        <div className="legend-labels">
          <span>0 min</span>
          <span>{Math.round(rangeMin / 2)} min</span>
          <span>{rangeMin} min</span>
        </div>
      </div>

    </div>
  );
}

export default App;
