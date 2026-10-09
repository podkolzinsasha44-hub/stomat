#!/usr/bin/env python3
"""Builds game-ready character assets from Microsoft Rocketbox (MIT license).

Downloads only the needed files from github.com/microsoft/Microsoft-Rocketbox via sparse checkout,
converts FBX -> glTF with FBX2glTF, recompresses textures to WebP and packs everything with
pack-avatar.mjs / pack-anims.mjs into public/models/.

Usage: python3 tools/assets/build_rocketbox.py [--work /tmp/rocketbox-work]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "models"
REPO = "https://github.com/microsoft/Microsoft-Rocketbox.git"
FBX2GLTF_URL = "https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64"

# id -> Rocketbox folder (category/name)
AVATARS = {
    "f01": "Adults/Female_Adult_01",
    "f02": "Adults/Female_Adult_02",
    "f05": "Adults/Female_Adult_05",
    "f08": "Adults/Female_Adult_08",
    "f13": "Adults/Female_Adult_13",
    "f14": "Adults/Female_Adult_14",
    "m01": "Adults/Male_Adult_01",
    "m02": "Adults/Male_Adult_02",
    "m03": "Adults/Male_Adult_03",
    "m08": "Adults/Male_Adult_08",
    "m13": "Adults/Male_Adult_13",
    "m14": "Adults/Male_Adult_14",
    "nurse": "Professions/Medical_Female_01",
}

# clip name -> file stem (without m_/f_ prefix) and motion folder
ANIMS = {
    "walk": ("walk_neutral_01", "xy"),
    "idle": ("idle_neutral_01", "static"),
    "touchFace": ("idle_touch_face_01", "static"),
    "nervous": ("idle_nervous_01", "static"),
    "talk": ("gestic_talk_neutral_01", "static"),
    "sitDown": ("sit_down_chair_01", "xyz"),
    "sitIdle": ("sit_chair_idle_neutral_01", "static"),
    "sitBreathe": ("sit_chair_breathe_01", "static"),
    "sitTouchFace": ("sit_chair_idle_touch_face", "static"),
    "standUp": ("sit_stand_up_chair_01", "xyz"),
}
FOLDER = {"xy": "all_animations_max_motextr_xy", "xyz": "all_animations_max_motextr_xyz",
          "static": "all_animations_max_motextr_static"}

TEX_SIZE = {"body": 1024, "head": 1024, "opacity": 1024}


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True, **kw)


def ensure_repo(work: Path) -> Path:
    repo = work / "rocketbox"
    if not repo.exists():
        run(["git", "clone", "--depth", "1", "--filter=blob:none", "--no-checkout", REPO, str(repo)])
        run(["git", "-C", str(repo), "sparse-checkout", "init", "--no-cone"])
    return repo


def sparse_add(repo: Path, paths):
    run(["git", "-C", str(repo), "sparse-checkout", "add", *["/" + p for p in paths]])
    run(["git", "-C", str(repo), "checkout"])


def ensure_fbx2gltf(work: Path) -> Path:
    exe = work / "FBX2glTF"
    if not exe.exists():
        urllib.request.urlretrieve(FBX2GLTF_URL, exe)
        exe.chmod(0o755)
    return exe


def morph_names(fbx: Path):
    data = fbx.read_bytes()
    return [m.decode() for m in re.findall(rb"blendShape1\.([A-Za-z0-9_]+)\x00\x01SubDeformer", data)]


def convert_textures(tex_dir: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    for tga in tex_dir.glob("*.tga"):
        m = re.match(r"[a-z]\d+_(body|head|opacity)_(color|normal|specular)", tga.stem)
        if not m or m.group(2) == "specular":
            continue
        part, kind = m.groups()
        im = Image.open(tga)
        size = TEX_SIZE[part]
        im = im.convert("RGBA" if part == "opacity" else "RGB").resize((size, size), Image.LANCZOS)
        q = 90 if kind == "normal" else 82
        im.save(out_dir / f"{part}_{kind}.webp", "WEBP", quality=q, method=6)


def build_avatar(repo, exe, work, aid, folder):
    out = OUT / f"{aid}.glb"
    if out.exists():
        print("skip", out)
        return
    name = folder.split("/")[1]
    base = f"Assets/Avatars/{folder}"
    sparse_add(repo, [f"{base}/Export/{name}_facial.fbx", f"{base}/Textures/*"])
    fbx = repo / base / "Export" / f"{name}_facial.fbx"
    tmp = work / "tmp" / aid
    tmp.mkdir(parents=True, exist_ok=True)
    run([str(exe), "--binary", "-o", str(tmp / "raw"), str(fbx)])
    names = morph_names(fbx)
    (tmp / "names.json").write_text(json.dumps(names))
    convert_textures(repo / base / "Textures", tmp / "tex")
    run(["node", str(ROOT / "tools/assets/pack-avatar.mjs"), str(tmp / "raw.glb"), str(tmp / "tex"),
         str(tmp / "names.json"), str(out)], cwd=ROOT)


def build_anims(repo, exe, work, sex):
    out = OUT / f"anims_{sex}.glb"
    if out.exists():
        print("skip", out)
        return
    paths = [f"Assets/Animations/{FOLDER[fold]}/{sex}_{stem}.max.fbx" for stem, fold in ANIMS.values()]
    sparse_add(repo, paths)
    pairs = []
    for clip, (stem, fold) in ANIMS.items():
        fbx = repo / "Assets/Animations" / FOLDER[fold] / f"{sex}_{stem}.max.fbx"
        if not fbx.exists():
            print("missing", fbx)
            continue
        dst = work / "tmp" / f"anim_{sex}_{clip}"
        run([str(exe), "--binary", "-o", str(dst), str(fbx)])
        pairs.append(f"{clip}={dst}.glb")
    run(["node", str(ROOT / "tools/assets/pack-anims.mjs"), str(out), *pairs], cwd=ROOT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="/tmp/rocketbox-work")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    repo = ensure_repo(work)
    exe = ensure_fbx2gltf(work)
    for sex in ("m", "f"):
        build_anims(repo, exe, work, sex)
    for aid, folder in AVATARS.items():
        if a.only and aid not in a.only:
            continue
        build_avatar(repo, exe, work, aid, folder)


if __name__ == "__main__":
    sys.exit(main())
