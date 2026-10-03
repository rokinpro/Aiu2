# Build status

Prompts 1–3 implemented: accessible interface, deterministic routing, authenticated ingestion, SQLite persistence and recent conditions.

The website uses concise map uncertainty and source attribution in the conditions panel instead of repeated demo banners. Unknown measurements remain null. Reports stay pending and cannot alter the graph.

SQLite is the chosen local adapter. Reports and preferences are isolated by anonymous browser session. Sensor events retain their original raw values, server receipt time, device, bridge session, sequence and source mode. Retries do not change freshness. No Tiger Data service or credentials are required.

Verification uses focused unit tests, production build and a brief real-HTTP/browser check. Tests using generated sensor payloads are not physical hardware verification. No USB serial board was visible during this stage. Photos now identify an Arduino UNO Q (4 GB) and HC-SR04. Next: discover the board in App Lab, confirm level-shifting parts, and implement sketch-to-Linux forwarding. See hardware/README.md.

For deployment, retain the SQLite file on persistent disk with one app instance, or intentionally migrate the storage adapter. Tiger Data is an option for shared hosted data and history at that point.
