from flask import Flask

app = Flask(__name__)


@app.get("/")
def index():
    return "<h1>Delhi Metro Route Planner</h1>"


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)