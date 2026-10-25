# Delhi Metro Route Planner

CS-3810 project by **Commit Issues**  
Maaher Bhagwagar and Dhruv Pandey

Find the fastest route between two metro stations, see the stops and
line changes, and follow the route on a map.

[Try the app](https://commit-issues-metro.onrender.com/)

Hosted on Render's free plan. The first visit after inactivity may take
about a minute to load.

## Running locally

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000.

## Tests

With the virtual environment active:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## How it works

The network is stored as an adjacency list. Each routing state represents
a station and a metro line. Ride connections link adjacent stations, while
transfer connections allow line changes.

Dijkstra's algorithm finds the route with the lowest total ride and
transfer time. The result is grouped into line sections and interchange
instructions, which are also highlighted on the map.

## Files

- `data/network.json` — stations, lines, connections and travel times.
- `network.py` — loads the data and builds the graph.
- `routing.py` — finds routes and prepares journey details.
- `app.py` — serves the page and handles network and route requests.
- `static/app.js` — station search, selections and journey display.
- `static/map.js` — map drawing, navigation and route highlighting.
- `templates/index.html` and `static/style.css` — page structure and styling.

Routing is independent of the interface. Network changes can be made in
the data file without changing the routing algorithm.

## Data

The dataset contains 253 stations. Travel times are estimates, with five
minutes added per transfer. Live schedules and disruptions are not included.

Sources are listed in [data/SOURCES.md](data/SOURCES.md).

The street-map background needs internet. When running locally, routing
and the metro network display work without it.