#!/usr/bin/env python3
"""Generate PNG notification icons from RConnectX brand colors."""

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit("Install Pillow: pip install pillow") from exc

PUBLIC = Path(__file__).resolve().parents[1] / "public"
PRIMARY = (124, 58, 237)  # #7C3AED
WHITE = (255, 255, 255)


def draw_sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, color: tuple[int, int, int]) -> None:
    points = []
    for i in range(8):
        angle = i * 45
        import math

        rad = math.radians(angle)
        outer = size
        inner = size * 0.38
        radius = outer if i % 2 == 0 else inner
        x = cx + radius * math.cos(rad - math.pi / 2)
        y = cy + radius * math.sin(rad - math.pi / 2)
        points.append((x, y))
    draw.polygon(points, fill=color)
    r = max(2, size // 8)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)


def make_icon(path: Path, size: int, *, badge: bool = False) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if badge:
        draw_sparkle(draw, size // 2, size // 2, size * 0.42, WHITE)
    else:
        radius = int(size * 0.21)
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=PRIMARY)
        draw_sparkle(draw, size // 2, size // 2, size * 0.28, WHITE)
    img.save(path, format="PNG")


def main() -> None:
    make_icon(PUBLIC / "rconnectx-icon.png", 192)
    make_icon(PUBLIC / "rconnectx-badge.png", 96, badge=True)
    print("Wrote", PUBLIC / "rconnectx-icon.png")
    print("Wrote", PUBLIC / "rconnectx-badge.png")


if __name__ == "__main__":
    main()
