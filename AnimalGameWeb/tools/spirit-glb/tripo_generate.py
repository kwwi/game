#!/usr/bin/env python3
"""Generate spirit animal GLBs via Tripo3D OpenAPI v3. Key from TRIPO_API_KEY only."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = os.environ.get("TRIPO_BASE", "https://openapi.tripo3d.ai/v3").rstrip("/")
KEY = os.environ.get("TRIPO_API_KEY", "").strip()
OUT = Path(__file__).resolve().parents[2] / "frontend" / "assets" / "models"
JOBS = Path("/tmp/tripo-spirit-jobs.json")
MODEL = os.environ.get("TRIPO_MODEL", "v2.5-20250123")

# Shared look: attacking pose, neutral jade/bone/ink metal, chess-piece scale.
_SUFFIX = (
    "eastern mythic spirit chess piece, aggressive attacking pose NOT sitting NOT resting NOT friendly, "
    "neutral low-saturation pale jade bone-grey ink-metal materials, carved scale or fur detail, "
    "subtle faint emissive edge glow accents only, NO rainbow colors NO neon, "
    "single character, clean isolated, no pedestal no base no text, "
    "compact silhouette fits 1x1x1 game-piece bounding box, PBR game asset"
)

PROMPTS = {
    "whale": (
        "stylized eastern mythic spirit whale diving forward in attack, mouth open lunging plunge, "
        "streamlined compact body, " + _SUFFIX
    ),
    "phoenix": (
        "stylized chinese eastern fenghuang phoenix, ornate crest feathers long trailing tail plumes, "
        "wings spread diving strike attack pose, NOT western firebird, " + _SUFFIX
    ),
    "dragon": (
        "stylized chinese eastern dragon, serpentine body coiled into a seated stack pose, "
        "head raised roaring mouth open angrily, horns whiskers scales, "
        "coiled sitting roar attack, NOT western winged dragon, " + _SUFFIX
    ),
    "elephant": (
        "stylized eastern mythic spirit elephant charging forward, trunk raised, "
        "front foot stomping pressure attack pose, " + _SUFFIX
    ),
    "lion": (
        "stylized eastern mythic spirit lion, ONE single head only, exactly one head one face one muzzle, "
        "NOT two heads NOT double head NOT dual heads NOT hydra, "
        "leaping forward roaring mouth open, mane flowing, pounce attack pose, " + _SUFFIX
    ),
    "tiger": (
        "stylized eastern mythic spirit tiger low crouch pounce lunging forward, "
        "jaws open hunting strike, " + _SUFFIX
    ),
    "leopard": (
        "stylized eastern mythic spirit leopard arched back sprinting pounce, "
        "claws forward mid-attack, " + _SUFFIX
    ),
    "jackal": (
        "stylized chinese dhole jackal (豺), very slender elongated body thin legs, "
        "long pointed snout, large sharp upright ears angled forward, short straight tail, short dense fur, "
        "side-profile low crouch dash attack claws reaching to tear, "
        "NOT wolf NOT dog NOT bulky, distinct from wolf silhouette, " + _SUFFIX
    ),
    "wolf": (
        "stylized thick-furred eastern wolf, ONE single head only, exactly one head one face one muzzle, "
        "NOT two heads NOT double head NOT dual heads NOT hydra, "
        "bulky shoulders raised back, heavy neck mane cheek fur, "
        "blunter muzzle, bushy curved tail, four legs planted wide, "
        "frontal leap-bite roaring attack pose, powerful bulk, "
        "NOT jackal NOT dhole NOT slender, distinct from jackal silhouette, " + _SUFFIX
    ),
    "dog": (
        "stylized eastern mythic spirit dog lunging bark-bite attack, fierce not cute, "
        "front paws forward mid-charge, NOT sitting NOT friendly, " + _SUFFIX
    ),
    "cat": (
        "stylized eastern mythic spirit cat arched back pounce claws extended, "
        "hissing attack pose, " + _SUFFIX
    ),
    "mouse": (
        "stylized eastern mythic spirit mouse lunging forward mouth open, "
        "mythic fierce not tiny curled ball, attack pounce, " + _SUFFIX
    ),
}


def headers(json_body=False):
    h = {"Authorization": f"Bearer {KEY}"}
    if json_body:
        h["Content-Type"] = "application/json"
    return h


def http_json(method, url, payload=None, timeout=120):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers(json_body=payload is not None), method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        raise RuntimeError(f"HTTP {e.code} {url}: {parsed}") from e


def create_task(prompt: str):
    # Game-friendly polycount; standard texture+PBR
    payload = {
        "prompt": prompt,
        "model": MODEL,
        "texture": True,
        "pbr": True,
        "texture_quality": "standard",
        "face_limit": 30000,
        # Max 255 chars per Tripo API
        "negative_prompt": (
            "blurry, broken mesh, multiple characters, pedestal, text, watermark, "
            "sitting, resting, friendly, cute, western dragon wings, rainbow, neon"
        ),
    }
    resp = http_json("POST", f"{BASE}/generation/text-to-model", payload)
    if resp.get("code") not in (0, None) and resp.get("code") != 0:
        # Some responses use code 0 for ok
        if "data" not in resp or not resp["data"].get("task_id"):
            raise RuntimeError(resp)
    task_id = (resp.get("data") or {}).get("task_id")
    if not task_id:
        raise RuntimeError(resp)
    return task_id


def poll(task_id: str):
    for _ in range(240):
        resp = http_json("GET", f"{BASE}/tasks/{task_id}")
        data = resp.get("data") or {}
        status = data.get("status")
        prog = data.get("progress", 0)
        print(f"  {task_id[:8]}… {status} {prog}%")
        if status == "success":
            return data
        if status in ("failed", "cancelled", "banned", "expired"):
            raise RuntimeError(data)
        time.sleep(2)
    raise TimeoutError(task_id)


def download(url: str, dest: Path):
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=300) as resp:
        dest.write_bytes(resp.read())


def main():
    if not KEY:
        print("TRIPO_API_KEY missing", file=sys.stderr)
        sys.exit(1)
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = json.loads(JOBS.read_text()) if JOBS.exists() else {}

    for name, prompt in PROMPTS.items():
        if only and name not in only:
            continue
        meta = jobs.get(name) or {}
        if meta.get("downloaded"):
            print("skip", name)
            continue
        if not meta.get("task_id"):
            print("submit", name)
            try:
                tid = create_task(prompt)
            except Exception as e:
                print("SUBMIT FAIL", name, e)
                jobs[name] = {"failed": True, "error": str(e)}
                JOBS.write_text(json.dumps(jobs, indent=2))
                # Stop early on credit errors
                if "2010" in str(e) or "credit" in str(e).lower():
                    print("Stopping: insufficient Tripo credits. Top up then re-run.")
                    sys.exit(2)
                continue
            jobs[name] = {"task_id": tid, "downloaded": False}
            JOBS.write_text(json.dumps(jobs, indent=2))
            time.sleep(0.5)

        tid = jobs[name]["task_id"]
        print("poll", name, tid)
        try:
            data = poll(tid)
            url = (data.get("output") or {}).get("model_url")
            if not url:
                raise RuntimeError(f"no model_url: {data}")
            dest = OUT / f"{name}.glb"
            # Backup current Tripo asset before overwrite
            bak = OUT / f"{name}.tripo.bak.glb"
            if dest.exists():
                dest.replace(bak)
            print("download", name)
            download(url, dest)
            # Keep a convenient copy alongside
            (OUT / f"{name}.tripo.glb").write_bytes(dest.read_bytes())
            jobs[name]["downloaded"] = True
            jobs[name]["bytes"] = dest.stat().st_size
            JOBS.write_text(json.dumps(jobs, indent=2))
            print("saved", dest, dest.stat().st_size)
        except Exception as e:
            print("FAIL", name, e)
            jobs[name]["failed"] = True
            jobs[name]["error"] = str(e)
            JOBS.write_text(json.dumps(jobs, indent=2))

    ok = [n for n, m in jobs.items() if m.get("downloaded")]
    fail = [n for n, m in jobs.items() if m.get("failed")]
    print(json.dumps({"ok": ok, "fail": fail}, indent=2))


if __name__ == "__main__":
    main()
