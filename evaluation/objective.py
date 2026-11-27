import cv2
import numpy as np


def smoothness(ref, pred):

    def profile(f):
        pts, energy = (f['pts'], f['energy'])
        duration = f['meta']['duration']
        dt = np.diff(pts)
        if not len(dt):
            return (np.zeros(12), np.ones(12), 0.0, 1.0)
        pos = (pts[:-1] + pts[1:]) / (2 * duration)
        edges = np.minimum(11, (pos * 12).astype(int))
        weight = np.bincount(edges, weights=dt, minlength=12)
        speed = np.bincount(edges, weights=energy, minlength=12) / np.maximum(weight, duration / 48)
        frozen = np.bincount(edges, weights=(energy < 0.012) * dt, minlength=12) / np.maximum(weight, 1e-08)
        frozen = np.where(weight > 0, frozen, 1.0)
        irregular = float(np.sum(np.maximum(0, dt - 1.5 * np.median(dt))) / duration)
        variation = float(np.abs(np.diff(speed)).mean())
        return (speed, frozen, variation, irregular)
    sr, fr, vr, ir = profile(ref)
    sp, fp, vp, ip = profile(pred)

    def blur(x):
        return np.convolve(np.pad(x, 1, mode='edge'), [0.25, 0.5, 0.25], mode='valid')
    sr, sp, fr, fp = map(blur, (sr, sp, fr, fp))
    activity = float(np.mean(np.abs(sr - sp) / (sr + sp + 0.15)))
    freeze = float(np.mean(np.maximum(fp - fr, 0) * np.minimum(sr / 0.15, 1)))
    burst = float(max(0, vp - vr) / (vr + vp + 0.2))
    duration = min(ref['meta']['duration'], pred['meta']['duration']) / max(ref['meta']['duration'], pred['meta']['duration'])
    effective = lambda f: f['meta']['frames'] / f['meta']['duration']
    cadence = min(1, effective(pred) / effective(ref)) * np.exp(-3 * max(0, ip - ir))
    active = sr > 0.1
    if active.any():
        moving_ref = max(0.001, np.mean(1 - fr[active]))
        retained = min(1, float(np.mean(1 - fp[active]) / moving_ref))
    else:
        retained = 1.0
    ref_flicker = ref['native']['flicker']
    pred_flicker = pred['native']['flicker']
    flicker = max(0, pred_flicker - ref_flicker) / (0.025 + pred_flicker + ref_flicker)
    flash = max(0, pred['native']['global_flash'] - ref['native']['global_flash'] - 0.005)
    quality = 100 * np.exp(-2.5 * flash) * (1 - 0.35 * activity - 0.2 * freeze - 0.1 * burst - 0.15 * (1 - cadence) - 0.2 * flicker) * (0.45 + 0.55 * retained) * duration ** 0.25
    return dict(smooth=float(np.clip(quality, 0, 100)), motion_profile_error=activity, excess_freeze=freeze, excess_burst=burst, excess_global_flash=flash, excess_flicker=flicker, cadence_ratio=float(cadence), duration_ratio=duration, motion_retained=retained)


def local_similarity(a, b):
    if np.array_equal(a, b):
        same = np.ones(a.shape[:2], dtype=np.float32)
        return (same, same)
    x = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    y = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    blur = lambda z: cv2.GaussianBlur(z, (7, 7), 1.4)
    mx, my = (blur(x), blur(y))
    vx = np.maximum(0, blur(x * x) - mx * mx)
    vy = np.maximum(0, blur(y * y) - my * my)
    cov = blur(x * y) - mx * my
    ssim = (2 * mx * my + 0.0001) * (2 * cov + 0.0009) / ((mx * mx + my * my + 0.0001) * (vx + vy + 0.0009))
    color = np.mean(cv2.absdiff(a, b), axis=2) / 255
    return (np.clip(ssim, 0, 1), 0.75 * np.clip(ssim, 0, 1) + 0.25 * np.exp(-5 * color))


def measure(b, g, p):
    sums = np.zeros(10)
    for src, ref, pred in zip(b['frames'], g['frames'], p['frames']):
        mask = cv2.absdiff(src, ref).max(axis=2) > 16
        mask = cv2.dilate(mask.astype('uint8'), np.ones((3, 3), np.uint8)).astype(bool)
        y = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
        edges = cv2.morphologyEx(y, cv2.MORPH_GRADIENT, np.ones((5, 5), np.uint8)).astype(float) / 255
        attention = 0.025 + edges
        ssim, match = local_similarity(ref, pred)
        _, preserve = local_similarity(src, pred) if b is not g else (ssim, match)
        if b is not g:
            _, expected = local_similarity(src, ref)
            preserve = 1 - np.maximum(0, expected - preserve)
        stable = ~mask * attention
        err_out = cv2.absdiff(ref, pred).mean(axis=2) / 255
        err_base = cv2.absdiff(src, ref).mean(axis=2) / 255
        sums += [ssim.mean(), (stable * preserve).sum(), stable.sum(), match[mask].sum(), mask.sum(), err_out[mask].sum(), err_base[mask].sum(), mask.size, match.mean(), cv2.absdiff(src, pred).mean(axis=2)[mask].sum() / 255]
    n = len(g['frames'])
    ar = lambda f: f['meta']['width'] / f['meta']['height']
    aspect = min(ar(g), ar(p)) / max(ar(g), ar(p))
    has_mask = sums[4] > 0 and sums[6] > 0.01
    return dict(gt_ssim=100 * sums[0] / n, gt_visual=100 * sums[8] / n, gt_roi=100 * sums[3] / sums[4] if has_mask else None, edit_gain=100 * max(0, 1 - sums[5] / sums[6]) if has_mask else None, fidelity=100 * aspect * sums[1] / sums[2] if sums[2] else None, source_change_ratio=sums[9] / sums[6] if has_mask else None, roi_fraction=sums[4] / sums[7], aspect_ratio_match=aspect, **smoothness(g, p))
