from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path("/Users/rolandtalkonmini/Documents/Crabie Go Home")
SOURCE_PATH = Path("/Users/rolandtalkonmini/Downloads/Crabbie.png")
ASSET_DIR = ROOT / "assets"
SPRITE_PATH = ASSET_DIR / "crabbie-top.png"
SHEET_PATH = ASSET_DIR / "crabbie-spritesheet.png"
SOURCE_CLEAN_PATH = ASSET_DIR / "crabbie-source-clean.png"


def largest_component(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    best = []

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue

            queue = deque([(x, y)])
            visited[y, x] = True
            component = []

            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))

                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((nx, ny))

            if len(component) > len(best):
                best = component

    output = np.zeros_like(mask, dtype=bool)
    for x, y in best:
        output[y, x] = True
    return output


def fill_holes(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    inverse = ~mask
    reachable = np.zeros_like(mask, dtype=bool)
    queue = deque()

    for x in range(width):
        if inverse[0, x]:
            queue.append((x, 0))
            reachable[0, x] = True
        if inverse[height - 1, x] and not reachable[height - 1, x]:
            queue.append((x, height - 1))
            reachable[height - 1, x] = True

    for y in range(height):
        if inverse[y, 0] and not reachable[y, 0]:
            queue.append((0, y))
            reachable[y, 0] = True
        if inverse[y, width - 1] and not reachable[y, width - 1]:
            queue.append((width - 1, y))
            reachable[y, width - 1] = True

    while queue:
        cx, cy = queue.popleft()
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if 0 <= nx < width and 0 <= ny < height and inverse[ny, nx] and not reachable[ny, nx]:
                reachable[ny, nx] = True
                queue.append((nx, ny))

    holes = inverse & ~reachable
    return mask | holes


def build_mask(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]

    # Crabbie is warm orange while the background is mostly grayscale.
    warm_mask = (r > 110) & ((r - g) > 8) & ((g - b) > 4)
    warm_mask = largest_component(warm_mask)
    warm_mask = fill_holes(warm_mask)

    mask_image = Image.fromarray((warm_mask.astype(np.uint8) * 255), mode="L")
    mask_image = mask_image.filter(ImageFilter.MaxFilter(5))
    mask_image = mask_image.filter(ImageFilter.MinFilter(3))
    mask_image = mask_image.filter(ImageFilter.GaussianBlur(1.2))
    return mask_image


def cut_out_sprite(image: Image.Image) -> Image.Image:
    mask = build_mask(image)
    rgba = image.convert("RGBA")
    rgba.putalpha(mask)

    bbox = rgba.getbbox()
    if not bbox:
        raise ValueError("Could not isolate Crabbie from the source image")

    cropped = rgba.crop(bbox)
    cropped.load()
    return cropped


def stylize_sprite(sprite: Image.Image, frame_size=128) -> Image.Image:
    sprite = sprite.copy()
    sprite.thumbnail((frame_size - 18, frame_size - 18), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    x = (frame_size - sprite.width) // 2
    y = (frame_size - sprite.height) // 2 - 2

    alpha = sprite.getchannel("A")
    outline_mask = alpha.filter(ImageFilter.MaxFilter(7))
    outline = Image.new("RGBA", sprite.size, (88, 53, 30, 255))
    canvas.paste(outline, (x, y), outline_mask)

    shadow = Image.new("RGBA", sprite.size, (18, 31, 38, 105))
    shadow_mask = alpha.filter(ImageFilter.GaussianBlur(5))
    canvas.paste(shadow, (x + 5, y + 8), shadow_mask)

    sprite_layer = sprite.copy()
    highlight = Image.new("RGBA", sprite.size, (255, 235, 214, 22))
    sprite_layer.alpha_composite(highlight)
    canvas.alpha_composite(sprite_layer, (x, y))
    return canvas


def create_sheet(base_sprite: Image.Image):
    frame_size = base_sprite.width
    directions = [
        ("up", 0),
        ("right", -90),
        ("down", 180),
        ("left", 90),
    ]

    sheet = Image.new("RGBA", (frame_size * len(directions), frame_size), (0, 0, 0, 0))
    frames = {}

    for index, (name, angle) in enumerate(directions):
        frame = base_sprite.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)
        frames[name] = frame
        sheet.alpha_composite(frame, (index * frame_size, 0))

    return frames, sheet


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)

    source = Image.open(SOURCE_PATH).convert("RGBA")
    clean = cut_out_sprite(source)
    styled = stylize_sprite(clean)
    frames, sheet = create_sheet(styled)

    clean.save(SOURCE_CLEAN_PATH)
    styled.save(SPRITE_PATH)
    sheet.save(SHEET_PATH)

    for name, frame in frames.items():
        frame.save(ASSET_DIR / f"crabbie-{name}.png")

    print(f"Saved {SOURCE_CLEAN_PATH}")
    print(f"Saved {SPRITE_PATH}")
    print(f"Saved {SHEET_PATH}")


if __name__ == "__main__":
    main()
