from heapq import heappop, heappush


def fastest_route(network, source, destination):
    if any(
        not isinstance(station, str) or station not in network.stations
        for station in (source, destination)
    ):
        raise ValueError(
            "Choose a valid starting station and destination from the suggestions."
        )

    # Boarding any line at source is free
    distances = {
        (source, line): 0
        for line in network.stations[source]["lines"]
    }

    queue = []
    for state in distances:
        heappush(queue, (0, state))

    previous = {}

    while queue:
        seconds, state = heappop(queue)

        # Skip an outdated entry if a faster path was found
        if seconds != distances[state]:
            continue

        if state[0] == destination:
            edges = []

            while state in previous:
                edge = previous[state]
                edges.append(edge)
                state = edge.start

            edges.reverse()
            return _journey(source, destination, seconds, edges)

        for edge in network.graph[state]:
            candidate = seconds + edge.seconds

            if candidate < distances.get(edge.end, float("inf")):
                distances[edge.end] = candidate
                previous[edge.end] = edge
                heappush(queue, (candidate, edge.end))

    return None


def _journey(source, destination, seconds, edges):
    stations = [source]
    legs = []
    interchanges = 0

    for edge in edges:
        # Dont list same station twice for a line change
        if edge.end[0] != stations[-1]:
            stations.append(edge.end[0])

        if edge.kind == "transfer":
            interchanges += 1
            legs.append({
                "kind": "transfer",
                "from": edge.start[0],
                "to": edge.end[0],
                "from_line": edge.start[1],
                "to_line": edge.end[1],
                "seconds": edge.seconds,
            })
        else:
            # Start a ride section at boarding or after a transfer
            if not legs or legs[-1]["kind"] != "ride":
                legs.append({
                    "kind": "ride",
                    "line": edge.start[1],
                    "stations": [edge.start[0]],
                    "seconds": 0,
                })

            legs[-1]["stations"].append(edge.end[0])
            legs[-1]["seconds"] += edge.seconds

    return {
        "source": source,
        "destination": destination,
        "station_ids": stations,
        "seconds": seconds,
        "interchanges": interchanges,
        "legs": legs,
    }