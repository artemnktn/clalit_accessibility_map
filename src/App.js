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

  // Refs for buttons
  const walkBtnRef = useRef(null);
  const carBtnRef = useRef(null);
  const transitBtnRef = useRef(null);
  const [ageGroup, setAgeGroup] = useState('5-18');
  const [coverageData, setCoverageData] = useState(null);
  const [popupData, setPopupData] = useState(null);
  const [popupPosition, setPopupPosition] = useState('above');
  const [is3DMode, setIs3DMode] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [pulseValue, setPulseValue] = useState(0);

  // Load real data from JSON file
  useEffect(() => {
    fetch(process.env.PUBLIC_URL + '/demographics_accessibility_otp_FINAL.json')
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

  // Animation for clinic icons
  useEffect(() => {
    let animationId = null;
    const animateIcons = () => {
      setPulseValue(prev => {
        const newValue = prev + 0.02;
        return newValue > Math.PI * 2 ? 0 : newValue;
      });
      animationId = requestAnimationFrame(animateIcons);
    };
    
    if (poiVisible) {
      animateIcons();
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [poiVisible]);

  useEffect(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoiYXJ0ZW1ua3RuIiwiYSI6ImNtN2t0eGJnMzAzcTAybnJ6eGIyNGVwZjQifQ.m31J0mxEu4qvB66LxdGkPg';

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/artemnktn/cmfaql8ym003q01sdadp15oqe',
      center: [34.791462, 31.252973],
      zoom: 13,
      minZoom: 11,
      maxZoom: 15,
    });

    // Hide map initially to prevent flash of old heatmap
    mapInstance.getContainer().style.visibility = 'hidden';

    mapRef.current = mapInstance;

    mapInstance.on('load', () => {
      try {
        const hasLayer = mapInstance.getLayer(poiLayerId);
        if (!hasLayer) {
          // eslint-disable-next-line no-console
          console.warn(`Layer not found in style: ${poiLayerId}`);
        } else {
          // Always set POI layer to visible on first load
          try { mapInstance.setLayoutProperty(poiLayerId, 'visibility', 'visible'); } catch (_) {}
          setPoiVisible(true);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error checking POI layer:', e);
      }

      // Immediately remove old heatmap layer completely to prevent flash of wrong colors
      try {
        if (mapInstance.getLayer(heatmapLayerId)) {
          // Remove the layer completely instead of just hiding it
          mapInstance.removeLayer(heatmapLayerId);
          // eslint-disable-next-line no-console
          console.log('Removed old heatmap layer completely on load');
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error removing old heatmap layer:', e);
      }

      // Load custom icon for POI layer
      const loadCustomIcon = () => {
        if (!mapInstance.hasImage('clalit-icon')) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try { 
              mapInstance.addImage('clalit-icon', img, { pixelRatio: 2 }); 
              // Create symbol layer for updated POI points
              const symbolLayerId = 'clalit-poi-icons';
              try {
                if (!mapInstance.getLayer(symbolLayerId)) {
                  mapInstance.addLayer({
                    id: symbolLayerId,
                    type: 'symbol',
                    source: 'clalit-poi-updated',
                    filter: ['==', ['geometry-type'], 'Point'],
                    layout: {
                      'icon-image': 'clalit-icon',
                      'icon-size': 0.8,
                      'icon-allow-overlap': true,
                      'icon-ignore-placement': true,
                    },
                    paint: {
                      'icon-opacity': 0.8
                    }
                  });
                  // Hide original layer and show symbol layer
                  try { mapInstance.setLayoutProperty(poiLayerId, 'visibility', 'none'); } catch (_) {}
                  try { mapInstance.setLayoutProperty(symbolLayerId, 'visibility', 'visible'); } catch (_) {}
                  // Ensure POI is visible by default
                  setPoiVisible(true);
                  
                  // Add click handler for popup
                  mapInstance.on('click', symbolLayerId, (e) => {
                    // Stop event propagation to prevent map click handler from firing
                    e.originalEvent.stopPropagation();
                    
                    const features = e.features;
                    if (features && features.length > 0) {
                      const feature = features[0];
                      const point = mapInstance.project(e.lngLat);
                      
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
                  mapInstance.on('mouseenter', symbolLayerId, () => {
                    mapInstance.getCanvas().style.cursor = 'pointer';
                  });
                  
                  mapInstance.on('mouseleave', symbolLayerId, () => {
                    mapInstance.getCanvas().style.cursor = '';
                  });
                }
              } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Error creating updated POI symbol layer:', e);
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
      
      // Load new heatmap data source
      const loadNewHeatmapData = () => {
        try {
          // Remove the old layer completely to prevent showing wrong data
          if (mapInstance.getLayer(heatmapLayerId)) {
            mapInstance.removeLayer(heatmapLayerId);
            // eslint-disable-next-line no-console
            console.log('Removed old heatmap layer in loadNewHeatmapData');
          }
          
          // Remove old source if it exists
          if (mapInstance.getSource('clalit-accessibility-heatmap-new')) {
            mapInstance.removeSource('clalit-accessibility-heatmap-new');
          }
          
          // Add new GeoJSON source for heatmap
          mapInstance.addSource('clalit-accessibility-heatmap-new', {
            type: 'geojson',
            data: process.env.PUBLIC_URL + '/accessibility_heatmap_otp (17 Sept).geojson'
          });

          // Add new GeoJSON source for updated clinic data
          mapInstance.addSource('clalit-poi-updated', {
            type: 'geojson',
            data: process.env.PUBLIC_URL + '/clalit_poi_eng_1809.json'
          });
          
          // Create new heatmap layer using the new data source
          const newHeatmapLayerId = 'clalit-accessibility-heatmap-new';
          if (!mapInstance.getLayer(newHeatmapLayerId)) {
            // Use dynamic column based on current mode and range
            const column = `${mode}_${rangeMin}min`;
            const colorColumn = column;
            
            mapInstance.addLayer({
              id: newHeatmapLayerId,
              type: 'fill',
              source: 'clalit-accessibility-heatmap-new',
              filter: [
                'all',
                ['>', ['coalesce', ['to-number', ['get', column]], 0], 0],
                ['<=', ['coalesce', ['to-number', ['get', column]], 0], rangeMin]
              ],
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['to-number', ['get', colorColumn]], 0],
                  0, '#3C64B4',      // Blue (best accessibility)
                  7.5, '#64C896',    // Light green/teal
                  15, '#FFFFC8',     // Light yellow (neutral)
                  22.5, '#FF6432',   // Orange
                  30, '#8C1446'      // Dark red/purple (worst accessibility)
                ],
                'fill-opacity': 0.9,
                'fill-outline-color': 'rgba(0,0,0,0)'
              }
            });
          }
          
          // eslint-disable-next-line no-console
          console.log('Loaded new heatmap data source and created new layer');
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Error loading new heatmap data:', e);
        }
      };
      
      loadNewHeatmapData();
      setMapLoaded(true);
      
      // Don't show map yet - wait for heatmap to be ready
      // Map will be shown when heatmapReady becomes true
      
      // Add heatmap click handlers
      const addHeatmapClickHandlers = () => {
        const currentHeatmapLayerId = 'clalit-accessibility-heatmap-new';
        
        // Remove any existing popups first
        const existingPopups = document.querySelectorAll('.mapboxgl-popup');
        existingPopups.forEach(popup => popup.remove());
        
        // Add click handler for heatmap
        mapInstance.on('click', currentHeatmapLayerId, (e) => {
          // Stop event propagation to prevent map click handler from firing
          e.originalEvent.stopPropagation();
          
          const features = e.features;
          if (features && features.length > 0) {
            const feature = features[0];
            const properties = feature.properties;
            
            // Get current mode and range to show the right value
            const column = `${mode}_${rangeMin}min`;
            const value = properties[column];
            
            if (value !== null && value !== undefined) {
              const minutes = Math.round(value);
              const density = properties.density || 0;
              
              // Remove any existing custom popup
              const existingPopup = document.querySelector('.custom-heatmap-popup');
              if (existingPopup) {
                existingPopup.remove();
              }
              
              // Convert lngLat to pixel coordinates
              const point = mapInstance.project(e.lngLat);
              
              // Create custom popup element
              const popupElement = document.createElement('div');
              popupElement.className = 'custom-heatmap-popup';
              popupElement.style.cssText = `
                position: absolute;
                left: ${point.x}px;
                top: ${point.y - 60}px;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.25);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 28px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.05);
                padding: 24px 28px;
                font-size: 14px;
                font-weight: 700;
                color: #333;
                text-align: center;
                min-width: 200px;
                max-width: 300px;
                z-index: 1000;
                pointer-events: none;
                user-select: none;
              `;
              popupElement.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 4px;">${Math.round(density)} people</div>
                <div style="font-size: 14px;">${minutes} min to closest clinic</div>
              `;
              
              // Add to map container
              const mapContainer = mapInstance.getContainer();
              mapContainer.appendChild(popupElement);
              
              // Remove popup after 3 seconds
              setTimeout(() => {
                if (popupElement && popupElement.parentNode) {
                  popupElement.remove();
                }
              }, 3000);
            }
          }
        });
        
        // Add cursor pointer on hover
        mapInstance.on('mouseenter', currentHeatmapLayerId, () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });
        
        mapInstance.on('mouseleave', currentHeatmapLayerId, () => {
          mapInstance.getCanvas().style.cursor = '';
        });
      };
      
      // Add click handlers after a short delay to ensure layer is ready
      setTimeout(addHeatmapClickHandlers, 1500);
      
      // Force initial heatmap update after a short delay to ensure style is fully loaded
      setTimeout(() => {
        try {
          // Use the new heatmap layer only
          const currentHeatmapLayerId = 'clalit-accessibility-heatmap-new';
          const heatLayer = mapInstance.getLayer(currentHeatmapLayerId);
        if (heatLayer) {
          const column = `${mode}_${rangeMin}min`;
          // eslint-disable-next-line no-console
          console.log('Initializing heatmap with column:', column, 'layer:', currentHeatmapLayerId);
          
          try { mapInstance.setLayoutProperty(currentHeatmapLayerId, 'visibility', 'visible'); } catch (_) {}
          try {
            mapInstance.setFilter(currentHeatmapLayerId, [
              'all',
              ['>', ['coalesce', ['to-number', ['get', column]], 0], 0],
              ['<=', ['coalesce', ['to-number', ['get', column]], 0], rangeMin]
            ]);
          } catch (_) {}
          
          const maxRange = rangeMin;
          const midRange = maxRange / 2;
          const colorColumn = column;
          const colorRamp = [
            'interpolate', ['linear'], ['coalesce', ['to-number', ['get', colorColumn]], 0],
            0, '#0C7A2A',
            midRange, '#7EEA45',
            maxRange, '#FFD400'
          ];
          
          try {
            if (heatLayer.type === 'heatmap') {
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'heatmap-color', colorRamp);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'heatmap-radius', 18);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'heatmap-intensity', 1.1);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'heatmap-opacity', 0.9);
            } else if (heatLayer.type === 'fill') {
              try { mapInstance.setPaintProperty(currentHeatmapLayerId, 'fill-pattern', null); } catch (_) {}
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'fill-color', colorRamp);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'fill-opacity', 0.9);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'fill-outline-color', 'rgba(0,0,0,0)');
            } else if (heatLayer.type === 'circle') {
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'circle-color', colorRamp);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'circle-opacity', 0.9);
              mapInstance.setPaintProperty(currentHeatmapLayerId, 'circle-radius', 6);
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

    // Add click handler to close all popups when clicking on the map
    mapInstance.on('click', (e) => {
      // Add small delay to let layer click handlers fire first
      setTimeout(() => {
        // Check if click was on a layer (clinic or heatmap) - if so, don't close popups
        const features = mapInstance.queryRenderedFeatures(e.point);
        const hasLayerFeatures = features.some(feature => 
          feature.layer && (
            feature.layer.id === 'clalit-poi-icons' || 
            feature.layer.id === 'clalit-accessibility-heatmap-new' ||
            feature.layer.id === 'clalit-accessibility-heatmap-3v21at'
          )
        );
        
        // Only close popups if click was not on a layer
        if (!hasLayerFeatures) {
          // Close clinic popup
          setPopupData(null);
          
          // Close heatmap popup
          const existingHeatmapPopup = document.querySelector('.custom-heatmap-popup');
          if (existingHeatmapPopup) {
            existingHeatmapPopup.remove();
          }
        }
      }, 10);
    });

    return () => {
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update icon animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    
    const symbolLayerId = 'clalit-poi-icons';
    if (map.getLayer(symbolLayerId)) {
      const pulse = Math.sin(pulseValue);
      const size = 0.8 + (pulse * 0.1);
      const opacity = 0.85 + (pulse * 0.1);
      
      map.setPaintProperty(symbolLayerId, 'icon-opacity', opacity);
      map.setLayoutProperty(symbolLayerId, 'icon-size', size);
    }
  }, [pulseValue]);

  const togglePoi = () => {
    const map = mapRef.current;
    if (!map) return;
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
        // eslint-disable-next-line no-console
        console.log('POI layer toggled:', layerToToggle, 'visible:', nextVisible);
      } else {
        // eslint-disable-next-line no-console
        console.warn('POI layer not found:', layerToToggle);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Error toggling POI layer:', e);
    }
  };

  const handleInfoHover = (content, event) => {
    setHoveredInfo(content);
    setModalPosition({ x: event.clientX, y: event.clientY });
  };

  const handleInfoLeave = () => {
    setHoveredInfo(null);
  };

  const toggle3D = () => {
    // eslint-disable-next-line no-console
    console.log('toggle3D called, current is3DMode:', is3DMode);
    
    const map = mapRef.current;
    if (!map) {
      // eslint-disable-next-line no-console
      console.warn('Map ref not available');
      return;
    }
    
    // Map is ready, proceed with 3D toggle
    
    const next3DMode = !is3DMode;
    // eslint-disable-next-line no-console
    console.log('Setting 3D mode to:', next3DMode);
    setIs3DMode(next3DMode);
    
    // eslint-disable-next-line no-console
    console.log('Current mode:', mode, 'range:', rangeMin);
    
    if (next3DMode) {
      // Enable 3D mode - only heatmap extrusion, no terrain
      try {
        // Set 3D camera for better view of extruded data
        map.easeTo({
          pitch: 60,
          bearing: 0,
          duration: 2000
        });
        
        // eslint-disable-next-line no-console
        console.log('3D mode enabled - heatmap extrusion only');
        
        // Force a heatmap update to trigger 3D extrusion
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('Forcing heatmap update for 3D mode');
          // Trigger a re-render by updating the state
          setRangeMin(prev => prev);
        }, 100);
        
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error enabling 3D mode:', e);
      }
    } else {
      // Disable 3D mode
      // eslint-disable-next-line no-console
      console.log('=== DISABLING 3D MODE ===');
      try {
        // Reset camera to flat view
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 1000
        });
        
        // eslint-disable-next-line no-console
        console.log('3D mode disabled - camera reset to flat view');
        
        // Force a heatmap update to hide 3D extrusion immediately
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('Forcing heatmap update to disable 3D mode');
          // Trigger a re-render by updating the state
          setRangeMin(prev => prev);
        }, 50);
        
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error disabling 3D mode:', e);
      }
    }
  };

  // Update heatmap when mode, range, or map loads
  useEffect(() => {
    const map = mapRef.current;
    // eslint-disable-next-line no-console
    console.log('=== HEATMAP useEffect TRIGGERED ===', { mode, rangeMin, mapLoaded, is3DMode });
    // eslint-disable-next-line no-console
    console.log('Map ready check:', { map: !!map, mapLoaded, styleLoaded: map?.isStyleLoaded?.() });
    if (!map || !mapLoaded) {
      // eslint-disable-next-line no-console
      console.log('useEffect early return - map not ready');
      return;
    }
    
    // Don't hide heatmap while updating - keep it smooth
    
    // Aggressively remove old heatmap layer to prevent flash
    try {
      if (map.getLayer(heatmapLayerId)) {
        map.removeLayer(heatmapLayerId);
        // eslint-disable-next-line no-console
        console.log('Removed old heatmap layer in useEffect');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Error removing old heatmap layer in useEffect:', e);
    }
    
    // Use new heatmap layer only (old layer should be removed)
    const newHeatmapLayerId = 'clalit-accessibility-heatmap-new';
    const currentHeatmapLayerId = newHeatmapLayerId;
    
    // Check if layer exists before trying to access it
    if (!map.getLayer(currentHeatmapLayerId)) {
      // eslint-disable-next-line no-console
      console.warn(`Heatmap layer not found: ${currentHeatmapLayerId}`);
      return;
    }

    const heatLayer = map.getLayer(currentHeatmapLayerId);
    const column = `${mode}_${rangeMin}min`;
    
    // Debug logging
    // eslint-disable-next-line no-console
    console.log('Updating heatmap:', { 
      mode, 
      rangeMin, 
      column, 
      layerType: heatLayer?.type, 
      is3DMode,
      currentHeatmapLayerId,
      mapLoaded: !!mapLoaded
    });

    // Batch all updates to prevent multiple redraws
    const updates = [];

    // Ensure layer is visible (only if not already visible)
    try {
      const currentVisibility = map.getLayoutProperty(currentHeatmapLayerId, 'visibility');
      if (currentVisibility !== 'visible') {
        updates.push(() => map.setLayoutProperty(currentHeatmapLayerId, 'visibility', 'visible'));
      }
    } catch (_) {}

    // Filter features to 0 < value <= selected range
    const newFilter = [
      'all',
      ['>', ['coalesce', ['to-number', ['get', column]], 0], 0],
      ['<=', ['coalesce', ['to-number', ['get', column]], 0], rangeMin]
    ];
    
    // Always update filter to ensure data changes
    updates.push(() => {
      try {
        // eslint-disable-next-line no-console
        console.log('Setting filter for layer:', currentHeatmapLayerId, 'filter:', newFilter);
        map.setFilter(currentHeatmapLayerId, newFilter);
        // eslint-disable-next-line no-console
        console.log('Filter set successfully');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error setting filter:', e);
      }
    });

    // Gradient color ramp driven by selected column value - fixed scale 0-30 min (inverted coolwarm with green)
    const rawValue = ['coalesce', ['to-number', ['get', column]], 0];
    const maxRange = 30; // Fixed maximum range for all modes
    
    // For 3D mode, use density data instead of time data
    const densityValue = ['coalesce', ['to-number', ['get', 'density']], 0];
    const densityMaxRange = 1000; // Maximum density range for 3D extrusion
    const colorRamp = [
      'interpolate', ['linear'], rawValue,
      0, '#3C64B4',      // Blue (best accessibility)
      7.5, '#64C896',    // Light green/teal
      15, '#FFFFC8',     // Light yellow (neutral)
      22.5, '#FF6432',   // Orange
      maxRange, '#8C1446' // Dark red/purple (worst accessibility)
    ];

    // Apply paint properties based on layer type - always update colors
    try {
      if (heatLayer.type === 'heatmap') {
        updates.push(() => {
          try {
            map.setPaintProperty(heatmapLayerId, 'heatmap-color', colorRamp);
            map.setPaintProperty(heatmapLayerId, 'heatmap-radius', 18);
            map.setPaintProperty(heatmapLayerId, 'heatmap-intensity', 1.1);
            map.setPaintProperty(heatmapLayerId, 'heatmap-opacity', 0.9);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Error setting heatmap properties:', e);
          }
        });
      } else if (heatLayer.type === 'fill') {
        updates.push(() => {
          try {
            map.setPaintProperty(currentHeatmapLayerId, 'fill-pattern', null);
            map.setPaintProperty(currentHeatmapLayerId, 'fill-color', colorRamp);
            map.setPaintProperty(currentHeatmapLayerId, 'fill-outline-color', 'rgba(0,0,0,0)');
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Error setting fill properties:', e);
          }
        });
        
        // Handle 3D extrusion separately (not in updates array)
        if (is3DMode) {
          // eslint-disable-next-line no-console
          console.log('=== 3D MODE ENABLED ===');
          // eslint-disable-next-line no-console
          console.log('Creating 3D extrusion for layer:', currentHeatmapLayerId, 'mode:', mode, 'range:', rangeMin);
          // eslint-disable-next-line no-console
          console.log('HeatLayer source:', heatLayer?.source);
          // eslint-disable-next-line no-console
          console.log('HeatLayer type:', heatLayer?.type);
          
          // Create 3D extrusion based on density data - high density = high extrusion
          const extrusionHeight = [
            'interpolate',
            ['linear'],
            densityValue,
            0, 0,                    // No people = no extrusion
            densityMaxRange, 500     // High density = high extrusion
          ];
          
          // Use density-based color ramp for 3D mode
          const heightColorRamp = [
            'interpolate', ['linear'], densityValue,
            0, '#3C64B4',           // Blue (low density)
            densityMaxRange * 0.25, '#64C896',    // Light green (medium-low density)
            densityMaxRange * 0.5, '#FFFFC8',     // Light yellow (medium density)
            densityMaxRange * 0.75, '#FF6432',    // Orange (high density)
            densityMaxRange, '#8C1446'            // Red (very high density)
          ];
          
          // Try to create a new fill-extrusion layer if it doesn't exist
          const extrusionLayerId = currentHeatmapLayerId + '-3d';
          // eslint-disable-next-line no-console
          console.log('Checking for existing 3D layer:', extrusionLayerId, 'exists:', !!map.getLayer(extrusionLayerId));
          
          if (!map.getLayer(extrusionLayerId)) {
            try {
              // For new layer, use the new source directly
              const sourceId = currentHeatmapLayerId === 'clalit-accessibility-heatmap-new' ? 'clalit-accessibility-heatmap-new' : heatLayer.source;
              const source = map.getSource(sourceId);
              // eslint-disable-next-line no-console
              console.log('Source ID:', sourceId, 'Source exists:', !!source);
              
              if (source) {
                // eslint-disable-next-line no-console
                console.log('Creating 3D layer with source:', sourceId);
                
                map.addLayer({
                  id: extrusionLayerId,
                  type: 'fill-extrusion',
                  source: sourceId,
                  filter: newFilter,
                  paint: {
                    'fill-extrusion-color': heightColorRamp,
                    'fill-extrusion-height': extrusionHeight,
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 1.0,
                    'fill-extrusion-vertical-gradient': false
                  }
                });
                // eslint-disable-next-line no-console
                console.log('Successfully created 3D extrusion layer:', extrusionLayerId);
                
                // Move POI layer above 3D extrusion layer
                const symbolLayerId = 'clalit-poi-icons';
                if (map.getLayer(symbolLayerId)) {
                  try {
                    map.moveLayer(symbolLayerId);
                    // eslint-disable-next-line no-console
                    console.log('Moved POI layer above 3D extrusion');
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('Error moving POI layer:', e);
                  }
                }
              } else {
                // eslint-disable-next-line no-console
                console.error('Source not found for 3D layer:', sourceId);
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('Error creating 3D extrusion layer:', e);
            }
          } else {
            // Update existing extrusion layer
            // eslint-disable-next-line no-console
            console.log('Updating existing 3D layer:', extrusionLayerId);
            try {
              map.setPaintProperty(extrusionLayerId, 'fill-extrusion-color', heightColorRamp);
              map.setPaintProperty(extrusionLayerId, 'fill-extrusion-height', extrusionHeight);
              map.setPaintProperty(extrusionLayerId, 'fill-extrusion-opacity', 1.0);
              map.setFilter(extrusionLayerId, newFilter);
              // eslint-disable-next-line no-console
              console.log('Successfully updated 3D layer properties');
              
              // Ensure POI layer is above 3D extrusion layer
              const symbolLayerId = 'clalit-poi-icons';
              if (map.getLayer(symbolLayerId)) {
                try {
                  map.moveLayer(symbolLayerId);
                  // eslint-disable-next-line no-console
                  console.log('Moved POI layer above 3D extrusion');
                } catch (e) {
                  // eslint-disable-next-line no-console
                  console.warn('Error moving POI layer:', e);
                }
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error('Error updating 3D extrusion layer:', e);
            }
          }
          
          // Hide original layer when in 3D mode
          try {
            map.setPaintProperty(currentHeatmapLayerId, 'fill-opacity', 0);
            // eslint-disable-next-line no-console
            console.log('Hidden original layer for 3D mode');
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Error hiding original layer:', e);
          }
        } else {
          // Show original layer and hide 3D extrusion when not in 3D mode
          // eslint-disable-next-line no-console
          console.log('=== 3D MODE DISABLED ===');
          const extrusionLayerId = currentHeatmapLayerId + '-3d';
          // eslint-disable-next-line no-console
          console.log('Looking for 3D layer to hide:', extrusionLayerId, 'exists:', !!map.getLayer(extrusionLayerId));
          
          // Hide 3D extrusion layer immediately
          if (map.getLayer(extrusionLayerId)) {
            try {
              map.setPaintProperty(extrusionLayerId, 'fill-extrusion-opacity', 0);
              // eslint-disable-next-line no-console
              console.log('Hidden 3D extrusion layer');
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('Error hiding 3D extrusion layer:', e);
            }
          }
          
          // Show original layer immediately (not in updates array)
          try {
            // First ensure layer is visible
            map.setLayoutProperty(currentHeatmapLayerId, 'visibility', 'visible');
            // Then set opacity
            map.setPaintProperty(currentHeatmapLayerId, 'fill-opacity', 0.9);
            // eslint-disable-next-line no-console
            console.log('Showed original layer immediately - visibility and opacity set');
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Error showing original layer:', e);
          }
        }
      } else if (heatLayer.type === 'circle') {
        updates.push(() => {
          try {
            map.setPaintProperty(heatmapLayerId, 'circle-color', colorRamp);
            map.setPaintProperty(heatmapLayerId, 'circle-opacity', 0.9);
            map.setPaintProperty(heatmapLayerId, 'circle-radius', 6);
            
            // Add 3D extrusion for circles if in 3D mode
            if (is3DMode) {
              // eslint-disable-next-line no-unused-vars
              const extrusionHeight = [
                'interpolate',
                ['linear'],
                rawValue,
                0, 0,
                maxRange, 50 // Max height in meters for circles
              ];
              
              map.setPaintProperty(heatmapLayerId, 'circle-stroke-width', 2);
              map.setPaintProperty(heatmapLayerId, 'circle-stroke-color', '#fff');
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Error setting circle properties:', e);
          }
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
    
    // Update click handlers when mode or range changes
    const updateClickHandlers = () => {
      const currentHeatmapLayerId = 'clalit-accessibility-heatmap-new';
      
      // Remove existing handlers
      map.off('click', currentHeatmapLayerId);
      map.off('mouseenter', currentHeatmapLayerId);
      map.off('mouseleave', currentHeatmapLayerId);
      
      // Remove any existing popups
      const existingPopups = document.querySelectorAll('.mapboxgl-popup');
      existingPopups.forEach(popup => popup.remove());
      
      // No need to create Mapbox popup - we'll use custom popup
      
      // Add click handler for heatmap
      map.on('click', currentHeatmapLayerId, (e) => {
        const features = e.features;
        if (features && features.length > 0) {
          const feature = features[0];
          const properties = feature.properties;
          
          // Get current mode and range to show the right value
          const column = `${mode}_${rangeMin}min`;
          const value = properties[column];
          
          if (value !== null && value !== undefined) {
            const minutes = Math.round(value);
            const density = properties.density || 0;
            
            // Remove any existing custom popup
            const existingPopup = document.querySelector('.custom-heatmap-popup');
            if (existingPopup) {
              existingPopup.remove();
            }
            
            // Convert lngLat to pixel coordinates
            const point = map.project(e.lngLat);
            
            // Create custom popup element
            const popupElement = document.createElement('div');
            popupElement.className = 'custom-heatmap-popup';
            popupElement.style.cssText = `
              position: absolute;
              left: ${point.x}px;
              top: ${point.y - 60}px;
              transform: translateX(-50%);
              background: rgba(255, 255, 255, 0.25);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border: 1px solid rgba(255, 255, 255, 0.3);
              border-radius: 28px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.05);
              padding: 24px 28px;
              font-size: 14px;
              font-weight: 700;
              color: #333;
              text-align: center;
              min-width: 200px;
              max-width: 300px;
              z-index: 1000;
              pointer-events: none;
              user-select: none;
            `;
            popupElement.innerHTML = `
              <div style="font-size: 14px; margin-bottom: 4px;">${Math.round(density)} people</div>
              <div style="font-size: 14px;">${minutes} min to closest clinic</div>
            `;
            
            // Add to map container
            const mapContainer = map.getContainer();
            mapContainer.appendChild(popupElement);
            
            // Remove popup after 3 seconds
            setTimeout(() => {
              if (popupElement && popupElement.parentNode) {
                popupElement.remove();
              }
            }, 3000);
          }
        }
      });
      
      // Add cursor pointer on hover
      map.on('mouseenter', currentHeatmapLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', currentHeatmapLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
    };
    
    // Update click handlers
    updateClickHandlers();
    
    // eslint-disable-next-line no-console
    console.log('=== HEATMAP useEffect COMPLETED ===', { mode, rangeMin, is3DMode });
  }, [mode, rangeMin, mapLoaded, is3DMode]);

  // Show map when loaded (only on first load)
  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded) {
      map.getContainer().style.visibility = 'visible';
      // eslint-disable-next-line no-console
      console.log('Map made visible - loaded');
    }
  }, [mapLoaded]);

  // Auto-adjust range when mode changes
  useEffect(() => {
    const timeRanges = {
      walk: [10, 15],
      car: [10, 15, 20, 30],
      transit: [10, 15, 20, 30]
    };
    
    const availableRanges = timeRanges[mode] || [10, 15, 20, 30];
    
    // If current range is not available for new mode, switch to first available
    if (!availableRanges.includes(rangeMin)) {
      setRangeMin(availableRanges[0]);
    }
  }, [mode, rangeMin]);


  return (
    <div className="App">
      <div 
        ref={mapContainerRef} 
        className="map-container" 
        style={{ 
          opacity: mapLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }} 
      />
      <div className="side-panel">
        <div className="control-card">
        <h1 className="card-title">Closer to Care</h1>
        <div className="divider" />
        <div className="row">
          <div className="section-title" style={{ textAlign: 'center', marginTop: '24px' }}>
            Where are Clinics located?
            <button 
              className="info-btn"
              onMouseEnter={(e) => handleInfoHover("Toggle clinic locations on the map to see which areas are served and which are underserved", e)}
              onMouseLeave={handleInfoLeave}
            >
              ⓘ
            </button>
          </div>
          <label className="switch" aria-label="Toggle clinic layer">
            <input type="checkbox" checked={poiVisible} onChange={togglePoi} />
            <span className="slider" />
          </label>
        </div>

        <div className="divider" />

        <div className="section-title">
          Select Transport Modes
          <button 
            className="info-btn"
            onMouseEnter={(e) => handleInfoHover("Compare how walking, driving, or public transit impacts travel reach across the city", e)}
            onMouseLeave={handleInfoLeave}
          >
            ⓘ
          </button>
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

        <div className="section-title">
          Select Accessibility Range
          <button 
            className="info-btn"
            onMouseEnter={(e) => handleInfoHover("See how far people can reach in the available time ranges", e)}
            onMouseLeave={handleInfoLeave}
          >
            ⓘ
          </button>
        </div>

        <div className="ranges-row">
          {(() => {
            // Define available time ranges for each transport mode
            const timeRanges = {
              walk: [10, 15],      // Only 10 and 15 min for walking
              car: [10, 15, 20, 30],   // All ranges for car
              transit: [10, 15, 20, 30] // All ranges for transit
            };
            
            const availableRanges = timeRanges[mode] || [10, 15, 20, 30];
            
            return availableRanges.map((m) => (
              <button
                key={m}
                className={`range-btn ${rangeMin === m ? 'active' : ''}`}
                onClick={() => setRangeMin(m)}
              >
                {m} min
              </button>
            ));
          })()}
        </div>

        </div>

      </div>

      {/* Accessibility metrics by age groups - Below Closer to Care */}
      <div className="age-card-below">
        <div className="section-title">Accessibility metrics by age groups</div>
        
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
            const modeLabel = mode === 'car' ? 'Drive' : mode === 'transit' ? 'get to a Clalit Clinic by Public Transport' : mode.charAt(0).toUpperCase() + mode.slice(1);
            
            return (
              <>
                <p className="card-text" style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
                  {data.percentage}% of {ageLabel} in Be'er-Sheva can {modeLabel} in {rangeMin}min
                </p>
                <p className="card-text">
                  This means that {data.accessible.toLocaleString()} {ageLabel} in Be'er-Sheva have access, out of {data.total.toLocaleString()} {ageLabel}
                </p>
              </>
            );
          })()}
        </div>

        <div className="divider" />

        <div className="card-text" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>in collaboration with</span>
          <a 
            href="https://www.nurlab.org/" 
          target="_blank"
          rel="noopener noreferrer"
            className="nur-logo-link"
          >
            <img src={process.env.PUBLIC_URL + "/nur-logo.png"} alt="Negev Urban Research" className="age-logo" />
          </a>
        </div>
      </div>

      {/* Adaptive legend bottom-right with 3D toggle */}
      <div className="legend">
        <div className="legend-header">
          <div
            className="legend-bar"
            style={{ 
              background: is3DMode 
                ? 'linear-gradient(90deg, #3C64B4 0%, #64C896 25%, #FFFFC8 50%, #FF6432 75%, #8C1446 100%)'
                : 'linear-gradient(90deg, #3C64B4 0%, #64C896 25%, #FFFFC8 50%, #FF6432 75%, #8C1446 100%)'
            }}
          />
          <button
            className={`legend-3d-btn ${is3DMode ? 'active' : ''}`}
            onClick={toggle3D}
            title="Toggle 3D extrusion"
            style={{ 
              zIndex: 1000,
              position: 'relative',
              pointerEvents: 'auto'
            }}
          >
            <span className="legend-3d-text">3D</span>
          </button>
        </div>
        <div className="legend-labels">
          {is3DMode ? (
            <>
              <span>0 people</span>
              <span>500 people</span>
              <span>1000 people</span>
            </>
          ) : (
            <>
              <span>0 min</span>
              <span>15 min</span>
              <span>30 min</span>
            </>
          )}
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
                <h3>{(popupData.properties.name || 'Clinic Information').replace(/_/g, ' ')}</h3>
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
                    
                    // Calculate total for percentage calculation
                    const total = categories.reduce((sum, cat) => sum + (parseFloat(popupData.properties[cat]) || 0), 0);
                    
                    return categories.map((cat, index) => {
                      const value = parseFloat(popupData.properties[cat]) || 0;
                      if (value === 0) return null;
                      
                      const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                      
                      return (
                        <div key={cat} className="legend-item">
                          <div className="legend-color" style={{ backgroundColor: colors[index] }}></div>
                          <span className="legend-label">{cat} ({percentage}%)</span>
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

      {/* Info Tooltip */}
      <div 
        className="info-tooltip"
        style={{
          left: modalPosition.x + 10,
          top: modalPosition.y - 10,
          opacity: hoveredInfo ? 1 : 0,
          visibility: hoveredInfo ? 'visible' : 'hidden',
          transition: 'opacity 0.15s ease-out, visibility 0.15s ease-out',
          willChange: 'transform, opacity',
          transform: 'translateZ(0)',
        }}
      >
        <div className="info-tooltip-content">
          <p>{hoveredInfo || ''}</p>
        </div>
      </div>

    </div>
  );
}
export default App;

