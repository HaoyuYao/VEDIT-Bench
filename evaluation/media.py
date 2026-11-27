import hashlib
import struct
from pathlib import Path

import av
import cv2
import numpy as np

from storage import file_hash, read_json, save_json

cv2.setNumThreads(1)


def read_image(path):
    image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f'Invalid image: {path}')
    return image


def write_image(path, image, quality=94):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError(f'Cannot encode image: {path}')
    encoded.tofile(path)


def extract(path, cache):
    path = Path(path)
    signature = file_hash(path)
    directory = Path(cache) / signature
    meta_path = directory / 'meta.json'
    if meta_path.exists():
        meta = read_json(meta_path)
        required = ['signals.npz', 'native.json'] + [f'{i:02}.jpg' for i in range(13)]
        if meta['sha256'] == signature and all((directory / p).is_file() for p in required):
            return directory
    directory.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    previous_delta = previous_global = None
    impulses, global_impulses = [], []
    times, small, energy = [], [], []
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        stream.codec_context.thread_count = 1
        fps = float(stream.average_rate or stream.guessed_rate or 25)
        width, height = stream.width, stream.height
        digest.update(struct.pack('!II', width, height))
        for frame in container.decode(stream):
            if frame.is_corrupt:
                raise ValueError(f'Corrupt frame: {path}')
            rgb = frame.to_ndarray(format='bgr24')
            if rgb.shape[:2] != (height, width):
                raise ValueError(f'Variable frame dimensions: {path}')
            times.append(float(frame.time) if frame.time is not None else len(times) / fps)
            digest.update(struct.pack('!q', round((times[-1] - times[0]) * 1e6)))
            digest.update(memoryview(np.ascontiguousarray(rgb)))
            thumb = cv2.resize(rgb, (256, 144), interpolation=cv2.INTER_AREA)
            if small:
                diff = cv2.absdiff(thumb, small[-1]).mean(axis=2)
                n = max(1, diff.size // 100)
                energy.append(float(np.partition(diff.ravel(), -n)[-n:].mean() / 255))
                delta = thumb.astype(np.int16) - small[-1].astype(np.int16)
                global_delta = delta.mean(axis=(0, 1))
                if previous_delta is not None:
                    round_trip = np.abs(global_delta) + np.abs(previous_global) - np.abs(global_delta + previous_global)
                    global_impulses.append(float(round_trip.max() / 510))
                    v = (np.abs(delta) + np.abs(previous_delta) - np.abs(delta + previous_delta)).max(axis=2).ravel()
                    k = max(1, len(v) // 100)
                    impulses.append(float(np.partition(v, -k)[-k:].mean() / 510))
                previous_delta, previous_global = delta, global_delta
            small.append(thumb)
        if not times or (stream.frames and len(times) != stream.frames):
            raise ValueError(f'Incomplete decode: {path}')
    pts = np.array(times) - times[0]
    step = float(np.median(np.diff(pts))) if len(pts) > 1 else 1 / fps
    if step <= 0 or np.any(np.diff(pts) <= 0):
        raise ValueError(f'Invalid presentation timestamps: {path}')
    def ids(n):
        return np.abs(pts[:, None] - np.linspace(0, pts[-1], n)).argmin(axis=0)
    np.savez_compressed(directory / 'signals.npz', frames=np.array(small)[ids(33)], pts=pts, energy=energy)
    selection = ids(13)
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        stream.codec_context.thread_count = 1
        for index, frame in enumerate(container.decode(stream)):
            matches = np.flatnonzero(selection == index)
            if not len(matches):
                continue
            img = frame.to_ndarray(format='bgr24')
            h, w = img.shape[:2]
            if w > 1120:
                img = cv2.resize(img, (1120, round(h * 1120 / w)), interpolation=cv2.INTER_AREA)
            for sample in matches:
                write_image(directory / f'{sample:02}.jpg', img)
    if file_hash(path) != signature:
        raise ValueError(f'Video changed during decoding: {path}')
    save_json(directory / 'native.json', dict(file_hash=signature, decoded_sha256=digest.hexdigest(),
              global_flash=float(np.mean(global_impulses)) if global_impulses else 0.,
              flicker=float(np.mean(impulses)) if impulses else 0.))
    save_json(meta_path, dict(sha256=signature, frames=len(pts), duration=float(pts[-1] + step),
              fps=fps, width=width, height=height, sample_seconds=pts[selection].round(5).tolist()))
    return directory


def features(directory):
    with np.load(directory / 'signals.npz') as values:
        return dict(meta=read_json(directory / 'meta.json'), native=read_json(directory / 'native.json'),
                    **{k: values[k] for k in values.files})


def read_frames(directory):
    return [read_image(directory / f'{i:02}.jpg') for i in range(13)]
