#!/usr/bin/env python3
"""Generate spirit animal GLBs via Hyper3D Rodin API. API key from RODIN_API_KEY only."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.hyper3d.com/api/v2"
KEY = os.environ.get("RODIN_API_KEY", "").strip()
ROOT = Path(__file__).resolve().parents[2]
REFS = ROOT.parent / ".artifacts" / "spirit-refs"
# workspace path fallback
if not REFS.exists():
    REFS = Path("/Users/houyuan/Documents/animalsGame/game/.artifacts/spirit-refs")
OUT = ROOT / "frontend" / "assets" / "models"
JOBS_FILE = Path("/tmp/hyper3d-spirit-jobs.json")

SPIRITS = [
    ("whale", "whale.jpg", "fantasy spirit blue bioluminescent whale leaping from magical water, ethereal cyan glow, single game piece, clean isolated"),
    ("phoenix", "phoenix.jpg", "fantasy spirit fiery phoenix bird with long flaming tail feathers, red orange glow, single game piece, clean isolated"),
    ("dragon", "dragon.jpg", "fantasy chinese eastern dragon serpentine golden-green ethereal, coiling upward, single game piece, clean isolated"),
    ("elephant", "elephant.jpg", "fantasy spirit elephant carved of pale jade stone with tusks, warm soft glow, single game piece, clean isolated"),
    ("lion", "lion.jpg", "fantasy spirit golden lion with thick mane, solar warm glow, single game piece, clean isolated"),
    ("tiger", "tiger.jpg", "fantasy spirit orange black striped tiger in low prowling pose, warm glow, single game piece, clean isolated"),
    ("leopard", "leopard.jpg", "fantasy spirit cyan turquoise glowing leopard with spots, lithe pose, single game piece, clean isolated"),
    ("jackal", "jackal.jpg", "fantasy spirit reddish fire jackal dhole canine lean predatory, orange red glow, single game piece, clean isolated"),
    ("wolf", "wolf.jpg", "fantasy spirit silver white wolf frost aura howling or prowling, cool blue glow, single game piece, clean isolated"),
    ("dog", "dog.jpg", "fantasy spirit warm golden brown friendly dog sitting, soft glow, single game piece, clean isolated"),
    ("cat", "cat.jpg", "fantasy spirit purple mystical cat sitting, violet nebula aura, single game piece, clean isolated"),
    ("mouse", "mouse.jpg", "fantasy spirit pearlescent purple-grey mouse with large ears, soft violet glow, single game piece, clean isolated"),
]

TIER = os.environ.get("RODIN_TIER", "Gen-2.5-Low")
CONCURRENCY_SUBMIT = int(os.environ.get("RODIN_SUBMIT_N", "3"))


def auth_headers(json_body=False):
    h = {"Authorization": f"Bearer {KEY}"}
    if json_body:
        h["Content-Type"] = "application/json"
    return h


def http_json(method, url, data=None, headers=None, timeout=120):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return resp.status, json.loads(body.decode() or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        raise RuntimeError(f"HTTP {e.code} {url}: {parsed}") from e


def multipart_submit(image_path: Path, prompt: str):
    import uuid as uuidlib

    boundary = f"----Rodin{uuidlib.uuid4().hex}"
    parts = []

    def add_field(name, value):
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        parts.append(value.encode() if isinstance(value, str) else value)
        parts.append(b"\r\n")

    def add_file(name, path: Path):
        data = path.read_bytes()
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'.encode()
        )
        parts.append(b"Content-Type: image/jpeg\r\n\r\n")
        parts.append(data)
        parts.append(b"\r\n")

    add_file("images", image_path)
    add_field("prompt", prompt)
    add_field("tier", TIER)
    add_field("mesh_mode", "Raw")
    add_field("quality", "medium")
    add_field("geometry_file_format", "glb")
    add_field("material", "PBR")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    headers = auth_headers()
    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    status, resp = http_json("POST", f"{API}/rodin", data=body, headers=headers, timeout=180)
    if not resp.get("uuid"):
        raise RuntimeError(f"submit failed: {resp}")
    return resp


def check_status(subscription_key: str):
    status, resp = http_json(
        "POST",
        f"{API}/status",
        data=json.dumps({"subscription_key": subscription_key}).encode(),
        headers=auth_headers(json_body=True),
    )
    return resp


def download_list(task_uuid: str):
    status, resp = http_json(
        "POST",
        f"{API}/download",
        data=json.dumps({"task_uuid": task_uuid}).encode(),
        headers=auth_headers(json_body=True),
    )
    return resp


def fetch_url(url: str, dest: Path):
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=300) as resp:
        dest.write_bytes(resp.read())


def job_states(status_resp):
    jobs = status_resp.get("jobs") or []
    if isinstance(jobs, dict):
        # unexpected shape
        return []
    return [j.get("status") for j in jobs]


def all_done(status_resp):
    states = job_states(status_resp)
    return bool(states) and all(s == "Done" for s in states)


def any_failed(status_resp):
    return any(s == "Failed" for s in job_states(status_resp))


def load_jobs():
    if JOBS_FILE.exists():
        return json.loads(JOBS_FILE.read_text())
    return {}


def save_jobs(jobs):
    JOBS_FILE.write_text(json.dumps(jobs, indent=2))


def submit_missing(jobs: dict, only: set[str] | None = None):
    pending = []
    for name, img, prompt in SPIRITS:
        if only and name not in only:
            continue
        if name in jobs and jobs[name].get("uuid") and not jobs[name].get("failed"):
            if jobs[name].get("downloaded"):
                continue
            pending.append(name)
            continue
        img_path = REFS / img
        if not img_path.exists():
            print(f"[skip] missing ref {img_path}")
            continue
        print(f"[submit] {name} tier={TIER}")
        resp = multipart_submit(img_path, prompt)
        jobs[name] = {
            "uuid": resp["uuid"],
            "subscription_key": resp["jobs"]["subscription_key"],
            "consumed": resp.get("consumed"),
            "downloaded": False,
        }
        save_jobs(jobs)
        print(f"  uuid={resp['uuid']} consumed={resp.get('consumed')}")
        time.sleep(1.2)
    return jobs


def poll_and_download(jobs: dict, only: set[str] | None = None):
    OUT.mkdir(parents=True, exist_ok=True)
    while True:
        unfinished = []
        for name, meta in list(jobs.items()):
            if only and name not in only:
                continue
            if meta.get("downloaded") or meta.get("failed"):
                continue
            unfinished.append(name)
        if not unfinished:
            print("[done] all downloaded or failed")
            break

        print(f"[poll] waiting on {unfinished}")
        for name in unfinished:
            meta = jobs[name]
            try:
                st = check_status(meta["subscription_key"])
            except Exception as e:
                print(f"  {name} status error: {e}")
                continue
            states = job_states(st)
            print(f"  {name}: {states}")
            if any_failed(st):
                meta["failed"] = True
                meta["status"] = st
                save_jobs(jobs)
                print(f"  {name} FAILED")
                continue
            if not all_done(st):
                continue
            # download
            try:
                dl = download_list(meta["uuid"])
                files = dl.get("list") or []
                glb = next((f for f in files if str(f.get("name", "")).lower().endswith(".glb")), None)
                if not glb:
                    # sometimes zip; take first glb-like or first file
                    glb = next((f for f in files if "glb" in str(f.get("name", "")).lower()), None) or (files[0] if files else None)
                if not glb or not glb.get("url"):
                    raise RuntimeError(f"no glb in download list: {dl}")
                dest = OUT / f"{name}.glb"
                # backup old
                if dest.exists():
                    bak = OUT / f"{name}.procedural.bak.glb"
                    if not bak.exists():
                        dest.replace(bak)
                    else:
                        dest.unlink()
                print(f"  downloading {name} -> {dest}")
                fetch_url(glb["url"], dest)
                meta["downloaded"] = True
                meta["file"] = str(dest)
                meta["bytes"] = dest.stat().st_size
                save_jobs(jobs)
                print(f"  saved {dest.stat().st_size} bytes")
            except Exception as e:
                print(f"  {name} download error: {e}")
        time.sleep(8)


def main():
    if not KEY:
        print("RODIN_API_KEY missing", file=sys.stderr)
        sys.exit(1)
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    if only:
        print(f"only: {only}")
    jobs = load_jobs()
    # If dragon already submitted outside, merge
    jobs = submit_missing(jobs, only)
    save_jobs(jobs)
    poll_and_download(jobs, only)
    ok = [n for n, m in jobs.items() if m.get("downloaded")]
    fail = [n for n, m in jobs.items() if m.get("failed")]
    print(json.dumps({"ok": ok, "fail": fail, "out": str(OUT)}, indent=2))


if __name__ == "__main__":
    main()
