"""UNO Q hardware readings -> authenticated Aiu2 API through USB reverse forwarding."""
import json
import queue
import threading
import time
import uuid
from pathlib import Path
from urllib.request import Request, urlopen
from arduino.app_utils import App, Bridge

config = json.loads(Path(__file__).with_name("device-config.json").read_text())
endpoint = config["api_url"].rstrip("/") + "/api/sensors/ingest"
token = config["ingest_token"]
session = str(uuid.uuid4())
pending = queue.Queue(maxsize=10)
sequence = 0
last_log = 0.0


def send_readings():
    while True:
        captured, payload = pending.get()
        try:
            # Do not deliver an old backlog as apparently fresh physical conditions.
            for attempt in range(2):
                if time.monotonic() - captured > 2:
                    break
                try:
                    request = Request(endpoint, data=json.dumps(payload).encode(),
                                      headers={"Content-Type": "application/json",
                                               "Authorization": "Bearer " + token}, method="POST")
                    with urlopen(request, timeout=1) as response:
                        response.read()
                    break
                except Exception:
                    if attempt == 1:
                        print("Ingestion unavailable; dropping old readings and retrying next sample.", flush=True)
                    time.sleep(0.1)
        finally:
            pending.task_done()


threading.Thread(target=send_readings, daemon=True).start()


def loop():
    global sequence, last_log
    started = time.monotonic()
    try:
        duration = int(Bridge.call("aiu2_read_echo"))
        distance = round(duration * 0.0343 / 2, 1)
        valid = duration > 0 and 2 <= distance <= 400
        payload = {"deviceId": "beacon-a", "zoneId": "elevator-a-lobby",
                   "bridgeSessionId": session, "sequence": sequence,
                   "sourceMode": "hardware", "validDistance": valid,
                   "distanceCm": distance if valid else None}
        sequence += 1
        try:
            pending.put_nowait((started, payload))
        except queue.Full:
            pass
        if started - last_log >= 1:
            print(json.dumps({"distanceCm": payload["distanceCm"], "validDistance": valid,
                              "sourceMode": "hardware"}), flush=True)
            last_log = started
    except Exception:
        # A broken RPC link must not manufacture empty-space readings.
        print("Waiting for sensor sketch connection.", flush=True)
        time.sleep(1)
    time.sleep(max(0, 0.2 - (time.monotonic() - started)))


App.run(user_loop=loop)
