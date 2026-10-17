import json
from dataclasses import dataclass
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "network.json"


@dataclass(frozen=True)
class Edge:
    start: tuple[str, str]
    end: tuple[str, str]
    seconds: int
    kind: str


class Network:
    def __init__(self, data):
        self.data = data
        self.stations = {s["id"]: s for s in data["stations"]}
        self.graph = {(s["id"], line): [] for s in data["stations"] for line in s["lines"]}
        for ride in data["rides"]:
            self._connect((ride["from"], ride["line"]), (ride["to"], ride["line"]),
                          ride["seconds"], "ride", not ride.get("one_way", False))
        for transfer in data["transfers"]:
            self._connect((transfer["from"], transfer["from_line"]),
                          (transfer["to"], transfer["to_line"]), transfer["seconds"], "transfer")

    @classmethod
    def load(cls, path=DATA_PATH):
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def _connect(self, start, end, seconds, kind, both=True):
        self.graph[start].append(Edge(start, end, seconds, kind))
        if both:
            self.graph[end].append(Edge(end, start, seconds, kind))
