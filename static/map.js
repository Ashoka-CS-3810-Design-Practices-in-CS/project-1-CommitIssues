export class MetroMap {
    constructor(network, stations, lines) {
      this.stations = stations;
      this.lines = lines;
      this.map = L.map('map', {zoomControl: false, zoomSnap: 0.1, zoomDelta: 0.5, minZoom: 9, maxZoom: 17});
      L.control.zoom({position: 'bottomright'}).addTo(this.map);
      this.map.attributionControl.setPrefix(false);
      this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, opacity: 0.38,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(this.map);
      this.tiles.on('tileerror', () => { document.querySelector('#tile-status').hidden = false; });
      this.tiles.on('tileload', () => { document.querySelector('#tile-status').hidden = true; });
      this.base = L.layerGroup().addTo(this.map);
      this.highlight = L.layerGroup().addTo(this.map);
      this.endpoints = L.layerGroup().addTo(this.map);
      this.interchanges = new Set(network.transfers.flatMap(t => [t.from, t.to]));
      this.paths = network.rides.map(r => L.polyline([this.coords(r.from), this.coords(r.to)], {
        color: this.lines[r.line].color, weight: 3.5, opacity: 0.85, interactive: false
      }).addTo(this.base));
      for (const t of network.transfers.filter(t => t.from !== t.to)) {
        this.paths.push(L.polyline([this.coords(t.from), this.coords(t.to)], {
          color: '#3b514c', weight: 2.5, dashArray: '4 5', interactive: false
        }).addTo(this.base));
      }
      this.markers = network.stations.map(station => {
        const interchange = this.interchanges.has(station.id);
        const marker = L.circleMarker(this.coords(station.id), {
          radius: interchange ? 4.8 : 2.7, color: interchange ? '#253b37' : this.lines[station.lines[0]].color,
          weight: interchange ? 2 : 1.4, fillColor: '#fffdf8', fillOpacity: 1
        }).addTo(this.base);
        const popup = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = station.name;
        const detail = document.createElement('p');
        detail.textContent = `${station.id} · ${interchange ? 'Interchange' : 'Station'}`;
        const lines = document.createElement('div');
        lines.textContent = station.lines.map(id => this.lines[id].name).join(' · ');
        popup.append(name, detail, lines);
        marker.bindPopup(popup, {className: 'station-popup'});
        const label = document.createElement('span');
        label.textContent = station.name;
        marker.bindTooltip(label, {direction: 'top', className: 'station-tooltip'});
        return marker;
      });
      this.bounds = L.latLngBounds(network.stations.map(s => [s.lat, s.lon]));
      this.fullView();
      new ResizeObserver(() => this.map.invalidateSize()).observe(document.querySelector('#map'));
    }
  
    coords(id) { const s = this.stations[id]; return [s.lat, s.lon]; }
    fullView() { this.map.fitBounds(this.bounds, {padding: [28, 32], animate: false}); }
  
    setEndpoints(source, destination) {
      this.endpoints.clearLayers();
      for (const [id, label] of source && source === destination ? [[source, 'A/B']] : [[source, 'A'], [destination, 'B']]) {
        if (!id) continue;
        L.marker(this.coords(id), {
          icon: L.divIcon({className: 'endpoint', html: `<span class="endpoint-${label === 'B' ? 'b' : 'a'}">${label}</span>`, iconSize: [30, 30], iconAnchor: [15, 15]}),
          title: `${label}: ${this.stations[id].name}`, zIndexOffset: 1000
        }).addTo(this.endpoints);
      }
    }
  
    clearRoute() {
      if (!this.highlight.getLayers().length) return;
      this.highlight.clearLayers();
      this.paths.forEach(path => path.setStyle({opacity: 0.85}));
      this.markers.forEach(marker => marker.setStyle({opacity: 1, fillOpacity: 1}));
      document.querySelector('#map-caption').textContent = 'Explore the city';
    }
  
    showRoute(route) {
      this.highlight.clearLayers();
      this.map.closePopup();
      this.paths.forEach(path => path.setStyle({opacity: 0.18}));
      this.markers.forEach(marker => marker.setStyle({opacity: 0.3, fillOpacity: 0.45}));
      for (const leg of route.legs) {
        const ride = leg.kind === 'ride';
        const points = (ride ? leg.stations : [leg.from, leg.to]).map(id => this.coords(id));
        L.polyline(points, {color: '#fff', weight: 9, opacity: 0.9, interactive: false}).addTo(this.highlight);
        L.polyline(points, {color: ride ? this.lines[leg.line].color : '#253b37', weight: 5,
          dashArray: ride ? null : '5 7', interactive: false}).addTo(this.highlight);
      }
      const changes = new Set(route.legs.filter(l => l.kind === 'transfer').flatMap(l => [l.from, l.to]));
      for (const id of route.station_ids) {
        L.circleMarker(this.coords(id), {radius: changes.has(id) ? 6 : 3.3,
          color: '#253b37', weight: changes.has(id) ? 2.5 : 1.3, fillColor: '#fff', fillOpacity: 1,
          interactive: false}).addTo(this.highlight);
      }
      this.setEndpoints(route.source, route.destination);
      this.map.fitBounds(route.station_ids.map(id => this.coords(id)), {padding: [52, 62], maxZoom: 14, animate: false});
      document.querySelector('#map-caption').textContent = 'Your fastest route';
    }
  }
  