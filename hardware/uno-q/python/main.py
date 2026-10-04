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
command_endpoint = config["api_url"].rstrip("/") + "/api/nodes/command"
token = config["ingest_token"]
session = str(uuid.uuid4())
pending = queue.Queue(maxsize=10)
inbound = queue.Queue(maxsize=1)
acks = queue.Queue(maxsize=5)
sequence = 0
last_log = 0.0
active_command = None


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


def poll_commands():
    while True:
        try:
            request = Request(command_endpoint + "?deviceId=beacon-a",
                              headers={"Authorization": "Bearer " + token})
            with urlopen(request, timeout=1) as response:
                command = json.load(response).get("command")
            if command and inbound.empty():
                command["deadline"] = time.monotonic() + min(command["ttlMs"], 5000) / 1000
                inbound.put_nowait(command)
        except queue.Full:
            pass
        except Exception:
            # A disconnected host cannot create a controller acknowledgement.
            pass
        time.sleep(0.5)


def send_acks():
    while True:
        payload = acks.get()
        try:
            for attempt in range(2):
                if time.monotonic() >= payload["deadline"]:
                    break
                try:
                    body = {"deviceId": "beacon-a", "commandId": payload["commandId"],
                            "status": payload["status"],
                            "actuatorExecuted": payload["actuatorExecuted"]}
                    request = Request(command_endpoint, data=json.dumps(body).encode(),
                                      headers={"Content-Type": "application/json",
                                               "Authorization": "Bearer " + token}, method="POST")
                    with urlopen(request, timeout=1) as response:
                        response.read()
                    break
                except Exception:
                    if attempt == 0:
                        time.sleep(0.2)
        finally:
            acks.task_done()


threading.Thread(target=poll_commands, daemon=True).start()
threading.Thread(target=send_acks, daemon=True).start()


def loop():
    global sequence, last_log, active_command
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
    try:
        command = inbound.get_nowait()
    except queue.Empty:
        command = None
    if command and not active_command:
        try:
            remaining = int((command["deadline"] - time.monotonic()) * 1000)
            if 0 < remaining <= 5000 and command["nodeId"] == "beacon-a":
                result = int(Bridge.call("aiu2_receive_guidance", command["id"],
                                         command["code"], remaining))
                if result in (1, 2):
                    active_command = command
                else:
                    acks.put_nowait({"commandId": command["id"], "status": "rejected",
                                     "actuatorExecuted": False, "deadline": command["deadline"]})
        except Exception:
            # No successful RPC means no acknowledgement. The server will retry.
            pass
    if active_command:
        try:
            if time.monotonic() >= active_command["deadline"]:
                active_command = None
            elif int(Bridge.call("aiu2_guidance_status", active_command["id"])) == 2:
                acks.put_nowait({"commandId": active_command["id"], "status": "received",
                                 "actuatorExecuted": True,
                                 "deadline": active_command["deadline"]})
                active_command = None
        except queue.Full:
            pass
        except Exception:
            # Keep waiting until expiry; receipt alone cannot prove the cue ran.
            pass
    time.sleep(max(0, 0.2 - (time.monotonic() - started)))


App.run(user_loop=loop)
