import pytest
import json

from app import create_app
from network import Network
from routing import fastest_route


def small_network(rides, transfers=()):
    """Each ride is (from, to, line, seconds)."""
    served = {}

    for a, b, line, _ in rides:
        for station in (a, b):
            served.setdefault(station, set()).add(line)

    return Network({
        "lines": [
            {"id": line, "name": line, "color": "#337dc1"}
            for line in sorted({ride[2] for ride in rides})
        ],
        "stations": [
            {
                "id": code,
                "name": code,
                "lat": 28.6,
                "lon": 77.2,
                "lines": sorted(lines),
            }
            for code, lines in served.items()
        ],
        "rides": [
            {"from": a, "to": b, "line": line, "seconds": seconds}
            for a, b, line, seconds in rides
        ],
        "transfers": list(transfers),
    })


@pytest.fixture(scope="module")
def network():
    return Network.load()


def test_fastest_time_is_not_fewest_stations():
    network = small_network([
        ("A", "B", "R", 120),
        ("B", "C", "R", 180),
        ("A", "C", "R", 420),
    ])

    route = fastest_route(network, "A", "C")

    assert route["station_ids"] == ["A", "B", "C"]
    assert route["seconds"] == 300
    assert route["interchanges"] == 0


@pytest.mark.parametrize("cost, expected, changes", [
    (300, 540, 1),
    (600, 600, 0),
])
def test_transfer_cost_changes_the_best_route(cost, expected, changes):
    network = small_network(
        [
            ("A", "B", "R", 120),
            ("B", "C", "G", 120),
            ("A", "C", "R", 600),
        ],
        [{
            "from": "B",
            "to": "B",
            "from_line": "R",
            "to_line": "G",
            "seconds": cost,
        }],
    )

    route = fastest_route(network, "A", "C")

    assert route["seconds"] == expected
    assert route["interchanges"] == changes
    assert sum(leg["seconds"] for leg in route["legs"]) == expected

    assert route["station_ids"] == (
        ["A", "B", "C"] if changes else ["A", "C"]
    )

    assert [
        leg["line"] for leg in route["legs"] if leg["kind"] == "ride"
    ] == (["R", "G"] if changes else ["R"])

    assert [leg["kind"] for leg in route["legs"]] == (
        ["ride", "transfer", "ride"] if changes else ["ride"]
    )


def test_boarding_and_arrival_at_interchange_are_free(network):
    assert fastest_route(network, "NDI", "SJSU")["interchanges"] == 0
    assert fastest_route(network, "SJSU", "NDI")["interchanges"] == 0


def test_same_station_is_zero_even_at_interchange(network):
    route = fastest_route(network, "KG", "KG")

    assert route["station_ids"] == ["KG"]
    assert route["seconds"] == 0
    assert route["interchanges"] == 0
    assert route["legs"] == []


def test_equal_paths_and_disconnected_network():
    network = small_network([
        ("A", "B", "R", 60),
        ("B", "D", "R", 60),
        ("A", "C", "R", 60),
        ("C", "D", "R", 60),
        ("X", "Y", "R", 60),
    ])

    route = fastest_route(network, "A", "D")

    assert route["seconds"] == 120
    assert route["station_ids"] in (
        ["A", "B", "D"],
        ["A", "C", "D"],
    )
    assert fastest_route(network, "A", "X") is None


def test_geographic_walking_transfer(network):
    route = fastest_route(network, "DKV", "DDSC")

    assert route["station_ids"] == ["DKV", "DDSC"]
    assert route["seconds"] == 300
    assert route["interchanges"] == 1

    assert route["legs"] == [{
        "kind": "transfer",
        "from": "DKV",
        "to": "DDSC",
        "from_line": "AIRPORT",
        "to_line": "PINK",
        "seconds": 300,
    }]


def test_corrected_extensions_and_loop(network):
    rides = {
        (ride["line"], frozenset((ride["from"], ride["to"])))
        for ride in network.data["rides"]
    }

    assert ("PINK", frozenset(("JGTV", "SNVR"))) in rides
    assert "SGHT" not in network.stations
    assert ("MAGENTA", frozenset(("DPC", "PTP"))) in rides
    assert ("MAGENTA", frozenset(("DPC", "KPEX"))) not in rides

    assert fastest_route(network, "DPC", "KPEX")["interchanges"] > 0

    assert fastest_route(network, "DL2", "DL3")["station_ids"] == [
        "DL2", "BEL", "GAT", "MAL", "DL3",
    ]
    assert fastest_route(network, "DL3", "DL2")["station_ids"] == [
        "DL3", "DL2",
    ]


@pytest.mark.parametrize("source,destination", [
    ("RI", "NBAA"),
    ("NDI", "APOT"),
    ("BCGN", "S55"),
    ("DPC", "KPEX"),
    ("MUPR", "MKPR"),
    ("DNBT", "VASI"),
])
def test_real_network_journeys(network, source, destination):
    route = fastest_route(network, source, destination)

    assert route is not None
    assert route["station_ids"][0] == source
    assert route["station_ids"][-1] == destination
    assert route["seconds"] > 0

    assert route["seconds"] == sum(
        leg["seconds"] for leg in route["legs"]
    )
    assert route["interchanges"] == sum(
        leg["kind"] == "transfer" for leg in route["legs"]
    )

@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


def test_page_assets_and_network(client, network):
    assert client.get("/").status_code == 200

    response = client.get("/api/network")
    assert response.status_code == 200
    assert len(response.json["stations"]) == len(network.stations)

    for path in (
        "/static/app.js",
        "/static/map.js",
        "/static/style.css",
        "/static/vendor/leaflet.js",
        "/static/vendor/leaflet.css",
    ):
        assert client.get(path).status_code == 200


def test_route_api_has_known_historical_time(client):
    response = client.post(
        "/api/route",
        json={"source": "DSG", "destination": "JLML"},
    )

    assert response.status_code == 200
    assert response.json["seconds"] == 96
    assert response.json["station_ids"] == ["DSG", "JLML"]


@pytest.mark.parametrize("body", [
    {},
    {"source": "fake", "destination": "RI"},
    {"source": ["RI"], "destination": "NDI"},
    [],
    None,
])
def test_bad_requests_remain_json_errors(client, body):
    response = client.post("/api/route", json=body)

    assert response.status_code == 400
    assert response.json["error"]


def test_malformed_json_returns_error(client):
    response = client.post(
        "/api/route",
        data="{oops",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json["error"]


def test_disconnected_route_http_response(tmp_path):
    network = small_network([
        ("A", "B", "R", 60),
        ("X", "Y", "R", 60),
    ])

    path = tmp_path / "network.json"
    path.write_text(json.dumps(network.data))

    client = create_app(path).test_client()

    response = client.post(
        "/api/route",
        json={"source": "A", "destination": "X"},
    )

    assert response.status_code == 404
    assert "No route" in response.json["error"]