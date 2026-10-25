import {MetroMap} from './map.js';

const $ = selector => document.querySelector(selector);
const make = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};
const minutes = seconds => Math.ceil(seconds / 60);
const duration = seconds => `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ''}`;
const selection = {source: null, destination: null};
let network, stations, lines, metroMap, requestId = 0;

function status(message = '', error = false) {
  $('#status').textContent = message;
  $('#status').classList.toggle('error', error);
}

function invalidate(calculating = false) {
  requestId++; // A late response must not restore a cleared or edited journey.
  $('#find-route').disabled = calculating || !network;
  $('#find-route span').textContent = calculating ? 'Finding route…' : 'Find route';
  $('#route-form').setAttribute('aria-busy', String(calculating));
  $('#journey').hidden = true;
  $('#journey').replaceChildren();
  $('#empty-state').hidden = false;
  metroMap?.clearRoute();
  status(calculating ? 'Finding the fastest route…' : '');
}

function lineBadge(id) {
  const badge = make('span', 'line-badge', lines[id].name);
  badge.style.setProperty('--line', lines[id].color);
  return badge;
}

function attachSearch(field) {
  const input = $(`#${field}`), list = $(`#${field}-options`), wrapper = $(`#${field}-field`);
  let matches = [], active = -1;
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const choose = station => {
    invalidate();
    selection[field] = station.id;
    input.value = station.name;
    input.removeAttribute('aria-invalid');
    close();
    metroMap.setEndpoints(selection.source, selection.destination);
  };
  function show() {
    const query = input.value.trim().toLocaleLowerCase();
    matches = network.stations.filter(s => [s.name, s.id, ...(s.aliases || [])]
      .some(value => value.toLocaleLowerCase().includes(query)));
    matches.sort((a, b) => a.name.localeCompare(b.name));
    active = -1;
    list.replaceChildren();
    input.removeAttribute('aria-activedescendant');
    if (!matches.length) list.append(make('p', 'no-matches', 'No matching station. Try a name or code.'));
    matches.forEach((station, index) => {
      const option = make('button', 'suggestion');
      option.type = 'button'; option.tabIndex = -1; option.id = `${field}-option-${index}`;
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      const heading = make('span', 'suggestion-name', station.name);
      const detail = make('span', 'suggestion-detail', `${station.id} · ${station.lines.map(id => lines[id].name).join(' / ')}`);
      option.append(heading, detail);
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choose(station));
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  input.addEventListener('focus', show);
  input.addEventListener('input', () => {
    selection[field] = null;
    input.removeAttribute('aria-invalid');
    invalidate();
    metroMap.setEndpoints(selection.source, selection.destination);
    show();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Enter' && !list.hidden && active >= 0) {
      event.preventDefault(); choose(matches[active]); return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (list.hidden) show();
    if (!matches.length) return;
    active = active < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
      : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
    input.setAttribute('aria-activedescendant', `${field}-option-${active}`);
    list.children[active].scrollIntoView({block: 'nearest'});
  });
  wrapper.addEventListener('focusout', () => setTimeout(() => {
    if (!wrapper.contains(document.activeElement)) close();
  }, 0));
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
}

function showJourney(route) {
  const container = $('#journey');
  const summary = make('div', 'journey-summary');
  summary.append(make('p', 'eyebrow', 'YOUR FASTEST ROUTE'));
  const time = make('h2', 'journey-time', `${minutes(route.seconds)}`);
  time.append(make('span', '', ' min'));
  summary.append(time, make('p', 'journey-meta', `${route.station_ids.length} ${route.station_ids.length === 1 ? 'station' : 'stations'} · ${route.interchanges} ${route.interchanges === 1 ? 'interchange' : 'interchanges'}`));
  const endpoints = make('p', 'journey-endpoints', `${stations[route.source].name} → ${stations[route.destination].name}`);
  summary.append(endpoints);
  container.append(summary);
  if (!route.legs.length) container.append(make('p', 'same-station', 'You’re already at your destination. No travel needed.'));
  const itinerary = make('div', 'itinerary');
  for (const leg of route.legs) {
    if (leg.kind === 'transfer') {
      const transfer = make('div', 'transfer-step');
      const walk = leg.from !== leg.to;
      transfer.append(make('strong', '', walk ? `Walk to ${stations[leg.to].name}` : `Change at ${stations[leg.from].name}`));
      transfer.append(make('p', '', `${lines[leg.from_line].name} → ${lines[leg.to_line].name} · ${duration(leg.seconds)}`));
      itinerary.append(transfer);
      continue;
    }
    const section = make('section', 'ride-leg');
    section.style.setProperty('--line', lines[leg.line].color);
    const heading = make('div', 'leg-heading');
    heading.append(lineBadge(leg.line), make('span', 'leg-time', duration(leg.seconds)));
    const stops = make('ol', 'station-sequence');
    leg.stations.forEach((id, index) => {
      const stop = make('li', index === 0 || index === leg.stations.length - 1 ? 'leg-endpoint' : '', stations[id].name);
      stops.append(stop);
    });
    section.append(heading, stops);
    itinerary.append(section);
  }
  container.append(itinerary);
  container.append(make('p', 'estimate-note', 'Estimated time includes the line-change durations shown above. Train waiting time is excluded.'));
  container.hidden = false;
  $('#empty-state').hidden = true;
  $('.journey-area').scrollTop = 0;
  metroMap.showRoute(route);
}

$('#route-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!network || $('#find-route').disabled) return;
  const invalid = Object.keys(selection).filter(field => !selection[field]);
  if (invalid.length) {
    invalid.forEach(field => $(`#${field}`).setAttribute('aria-invalid', 'true'));
    status('Choose both stations from the suggestions before finding a route.', true);
    $(`#${invalid[0]}`).focus();
    return;
  }
  invalidate(true);
  const currentRequest = requestId;
  try {
    const response = await fetch('/api/route', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(selection)});
    const result = await response.json();
    if (currentRequest !== requestId) return;
    if (!response.ok) throw new Error(result.error || 'Could not find a route. Please try again.');
    showJourney(result);
    status(`Route ready. ${minutes(result.seconds)} minutes, ${result.interchanges} ${result.interchanges === 1 ? 'interchange' : 'interchanges'}.`);
  } catch (error) {
    if (currentRequest === requestId) status(error instanceof TypeError ? 'Cannot reach the server. Please try again.' : error.message, true);
  } finally {
    if (currentRequest === requestId) {
      $('#find-route').disabled = false;
      $('#find-route span').textContent = 'Find route';
      $('#route-form').removeAttribute('aria-busy');
    }
  }
});

$('#clear-route').addEventListener('click', () => {
  selection.source = selection.destination = null;
  for (const field of Object.keys(selection)) {
    $(`#${field}`).value = '';
    $(`#${field}`).removeAttribute('aria-invalid');
    $(`#${field}`).setAttribute('aria-expanded', 'false');
    $(`#${field}`).removeAttribute('aria-activedescendant');
    $(`#${field}-options`).hidden = true;
  }
  invalidate();
  metroMap?.setEndpoints(null, null);
  metroMap?.map.closePopup();
  metroMap?.fullView();
  if (network) status('Cleared. Ready for your next journey.');
});
$('#full-network').addEventListener('click', () => metroMap?.fullView());

async function init() {
  try {
    const response = await fetch('/api/network');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Metro data is unavailable.');
    stations = Object.fromEntries(data.stations.map(s => [s.id, s]));
    lines = Object.fromEntries(data.lines.map(l => [l.id, l]));
    metroMap = new MetroMap(data, stations, lines);
    network = data;
    for (const field of Object.keys(selection)) { attachSearch(field); $(`#${field}`).disabled = false; }
    for (const line of data.lines) $('#line-legend').append(lineBadge(line.id));
    $('#network-summary').textContent = `${data.stations.length} stations · ${data.lines.length} lines · Delhi NCR`;
    $('#find-route').disabled = $('#full-network').disabled = $('#clear-route').disabled = false;
    status();
  } catch (error) {
    status(error instanceof TypeError ? 'Cannot load the metro network. Please reload the page.' : error.message, true);
  }
}
init();