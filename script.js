// start the map around the Middle East
console.log('Script starting...');
// make zoom feel smoother (not huge jumps)
const map = L.map('map', {
    zoomSnap: 0.25,      // lets zoom move in quarter steps
    zoomDelta: 0.5,      // how much each zoom button click changes zoom
    wheelPxPerZoomLevel: 120, // makes mouse-wheel zoom less jumpy
    attributionControl: false,
    minZoom: 5,
    maxZoom: 10
}).setView([27, 49], 5);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 20
}).addTo(map);

// load local data and the country shapes
let countryData = {};
let geoData = null;
let hoveredCountry = null;

fetch('data.json')
    .then(response => response.json())
    .then(data => {
        countryData = data;
        console.log('Data loaded successfully:', countryData);
        // Use 50m because it includes the small islands too.
        return fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson');
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('GeoJSON request failed: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        geoData = data;
        console.log('GeoJSON loaded successfully, feature count:', geoData.features ? geoData.features.length : 'N/A');
        initializeMap();
    })
    .catch(error => {
        console.error('Error loading data:', error);
        alert('Error loading data. Please make sure data.json is in the same folder as index.html');
    });

function initializeMap() {
    const US_GEO_NAME = 'United States of America';
    const US_DATA_NAME = 'United States';
    const HOVER_FILL_COLOR = '#A01C40';
    const US_LABEL_OFFSET = { x: -15, y: -12 };
    let selectedCountryLayer = null;
    let selectedCountryName = null;
    let usInsetLayer = null;

    function getPolygonCenter(polygonCoords) {
        const outerRing = polygonCoords && polygonCoords[0] ? polygonCoords[0] : [];
        if (!outerRing.length) {
            return null;
        }

        let sumLng = 0;
        let sumLat = 0;
        outerRing.forEach(point => {
            sumLng += point[0];
            sumLat += point[1];
        });

        return {
            lng: sumLng / outerRing.length,
            lat: sumLat / outerRing.length
        };
    }

    function isContiguousUsPolygon(polygonCoords) {
        const center = getPolygonCenter(polygonCoords);
        if (!center) return false;
        return center.lat >= 24 && center.lat <= 50 && center.lng >= -125 && center.lng <= -66;
    }

    function getCountryFillColor(countryName) {
        return countryData[countryName] ? countryData[countryName].color : 'gray';
    }

    const countries = {
        'Iran': {
            lat: 32.4279,
            lng: 53.6880,
            bounds: [[25, 44], [40, 61]]
        },
        'Saudi Arabia': {
            lat: 23.8859,
            lng: 45.0792,
            bounds: [[16, 34], [32, 56]]
        },
        'UAE': {
            lat: 23.4241,
            lng: 53.8478,
            bounds: [[22.5, 51], [26.5, 56.5]]
        },
        'Kuwait': {
            lat: 29.3117,
            lng: 47.4818,
            bounds: [[28.5, 46.5], [30.2, 48.5]]
        },
        'Qatar': {
            lat: 24.9,  
            lng: 51.1839,
            bounds: [[24.5, 50.5], [26.2, 52]]
        },
        'Bahrain': {
            lat: 26.2,  
            lng: 50.5577,
            bounds: [[26, 50.2], [26.5, 50.8]],
            labelOffset: { x: -10, y: -16 }
        },
        'Oman': {
            lat: 21.4735,
            lng: 55.9754,
            bounds: [[16, 51], [26.5, 60]],
            labelOffset: { x: 18, y: 0 }
        },
        'Jordan': {
            lat: 30.5852,
            lng: 36.2384,
            bounds: [[29, 34.5], [32.5, 39.5]]
        },
        'Israel': {
            lat: 31.9454,
            lng: 35.2338,
            bounds: [[29, 34], [33.5, 36]]
        },
        'Lebanon': {
            lat: 33.8547,
            lng: 35.8623,
            bounds: [[33, 35], [34.5, 36.5]]
        },
        'Iraq': {
            lat: 33.2232,
            lng: 43.6793,
            bounds: [[29, 38], [38, 48]]
        }
    };

    // keep people from dragging way off the region
    const allCountryBounds = Object.values(countries).map(country => country.bounds);
    const south = Math.min(...allCountryBounds.map(bound => bound[0][0]));
    const west = Math.min(...allCountryBounds.map(bound => bound[0][1]));
    const north = Math.max(...allCountryBounds.map(bound => bound[1][0]));
    const east = Math.max(...allCountryBounds.map(bound => bound[1][1]));
    const mobileAtLoad = window.innerWidth <= 768;
    if (mobileAtLoad) {
        map.setMinZoom(4);
    }
    const regionBounds = L.latLngBounds([south, west], [north, east]).pad(0.2);
    map.setMaxBounds(mobileAtLoad ? regionBounds.pad(0.3) : regionBounds);
    map.options.maxBoundsViscosity = 1.0;
    map.fitBounds(regionBounds, {
        paddingTopLeft: [20, 20],
        paddingBottomRight: mobileAtLoad ? [20, 120] : [260, 20]
    });
    const initialZoom = map.getZoom() - (mobileAtLoad ? 1.25 : 0.15);
    map.setZoom(Math.max(map.getMinZoom(), initialZoom));

    // quick mobile check based on screen width
    function isMobile() {
        return window.innerWidth <= 768;
    }

    function clearMobileSelection() {
        if (selectedCountryLayer && selectedCountryName) {
            selectedCountryLayer.setStyle({ fillColor: getCountryFillColor(selectedCountryName) });
        }
        selectedCountryLayer = null;
        selectedCountryName = null;
    }

    function setMobileSelection(countryName, layer) {
        clearMobileSelection();
        selectedCountryLayer = layer;
        selectedCountryName = countryName;
        layer.setStyle({ fillColor: HOVER_FILL_COLOR });
    }

    function createFixedUsInset() {
        if (!geoData || !geoData.features) return;

        const sourceUsFeature = geoData.features.find(f => f.properties.NAME === US_GEO_NAME);
        if (!sourceUsFeature) return;

        const usFeature = JSON.parse(JSON.stringify(sourceUsFeature));
        if (usFeature.geometry.type === 'MultiPolygon') {
            usFeature.geometry.coordinates = usFeature.geometry.coordinates.filter(isContiguousUsPolygon);
        }
        usFeature.properties.NAME = US_DATA_NAME;

        const usControl = L.control({ position: 'bottomleft' });
        usControl.onAdd = function() {
            const wrapper = L.DomUtil.create('div', 'us-fixed-wrap');
            wrapper.innerHTML = '<div class="us-fixed-map"></div>';
            L.DomEvent.disableClickPropagation(wrapper);
            L.DomEvent.disableScrollPropagation(wrapper);
            return wrapper;
        };
        usControl.addTo(map);

        const usMapContainer = document.querySelector('.us-fixed-map');
        if (!usMapContainer) return;

        const usMap = L.map(usMapContainer, {
            attributionControl: false,
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false,
            tap: false
        });

        const usLayer = L.geoJSON(usFeature, {
            style: function() {
                const color = getCountryFillColor(US_DATA_NAME);
                return {
                    color: 'black',
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 1
                };
            },
            onEachFeature: function(feature, layer) {
                const countryName = feature.properties.NAME;
                if (countryName === US_DATA_NAME) {
                    usInsetLayer = layer;
                }
                layer.on('mouseover', function() {
                    if (isMobile()) return;
                    hoveredCountry = countryName;
                    layer.setStyle({ fillColor: HOVER_FILL_COLOR });
                    showPopup(countryName);
                    const rect = usMapContainer.getBoundingClientRect();
                    updatePopupPositionXY(rect.left + rect.width / 2, rect.top + rect.height / 2);
                });
                layer.on('mouseout', function() {
                    if (hoveredCountry === countryName) {
                        hoveredCountry = null;
                        const orig = getCountryFillColor(countryName);
                        if (orig) {
                            layer.setStyle({ fillColor: orig });
                        }
                        closePopup();
                    }
                });
                layer.on('click', function() {
                    if (isMobile()) {
                        setMobileSelection(countryName, layer);
                        showMobileInfo(countryName);
                    } else {
                        showPopup(countryName);
                        const rect = usMapContainer.getBoundingClientRect();
                        updatePopupPositionXY(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    }
                });
            }
        }).addTo(usMap);

        if (isMobile() && usInsetLayer) {
            setMobileSelection(US_DATA_NAME, usInsetLayer);
            showMobileInfo(US_DATA_NAME);
        }

        const usBounds = usLayer.getBounds();
        if (usBounds.isValid()) {
            setTimeout(function() {
                usMap.invalidateSize();
                usMap.fitBounds(usBounds, { padding: [2, 2] });
                usMap.setZoom(usMap.getZoom() + 0.4);

                L.tooltip({
                    permanent: true,
                    direction: 'center',
                    className: 'us-inset-label',
                    offset: L.point(US_LABEL_OFFSET.x, US_LABEL_OFFSET.y)
                })
                    .setContent('United States')
                    .setLatLng(usBounds.getCenter())
                    .addTo(usMap);
            }, 0);
        }
    }

    Object.keys(countries).forEach(countryName => {
        const position = countries[countryName];
        const labelOffset = position.labelOffset || { x: 0, y: 0 };

        // add country name label
        L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'country-label',
            offset: L.point(labelOffset.x, labelOffset.y)
        })
            .setContent(countryName)
            .setLatLng([position.lat, position.lng])
            .addTo(map);
    });
    // draw geojson layers so hover/click matches real borders
    if (geoData) {
        const ourNames = ['Iran', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'Israel', 'Lebanon', 'Iraq'];
        console.log('Filtering geoJSON for ourNames, count', ourNames.length);
        const filteredFeatures = geoData.features.filter(f => ourNames.includes(f.properties.NAME));
        // log any expected country names we didn't find
        const foundNames = filteredFeatures.map(f => f.properties.NAME);
        const expectedNames = ourNames;
        const missing = expectedNames.filter(n => !foundNames.includes(n));
        if (missing.length) {
            console.warn('The following expected countries were not found in GeoJSON:', missing);
        }

        L.geoJSON(filteredFeatures, {
            style: function(feature) {
                const countryName = feature.properties.NAME;
                const color = getCountryFillColor(countryName);
                return {
                    color: 'white',
                    weight: 1.5,
                    fillColor: color,
                    fillOpacity: 1
                };
            },
            onEachFeature: function(feature, layer) {
                const countryName = feature.properties.NAME;
                layer.on('mouseover', function(e) {
                    // only run hover stuff on desktop/tablet
                    if (isMobile()) return;
                    hoveredCountry = countryName;
                    // use a clear highlight color on hover
                    layer.setStyle({fillColor: HOVER_FILL_COLOR});
                    showPopup(countryName);
                    updatePopupPositionFromEvent(e);
                });
                layer.on('click', function(e) {
                    // stop map click handler so it doesn't instantly close the panel
                    L.DomEvent.stopPropagation(e);
                    console.log('feature click:', countryName, 'mobile?', isMobile());
                    // mobile = bottom panel, desktop = popup card
                    if (isMobile()) {
                        setMobileSelection(countryName, layer);
                        showMobileInfo(countryName);
                    } else {
                        // use normal popup behavior on non-mobile
                        showPopup(countryName);
                        updatePopupPositionFromEvent(e);
                    }
                });
                layer.on('mousemove', function(e) {
                    if (hoveredCountry === countryName) {
                        updatePopupPositionFromEvent(e);
                    }
                });
                layer.on('mouseout', function() {
                    if (hoveredCountry === countryName) {
                        hoveredCountry = null;
                        // switch back to the original color
                        const orig = getCountryFillColor(countryName);
                        if (orig) {
                            layer.setStyle({fillColor: orig});
                        }
                        closePopup();
                    }
                });
            }
        }).addTo(map);

        createFixedUsInset();
    }

    // if user taps blank map area on mobile, close the panel
    map.on('click', function() {
        if (isMobile()) {
            clearMobileSelection();
            closePopup();
        }
    });

// helper: place popup using the current mouse/touch event
function updatePopupPositionFromEvent(e) {
    const popupCard = document.getElementById('popup-card');
    if (!popupCard) return;

    // use raw clientX/clientY from Leaflet's wrapped event
    const clientX = e.originalEvent ? e.originalEvent.clientX : e.clientX;
    const clientY = e.originalEvent ? e.originalEvent.clientY : e.clientY;

    // start popup a little away from cursor
    let left = clientX + 15;
    let top = clientY - 20;
    
    const popupWidth = popupCard.offsetWidth || 420;
    const popupHeight = popupCard.offsetHeight || 300;
    const padding = 10;

    // keep card inside the map box so it doesn't go off-screen
    const mapRect = map.getContainer().getBoundingClientRect();

    if (left + popupWidth > mapRect.right) {
        left = clientX - popupWidth - 15;
    }
    if (top + popupHeight > mapRect.bottom) {
        top = clientY - popupHeight - 15;
    }

    left = Math.max(mapRect.left + padding, Math.min(left, mapRect.right - popupWidth - padding));
    top = Math.max(mapRect.top + padding, Math.min(top, mapRect.bottom - popupHeight - padding));

    popupCard.style.position = 'fixed';
    popupCard.style.left = left + 'px';
    popupCard.style.top = top + 'px';
    popupCard.style.transform = 'none';
}

// helper: place popup with exact x/y screen coords
function updatePopupPositionXY(x, y) {
    updatePopupPositionFromEvent({originalEvent: {clientX: x, clientY: y}});
}

function formatStatValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString();
    }
    return String(value);
}

function getIranTargetsHit(data) {
    if (typeof data.targetsHit === 'number' && Number.isFinite(data.targetsHit)) {
        return data.targetsHit;
    }

    const knownAttackCounts = [data.ballisticMissiles, data.cruiseMissiles, data.drones, data.aircraft]
        .filter(value => typeof value === 'number' && value >= 0);

    if (!knownAttackCounts.length) {
        return '—';
    }

    return knownAttackCounts.reduce((sum, value) => sum + value, 0);
}

function buildStatRow(label, value, iconSrc, useAltBackground) {
    return `
        <div class="popup-content-item">
            <span class="popup-label-wrap">
                <span class="popup-icon-box${useAltBackground ? ' alt' : ''}">
                    <img class="popup-icon" src="${iconSrc}" alt="${label}">
                </span>
                <span class="popup-label">${label}</span>
            </span>
            <span class="popup-value">${formatStatValue(value)}</span>
        </div>
    `;
}

function buildCountryInfoContent(countryName, data) {
    if (countryName === 'United States') {
        return `
            <div class="popup-content-item">
                <span class="popup-value">${data.impactDescription}</span>
            </div>
            ${buildStatRow('Killed', data.killed, 'icons/Killed.png', false)}
            ${buildStatRow('Wounded', data.wounded, 'icons/Wounded.png', true)}
        `;
    }

    if (countryName === 'Iran') {
        return `
            <div class="popup-content-item">
                <span class="popup-value">${data.shortDescription}</span>
            </div>
            ${buildStatRow('Targets hit', getIranTargetsHit(data), 'icons/Warship.png', false)}
            <div class="popup-content-item">
                <span class="popup-value">${data.impactDescription}</span>
            </div>
            ${buildStatRow('Killed', data.killed, 'icons/Killed.png', false)}
            ${buildStatRow('Wounded', data.wounded, 'icons/Wounded.png', true)}
        `;
    }

    return `
        <div class="popup-content-item">
            <span class="popup-value">${data.shortDescription}</span>
        </div>
        ${buildStatRow('Ballistic missiles', data.ballisticMissiles, 'icons/Ballistic%20missiles.png', false)}
        ${buildStatRow('Cruise missiles', data.cruiseMissiles, 'icons/Cruise%20missiles.png', true)}
        ${buildStatRow('Drones', data.drones, 'icons/Drones.png', false)}
        ${buildStatRow('Fighter Jets', data.aircraft, 'icons/Fighter%20jets.png', true)}
        <div class="popup-content-item">
            <span class="popup-value">${data.impactDescription}</span>
        </div>
        ${buildStatRow('Killed', data.killed, 'icons/Killed.png', false)}
        ${buildStatRow('Wounded', data.wounded, 'icons/Wounded.png', true)}
    `;
}

// show country info in the mobile panel under the map
function showMobileInfo(countryName) {
    const data = countryData[countryName];
    const panel = document.getElementById('mobile-panel');
    const title = document.getElementById('mobile-title');
    const content = document.getElementById('mobile-content');
    if (!data || !panel || !title || !content) return;

    title.textContent = countryName;
    content.innerHTML = buildCountryInfoContent(countryName, data);
    panel.classList.add('visible');
    // scroll down to panel in case the map is tall
    panel.scrollIntoView({behavior: 'smooth'});
}

// popup card logic
function showPopup(countryName, latlng) {
    if (isMobile()) {
        // on mobile, use panel instead of hover popup
        showMobileInfo(countryName);
        return;
    }
    const data = countryData[countryName];
    const popupTitle = document.getElementById('popup-title');
    const popupContent = document.getElementById('popup-content');
    const popupCard = document.getElementById('popup-card');
    const popupOverlay = document.getElementById('popup-overlay');

    if (!data || !popupTitle || !popupContent || !popupCard) {
        console.error('Popup elements not found');
        return;
    }

    popupTitle.textContent = countryName;
    popupContent.innerHTML = buildCountryInfoContent(countryName, data);

    // always show card; position gets set by mouse/touch events
    popupCard.classList.remove('hidden');

    // keep overlay hidden for hover-style behavior
    if (popupOverlay) {
        popupOverlay.classList.remove('visible');
    }
}

function closePopup() {
    const popupCard = document.getElementById('popup-card');
    const popupOverlay = document.getElementById('popup-overlay');
    if (popupCard) {
        popupCard.classList.add('hidden');
    }
    if (popupOverlay) {
        popupOverlay.classList.remove('visible');
    }
    // also hide mobile panel
    const panel = document.getElementById('mobile-panel');
    if (panel) panel.classList.remove('visible');
    console.log('Popup closed');
}

// run this once the page is fully ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    setTimeout(function() {
        const popupCard = document.getElementById('popup-card');
        const popupOverlay = document.getElementById('popup-overlay');
        
        console.log('Popup card:', popupCard);
        console.log('Popup overlay:', popupOverlay);
        
        // keep popup open while cursor is over it
        if (popupCard) {
            popupCard.addEventListener('mouseenter', function() {
                console.log('Hovering over popup - keeping it open');
            });
            
            popupCard.addEventListener('mouseleave', function() {
                console.log('Left popup - closing');
                hoveredCountry = null;
                closePopup();
            });
        }

        console.log('Event listeners attached successfully');
    }, 100);
});

// custom CSS for map labels
const style = document.createElement('style');
style.textContent = `
    .leaflet-tooltip {
        background: transparent;
        border: none;
        font-weight: bold;
        color: #fff;
        text-shadow: black 1px 1px 2px, black -1px 1px 2px, black -1px -1px 2px, black 1px -1px 2px;
        font-size: 16px;
        box-shadow: none;
    }

    .us-fixed-wrap {
        background: #fff;
        border: 1px solid #000;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        padding: 4px;
    }

    .us-fixed-map {
        width: 230px;
        height: 145px;
        background: #fff;
    }

    .us-inset-label {
        background: transparent;
        border: none;
        font-weight: bold;
        color: #fff;
        text-shadow:black 1px 1px 2px, black -1px 1px 2px, black -1px -1px 2px, black 1px -1px 2px;
        font-size: 13px;
        box-shadow: none;
    }
`;
document.head.appendChild(style);

console.log('Middle East Map loaded. Click on any country to view details.');}
