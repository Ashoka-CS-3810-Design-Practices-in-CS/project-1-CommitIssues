const source = document.querySelector('#source');
const destination = document.querySelector('#destination');
const findButton = document.querySelector('#find-route');
const clearButton = document.querySelector('#clear-route');
const status = document.querySelector('#status');
const journey = document.querySelector('#journey');

let stations;
let lines;
let requestId = 0;

function addElement(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function clearJourney() {
  requestId++;
  journey.replaceChildren();
  journey.hidden = true;
  status.textContent = '';
  findButton.disabled = false;
}

function showJourney(route) {
  journey.replaceChildren();

  addElement(
    journey,
    'h2',
    `${Math.ceil(route.seconds / 60)} minutes · ${route.interchanges} interchanges`
  );

  addElement(
    journey,
    'p',
    `${stations[route.source].name} → ${stations[route.destination].name}`
  );

  if (!route.legs.length) {
    addElement(journey, 'p', 'You are already at your destination.');
  }

  for (const leg of route.legs) {
    if (leg.kind === 'transfer') {
      const instruction = leg.from === leg.to
        ? `Change at ${stations[leg.from].name}`
        : `Walk from ${stations[leg.from].name} to ${stations[leg.to].name}`;

      const transfer = addElement(
        journey,
        'p',
        `${instruction}: ${lines[leg.from_line].name} → ${lines[leg.to_line].name}`
      );

      transfer.className = 'transfer';
    } else {
      addElement(journey, 'h3', lines[leg.line].name);

      const stops = document.createElement('ol');

      for (const id of leg.stations) {
        addElement(stops, 'li', stations[id].name);
      }

      journey.append(stops);
    }
  }

  addElement(
    journey,
    'p',
    'Estimated time includes line changes. Train waiting time is excluded.'
  );

  journey.hidden = false;
}

document.querySelector('#route-form').addEventListener('submit', async event => {
  event.preventDefault();
  clearJourney();

  const currentRequest = requestId;
  findButton.disabled = true;
  status.textContent = 'Finding route…';

  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        source: source.value,
        destination: destination.value,
      }),
    });

    const route = await response.json();

    if (currentRequest !== requestId) return;
    if (!response.ok) throw new Error(route.error);

    showJourney(route);
    status.textContent = 'Route ready.';
  } catch (error) {
    if (currentRequest === requestId) {
      status.textContent = error instanceof TypeError
        ? 'Cannot reach the local app. Check that it is running.'
        : error.message;
    }
  } finally {
    if (currentRequest === requestId) {
      findButton.disabled = false;
    }
  }
});

source.addEventListener('change', clearJourney);
destination.addEventListener('change', clearJourney);

clearButton.addEventListener('click', () => {
  source.value = '';
  destination.value = '';
  clearJourney();
});

async function init() {
  try {
    const response = await fetch('/api/network');
    const network = await response.json();

    if (!response.ok) throw new Error(network.error);

    stations = Object.fromEntries(
      network.stations.map(station => [station.id, station])
    );

    lines = Object.fromEntries(
      network.lines.map(line => [line.id, line])
    );

    const sortedStations = [...network.stations].sort(
      (a, b) => a.name.localeCompare(b.name)
    );

    for (const select of [source, destination]) {
      select.replaceChildren(new Option('Choose a station', ''));

      for (const station of sortedStations) {
        select.add(new Option(
          `${station.name} (${station.id})`,
          station.id
        ));
      }

      select.disabled = false;
    }

    findButton.disabled = false;
    clearButton.disabled = false;
    status.textContent = '';
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? 'Cannot load stations. Check the local app and reload.'
      : error.message;
  }
}

init();
