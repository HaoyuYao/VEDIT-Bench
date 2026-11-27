import cv2
import numpy as np

import av

from media import read_frames, write_image
from storage import read_json


def stamp(image, role):
    header = np.full((48, image.shape[1], 3), 45, np.uint8)
    cv2.putText(header, role, (15, 33), cv2.FONT_HERSHEY_SIMPLEX, 1., (255, 255, 255), 2, cv2.LINE_AA)
    return np.vstack([header, image])


def sheets(directory, crops, output, role):
    frames = read_frames(directory)
    tiles = [tile(x, 400, 260, f'{round(i / 12 * 100)}%') for i, x in enumerate(frames)]
    tiles.extend(np.zeros_like(tiles[0]) for _ in range(3))
    timeline = np.vstack([np.hstack(tiles[i:i + 4]) for i in range(0, 16, 4)])
    patches = []
    for i, x0, y0, x1, y1 in crops:
        h, w = frames[i].shape[:2]
        patch = frames[i][round(h * y0):max(round(h * y0) + 1, round(h * y1)),
                          round(w * x0):max(round(w * x0) + 1, round(w * x1))]
        patches.append(tile(patch, 480, 250, f'{round(i / 12 * 100)}% detail'))
    detail = np.vstack([tile(frames[0], 960, 500, '0% full'), tile(frames[-1], 960, 500, '100% full'),
                        np.hstack(patches[:2]), np.hstack(patches[2:])])
    paths = []
    for name, board in [('overview', timeline), ('detail', detail)]:
        path = output / f'{role}_{name}.jpg'
        write_image(path, stamp(board, role), 95)
        paths.append(path)
    return paths


def motion_pages(path, directory, role, output, sample_count=96):
    meta = read_json(directory / 'meta.json')
    indices = set(np.rint(np.linspace(0, meta['frames'] - 1, min(sample_count, meta['frames']))).astype(int))
    cells = []
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        stream.codec_context.thread_count = 1
        for index, frame in enumerate(container.decode(stream)):
            if index in indices:
                sec = float(frame.time) if frame.time is not None else index / meta['fps']
                cells.append(tile(frame.to_ndarray(format='bgr24'), 320, 175, f'{role} {sec:.2f}s'))
    paths = []
    for page in range((len(cells) + 47) // 48):
        subset = cells[48 * page:48 * (page + 1)]
        while len(subset) % 6:
            subset.append(np.zeros_like(cells[0]))
        grid = np.vstack([np.hstack(subset[j:j + 6]) for j in range(0, len(subset), 6)])
        destination = output / f'{role}_motion_{page}.jpg'
        write_image(destination, grid, 91)
        paths.append(destination)
    return paths


def prepare(task, root, candidate, directories, output):
    crops = regions(read_frames(directories[0]), read_frames(directories[1]))
    paths = []
    for role, directory in zip(('SOURCE', 'REFERENCE', 'CANDIDATE_A'), directories):
        paths.extend(sheets(directory, crops, output, role))
    if task['domain'] == 'physics' or task['scene'] == '044_StereographicProjection':
        paths.extend(motion_pages(root / task['reference_path'], directories[1], 'REFERENCE', output))
        paths.extend(motion_pages(root / candidate, directories[2], 'CANDIDATE_A', output))
    return paths


def tile(img, w, h, label):
    scale = min(w / img.shape[1], (h - 22) / img.shape[0])
    x = cv2.resize(img, (max(1, round(img.shape[1] * scale)), max(1, round(img.shape[0] * scale))), interpolation=cv2.INTER_AREA if scale <= 1 else cv2.INTER_LINEAR)
    canvas = np.full((h, w, 3), 35, np.uint8)
    left = (w - x.shape[1]) // 2
    canvas[22:22 + x.shape[0], left:left + x.shape[1]] = x
    cv2.putText(canvas, label, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.49, (255, 255, 255), 1, cv2.LINE_AA)
    return canvas


def regions(base, gt):
    crops = []
    for group in np.array_split(np.arange(13), 4):
        best = None
        for i in group:
            g = gt[i]
            h, w = g.shape[:2]
            b = cv2.resize(base[i], (w, h))
            d = cv2.absdiff(g, b).max(axis=2).astype('float32')
            cw, ch = (max(1, w // 3), max(1, h // 3))
            for y in np.linspace(0, h - ch, 7, dtype=int):
                for x in np.linspace(0, w - cw, 7, dtype=int):
                    v = np.maximum(d[y:y + ch, x:x + cw] - 12, 0).mean()
                    if best is None or v > best[0]:
                        best = (v, i, x / w, y / h, (x + cw) / w, (y + ch) / h)
        crops.append(best[1:])
    return crops
