#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.4", "opencv-python-headless==5.0.0.93", "pillow==13.0.0"]
# ///
"""Generate motion-compensated return-to-idle frames, without editing source art.

Run: uv run desktop/tools/generate_idle_transitions.py [--preview-dir PATH]
Only regeneration needs Python/OpenCV; Godot plays the checked-in PNGs normally.
DIS estimates correspondence in both directions; inverse remapping moves both
images to the same intermediate pose before interpolating premultiplied RGBA.
https://docs.opencv.org/5.0/main_modules/classcv_1_1DISOpticalFlow.html
https://docs.opencv.org/4.13.0/da/d54/group__imgproc__transform.html
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

DESKTOP = Path(__file__).resolve().parents[1]
SPRITES = DESKTOP / "assets/sprites"
OUTPUT = SPRITES / "shubao-idle-return"
STEPS = 8
FPS = 45.0
FLOW_RESOLUTION = 2


def read_rgba(path: Path) -> np.ndarray:
    pixels = np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32) / 255.0
    pixels[..., :3] *= pixels[..., 3:]
    return pixels


def to_image(pixels: np.ndarray) -> Image.Image:
    pixels = pixels.copy()
    pixels[..., :3] /= np.maximum(pixels[..., 3:], 1e-6)
    pixels[pixels[..., 3] < 1 / 255] = 0
    return Image.fromarray(np.rint(np.clip(pixels, 0, 1) * 255).astype(np.uint8))


def grid_for(image: np.ndarray) -> np.ndarray:
    y, x = np.mgrid[: image.shape[0], : image.shape[1]].astype(np.float32)
    return np.dstack((x, y))


def align_action(pixels: np.ndarray, scale: tuple[float, float], offset_y: float) -> np.ndarray:
    # Godot scales about the texture center, with pixel centers at x + 0.5.
    grid = grid_for(pixels)
    center = np.array([pixels.shape[1], pixels.shape[0]], dtype=np.float32) / 2
    mapping = (grid + 0.5 - center - [0, -offset_y]) / scale + center - 0.5
    return cv2.remap(pixels, mapping.astype(np.float32), None, cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT)


def flow_gray(pixels: np.ndarray) -> np.ndarray:
    # A white matte includes the silhouette in the correspondence estimate.
    matte = pixels[..., :3] + 1 - pixels[..., 3:]
    rgb = np.rint(np.clip(matte, 0, 1) * 255).astype(np.uint8)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def estimate_flow(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    size = (source.shape[1] * FLOW_RESOLUTION, source.shape[0] * FLOW_RESOLUTION)
    a = cv2.resize(flow_gray(source), size, interpolation=cv2.INTER_LINEAR)
    b = cv2.resize(flow_gray(target), size, interpolation=cv2.INTER_LINEAR)
    estimator = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    estimator.setFinestScale(0)
    estimator.setGradientDescentIterations(64)
    estimator.setVariationalRefinementIterations(30)
    flow = estimator.calc(a, b, None)
    flow = cv2.resize(flow, (source.shape[1], source.shape[0]), interpolation=cv2.INTER_AREA)
    flow /= FLOW_RESOLUTION
    if not np.isfinite(flow).all():
        raise ValueError("Optical flow contains invalid coordinates")
    return flow


def warp(pixels: np.ndarray, flow: np.ndarray, amount: float) -> np.ndarray:
    # Solve p + amount * flow(p) = destination for the source coordinate p.
    grid = grid_for(pixels)
    mapping = grid.copy()
    for _ in range(12):
        displacement = cv2.remap(flow, mapping, None, cv2.INTER_LINEAR,
                                 borderMode=cv2.BORDER_REPLICATE)
        mapping = grid - amount * displacement
    return cv2.remap(pixels, mapping, None, cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT)


def interpolate(source: np.ndarray, target: np.ndarray) -> list[Image.Image]:
    forward = estimate_flow(source, target)
    backward = estimate_flow(target, source)
    frames = [to_image(source)]
    for step in range(1, STEPS):
        time = step / STEPS
        weight = time * time * (3 - 2 * time)
        a = warp(source, forward, weight)
        b = warp(target, backward, 1 - weight)
        frames.append(to_image(a * (1 - weight) + b * weight))
    frames.append(to_image(target))
    return frames


def source_frames() -> dict[str, Path]:
    text = (SPRITES / "shubao-walk-sprite/shubao_frames.tres").read_text()
    resources = dict(re.findall(r'path="res://([^"]+)" id="([^"]+)"', text))
    resources = {identifier: DESKTOP / path for path, identifier in resources.items()}
    result = {}
    for frames, name in re.findall(r'"frames": \[(.*?)\],\s*"loop": \d+,\s*"name": &"([^"]+)"', text, re.S):
        if name in ("idle", "jump", "wave"):
            identifier = re.findall(r'ExtResource\("([^"]+)"\)', frames)[-1]
            result[name] = resources[identifier]
    if set(result) != {"idle", "jump", "wave"}:
        raise ValueError("Could not locate idle/jump/wave source frames")
    return result


def action_alignment() -> tuple[tuple[float, float], float]:
    text = (DESKTOP / "scripts/pet.gd").read_text()
    scale = re.search(r'const ACTION_SCALE = Vector2\(([\d.]+), ([\d.]+)\)', text)
    offset = re.search(r'const ACTION_Y_OFFSET: float = ([\d.]+)', text)
    if scale is None or offset is None:
        raise ValueError("Could not read the current action alignment; update the generator")
    return (float(scale[1]), float(scale[2])), float(offset[1])


def write_resource(idle: Path) -> None:
    declarations = [f'[ext_resource type="Texture2D" path="res://{idle.relative_to(DESKTOP)}" id="idle"]']
    animations = []
    for name in ("jump", "wave"):
        identifiers = []
        for index in range(STEPS):
            path = (OUTPUT / name / f"return-{index + 1:03}.png").relative_to(DESKTOP)
            identifier = f"{name}_{index + 1:03}"
            identifiers.append(identifier)
            declarations.append(f'[ext_resource type="Texture2D" path="res://{path}" id="{identifier}"]')
        # Reuse walk001 itself at the endpoint: no final resampling/sharpness jump.
        identifiers.append("idle")
        frames = ',\n'.join('{"duration": 1.0, "texture": ExtResource("' + identifier + '")}' for identifier in identifiers)
        animations.append('{\n"frames": [\n' + frames + '\n],\n"loop": false,\n"name": &"' + name + '_return",\n"speed": ' + str(FPS) + '\n}')
    text = '[gd_resource type="SpriteFrames" format=3]\n\n' + '\n'.join(declarations)
    text += '\n\n[resource]\nanimations = [' + ', '.join(animations) + ']\n'
    (OUTPUT / "idle_returns.tres").write_text(text)


def preview(sequences: dict[str, list[Image.Image]], directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGB", (5 * 280, 2 * 292), "#f4f6fa")
    draw = ImageDraw.Draw(contact)
    for row, (name, frames) in enumerate(sequences.items()):
        for col, index in enumerate((0, 2, 4, 6, 8)):
            tile = Image.new("RGBA", frames[index].size, "#f4f6fa")
            tile.alpha_composite(frames[index])
            contact.paste(tile.convert("RGB"), (col * 280 + 12, row * 292 + 28))
            draw.text((col * 280 + 12, row * 292 + 10), f"{name}: {index * 100 // STEPS}%", fill="#192b45")
    contact.save(directory / "programmed-frames.png")
    movie = []
    indices = [0] * 16 + list(range(STEPS + 1)) + [STEPS] * 28
    for index in indices:
        image = Image.new("RGBA", (640, 320), "#f4f6fa")
        label = ImageDraw.Draw(image)
        for col, (name, frames) in enumerate(sequences.items()):
            image.alpha_composite(frames[index], (col * 320 + 32, 40))
            label.text((col * 320 + 24, 14), name + " -> walk001 (optical flow)", fill="#192b45")
        movie.append(image.convert("RGB"))
    movie[0].save(directory / "programmed-transition.gif", save_all=True,
                  append_images=movie[1:], duration=round(1000 / FPS), loop=0, disposal=2)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path)
    args = parser.parse_args()
    cv2.setNumThreads(1)
    cv2.setRNGSeed(0)
    sources = source_frames()
    scale, offset = action_alignment()
    target = read_rgba(sources["idle"])
    sequences = {}
    for name in ("jump", "wave"):
        original = read_rgba(sources[name])
        if original.shape != target.shape:
            raise ValueError("Action and idle canvases must have matching sizes")
        frames = interpolate(align_action(original, scale, offset), target)
        directory = OUTPUT / name
        directory.mkdir(parents=True, exist_ok=True)
        for index, frame in enumerate(frames[:-1]):
            frame.save(directory / f"return-{index + 1:03}.png")
        sequences[name] = frames
    write_resource(sources["idle"])
    metadata = {
        "generator": "desktop/tools/generate_idle_transitions.py",
        "method": "bidirectional DIS optical flow, inverse warping, premultiplied RGBA",
        "steps": STEPS, "fps": FPS, "duration_seconds": (STEPS + 1) / FPS,
        "action_scale": scale, "action_offset_y": -offset,
        "sources": {name: {"path": str(path.relative_to(DESKTOP)),
                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                    for name, path in sources.items()},
    }
    (OUTPUT / "generation.json").write_text(json.dumps(metadata, indent=2) + "\n")
    if args.preview_dir:
        preview(sequences, args.preview_dir)
    print(f"Generated {2 * (STEPS - 1)} intermediate frames plus 2 aligned starting frames in {OUTPUT}")


if __name__ == "__main__":
    main()
