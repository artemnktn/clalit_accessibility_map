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
  const [isAgeCardCollapsed, setIsAgeCardCollapsed] = useState(true);
  const [popupData, setPopupData] = useState(null);
  const [popupPosition, setPopupPosition] = useState('above');
  const [updateTimeout, setUpdateTimeout] = useState(null);

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
      minZoom: 11,
      maxZoom: 15,
    });

    mapRef.current = map;

    map.on('load', () => {
      try {
        const hasLayer = map.getLayer(poiLayerId);
        if (!hasLayer) {
          // eslint-disable-next-line no-console
          console.warn(`Layer not found in style: ${poiLayerId}`);
        } else {
          // Always set POI layer to visible on first load
          try { map.setLayoutProperty(poiLayerId, 'visibility', 'visible'); } catch (_) {}
          setPoiVisible(true);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error checking POI layer:', e);
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
                try {
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
                  
                  // Add click handler for popup
                  map.on('click', symbolLayerId, (e) => {
                    const features = e.features;
                    if (features && features.length > 0) {
                      const feature = features[0];
                      const point = map.project(e.lngLat);
                      
                      // Get popup dimensions (approximate)
                      const popupWidth = 300;
                      const popupHeight = 200;
                      const margin = 20;
                      
                      // Calculate adjusted position to keep popup within screen bounds
                      let adjustedX = point.x;
                      let adjustedY = point.y;
                      
                      // Check right boundary
                      if (point.x + popupWidth / 2 > window.innerWidth - margin) {
                        adjustedX = window.innerWidth - popupWidth / 2 - margin;
                      }
                      
                      // Check left boundary
                      if (point.x - popupWidth / 2 < margin) {
                        adjustedX = popupWidth / 2 + margin;
                      }
                      
                      // Check top boundary (popup appears above the point)
                      let position = 'above';
                      if (point.y - popupHeight < margin) {
                        adjustedY = point.y + popupHeight / 2 + 20; // Show below point instead
                        position = 'below';
                      }
                      
                      setPopupData({
                        coordinates: {
                          x: adjustedX,
                          y: adjustedY
                        },
                        properties: feature.properties
                      });
                      setPopupPosition(position);
                    }
                  });
                  
                  // Change cursor on hover
                  map.on('mouseenter', symbolLayerId, () => {
                    map.getCanvas().style.cursor = 'pointer';
                  });
                  
                  map.on('mouseleave', symbolLayerId, () => {
                    map.getCanvas().style.cursor = '';
                  });
                }
                } catch (e) {
                  // eslint-disable-next-line no-console
                  console.warn('Error checking symbol layer:', e);
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
        try {
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
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Error accessing heatmap layer:', e);
        }
      }, 1000);
    });

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePoi = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const nextVisible = !poiVisible;
    
    // Toggle symbol layer if it exists, otherwise toggle original layer
    const symbolLayerId = 'clalit-poi-icons';
    let layerToToggle = poiLayerId;
    
    try {
      if (map.getLayer(symbolLayerId)) {
        layerToToggle = symbolLayerId;
      }
    } catch (e) {
      // Layer doesn't exist, use original layer
    }
    
    try {
      if (map.getLayer(layerToToggle)) {
        map.setLayoutProperty(layerToToggle, 'visibility', nextVisible ? 'visible' : 'none');
        setPoiVisible(nextVisible);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Error toggling POI layer:', e);
    }
  };

  // Update heatmap when mode, range, or map loads
  useEffect(() => {
    // Clear any pending updates
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }

    // Debounce updates to prevent excessive redraws
    const timeoutId = setTimeout(() => {
      const map = mapRef.current;
      if (!map || !mapLoaded || !map.isStyleLoaded()) return;
    
    // Check if layer exists before trying to access it
    if (!map.getLayer(heatmapLayerId)) {
      // eslint-disable-next-line no-console
      console.warn(`Heatmap layer not found: ${heatmapLayerId}`);
      return;
    }

    const heatLayer = map.getLayer(heatmapLayerId);
    const column = `${mode}_${rangeMin}min`;

    // Batch all updates to prevent multiple redraws
    const updates = [];

    // Ensure layer is visible (only if not already visible)
    try {
      const currentVisibility = map.getLayoutProperty(heatmapLayerId, 'visibility');
      if (currentVisibility !== 'visible') {
        updates.push(() => map.setLayoutProperty(heatmapLayerId, 'visibility', 'visible'));
      }
    } catch (_) {}

    // Filter features to 0 < value <= selected range
    const newFilter = [
      'all',
      ['>', ['coalesce', ['to-number', ['get', column]], 0], 0],
      ['<=', ['coalesce', ['to-number', ['get', column]], 0], rangeMin]
    ];
    
    try {
      const currentFilter = map.getFilter(heatmapLayerId);
      if (JSON.stringify(currentFilter) !== JSON.stringify(newFilter)) {
        updates.push(() => map.setFilter(heatmapLayerId, newFilter));
      }
    } catch (_) {
      updates.push(() => map.setFilter(heatmapLayerId, newFilter));
    }

    // Gradient color ramp driven by selected column value
    const rawValue = ['coalesce', ['to-number', ['get', column]], 0];
    const maxRange = rangeMin; // 10/15/20/30 depending on selection
    const midRange = maxRange / 2;
    const colorRamp = [
      'interpolate', ['linear'], rawValue,
      0, '#0C7A2A',
      midRange, '#7EEA45',
      maxRange, '#FFD400'
    ];

    // Apply paint properties based on layer type
    try {
      if (heatLayer.type === 'heatmap') {
        updates.push(() => {
          map.setPaintProperty(heatmapLayerId, 'heatmap-color', colorRamp);
          map.setPaintProperty(heatmapLayerId, 'heatmap-radius', 18);
          map.setPaintProperty(heatmapLayerId, 'heatmap-intensity', 1.1);
          map.setPaintProperty(heatmapLayerId, 'heatmap-opacity', 0.9);
        });
      } else if (heatLayer.type === 'fill') {
        updates.push(() => {
          try { map.setPaintProperty(heatmapLayerId, 'fill-pattern', null); } catch (_) {}
          map.setPaintProperty(heatmapLayerId, 'fill-color', colorRamp);
          map.setPaintProperty(heatmapLayerId, 'fill-opacity', 0.9);
          map.setPaintProperty(heatmapLayerId, 'fill-outline-color', 'rgba(0,0,0,0)');
        });
      } else if (heatLayer.type === 'circle') {
        updates.push(() => {
          map.setPaintProperty(heatmapLayerId, 'circle-color', colorRamp);
          map.setPaintProperty(heatmapLayerId, 'circle-opacity', 0.9);
          map.setPaintProperty(heatmapLayerId, 'circle-radius', 6);
        });
      }
    } catch (_) {}

    // Execute all updates in a single batch to minimize redraws
    if (updates.length > 0) {
      // Use requestAnimationFrame to batch updates
      requestAnimationFrame(() => {
        updates.forEach(update => {
          try {
            update();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Error applying map update:', e);
          }
        });
      });
    }
    }, 100); // 100ms debounce

    setUpdateTimeout(timeoutId);

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [mode, rangeMin, mapLoaded, heatmapLayerId, updateTimeout]);

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
                        <div className="age-card-header" onClick={() => setIsAgeCardCollapsed(!isAgeCardCollapsed)}>
                          <div className="section-title">Coverage of City by the Age group</div>
                          <div className="collapse-button">
                            {isAgeCardCollapsed ? '+' : '−'}
                          </div>
                        </div>

                        {!isAgeCardCollapsed && (
                          <>
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
          <a 
            href="https://www.nurlab.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="nur-logo-link"
          >
            <img src={process.env.PUBLIC_URL + "/nur-logo.png"} alt="Negev Urban Research" className="age-logo" />
                        </a>
                          </>
                        )}
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

      {/* Simple popup */}
      {popupData && (
        <div className="popup-overlay">
          <div 
            className={`popup-content ${popupPosition === 'below' ? 'below' : ''}`}
            style={{
              left: popupData.coordinates.x,
              top: popupData.coordinates.y
            }}
          >
            <div className="popup-header">
              <div>
                <h3>{popupData.properties.neighborhood || 'Clinic Information'}</h3>
                {popupData.properties.name && (
                  <p className="popup-subtitle">{popupData.properties.name}</p>
                )}
              </div>
              <button className="popup-close" onClick={() => setPopupData(null)}>×</button>
            </div>
            <div className="popup-body">
              {/* Pie Chart for categories */}
              <div className="pie-chart-container">
                <svg width="120" height="120" className="pie-chart">
                  {(() => {
                    const categories = ['community', 'education', 'food', 'healthcare', 'recreation', 'retail', 'services', 'transport'];
                    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
                    const data = categories.map(cat => ({
                      name: cat,
                      value: parseFloat(popupData.properties[cat]) || 0,
                      color: colors[categories.indexOf(cat)]
                    })).filter(item => item.value > 0);
                    
                    if (data.length === 0) return null;
                    
                    const total = data.reduce((sum, item) => sum + item.value, 0);
                    let currentAngle = 0;
                    
                    return data.map((item, index) => {
                      // const percentage = (item.value / total) * 100;
                      const angle = (item.value / total) * 360;
                      const startAngle = currentAngle;
                      const endAngle = currentAngle + angle;
                      currentAngle += angle;
                      
                      const radius = 50;
                      const centerX = 60;
                      const centerY = 60;
                      
                      const startAngleRad = (startAngle - 90) * Math.PI / 180;
                      const endAngleRad = (endAngle - 90) * Math.PI / 180;
                      
                      const x1 = centerX + radius * Math.cos(startAngleRad);
                      const y1 = centerY + radius * Math.sin(startAngleRad);
                      const x2 = centerX + radius * Math.cos(endAngleRad);
                      const y2 = centerY + radius * Math.sin(endAngleRad);
                      
                      const largeArcFlag = angle > 180 ? 1 : 0;
                      
                      const innerRadius = 20;
                      const innerStartAngleRad = (startAngle - 90) * Math.PI / 180;
                      const innerEndAngleRad = (endAngle - 90) * Math.PI / 180;
                      
                      const innerX1 = centerX + innerRadius * Math.cos(innerStartAngleRad);
                      const innerY1 = centerY + innerRadius * Math.sin(innerStartAngleRad);
                      const innerX2 = centerX + innerRadius * Math.cos(innerEndAngleRad);
                      const innerY2 = centerY + innerRadius * Math.sin(innerEndAngleRad);
                      
                      const pathData = [
                        `M ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        `L ${innerX2} ${innerY2}`,
                        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1}`,
                        'Z'
                      ].join(' ');
                      
                      return (
                        <path
                          key={index}
                          d={pathData}
                          fill={item.color}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    });
                  })()}
                </svg>
                
                {/* Legend */}
                <div className="pie-legend">
                  {(() => {
                    const categories = ['community', 'education', 'food', 'healthcare', 'recreation', 'retail', 'services', 'transport'];
                    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
                    return categories.map((cat, index) => {
                      const value = parseFloat(popupData.properties[cat]) || 0;
                      if (value === 0) return null;
                      return (
                        <div key={cat} className="legend-item">
                          <div className="legend-color" style={{ backgroundColor: colors[index] }}></div>
                          <span className="legend-label">{cat}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
