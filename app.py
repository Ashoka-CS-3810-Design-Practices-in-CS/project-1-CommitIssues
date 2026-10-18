import os

from flask import Flask, jsonify, request, render_template

from network import DATA_PATH, Network
from routing import fastest_route


def create_app(data_path=DATA_PATH):
    app = Flask(__name__)

    try:
        network = Network.load(data_path)
    except (OSError, ValueError, TypeError) as error:
        app.logger.error("Cannot load metro data: %s", error)
        network = None

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.before_request
    def check_network():
        if request.path.startswith("/api/") and network is None:
            return jsonify(
                error="Metro data could not be loaded. Restore data/network.json and restart the app."
            ), 503

    @app.get("/api/network")
    def network_data():
        return jsonify(network.data)

    @app.post("/api/route")
    def route():
        body = request.get_json(silent=True)

        if not isinstance(body, dict):
            return jsonify(
                error="Send a starting station and destination as JSON."
            ), 400

        try:
            result = fastest_route(
                network,
                body.get("source"),
                body.get("destination"),
            )
        except ValueError as error:
            return jsonify(error=str(error)), 400

        if result is None:
            return jsonify(
                error="No route connects these stations in this network. Try another pair."
            ), 404

        return jsonify(result)

    return app


if __name__ == "__main__":
    create_app().run(
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "5000")),
    )
