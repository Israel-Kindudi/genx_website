"""
Quick manual test of the /ws/live endpoint.
Run from backend dir: python -m scripts.test_ws
"""
import asyncio
import json
import websockets

async def main():
    uri = "ws://127.0.0.1:8000/ws/live"
    print(f"Connecting to {uri} ...")
    async with websockets.connect(uri) as ws:
        print("Connected. Waiting for events (Ctrl+C to stop)...")
        try:
            async for msg in ws:
                data = json.loads(msg)
                t = data.get("type")
                sid = data.get("session_id")
                ts = data.get("timestamp")
                print(f"[{t}] session={sid} ts={ts}")
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopped.")