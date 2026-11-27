from statistics import mean
from math import isfinite

METRICS = ('Dir.', 'Der.', 'Inv.', 'Fid.', 'Sm.', 'GT', 'Score')


def reference_gain(roi, source_roi, gain):
    if 100 - source_roi <= 1e-6:
        return gain
    progress = max(0., min(100., 100 * (roi - source_roi) / (100 - source_roi)))
    return .5 * progress + .5 * gain


def composite(direct, derived, invariant, fidelity, smoothness, reference):
    semantic = direct if derived is None else .55 * direct + .45 * derived
    return semantic * (.75 + (.10 * invariant + .05 * fidelity + .05 * smoothness + .05 * reference) / 100)


def point_average(values):
    return 25 * mean(values) if values else None


def validate_scores(values, has_derived):
    for metric in METRICS:
        value = values[metric]
        if metric == 'Der.' and not has_derived:
            if value is not None:
                raise ValueError('Inapplicable derived metric must be null')
            continue
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f'Missing or invalid score: {metric}')
        if not isfinite(value) or not 0 <= value <= 100.000001:
            raise ValueError(f'Score outside valid range: {metric}')


def score(points, measured, source_roi, identical):
    values = dict(zip(METRICS[:5], (point_average(points['D']), point_average(points['R']),
                                    point_average(points['I']), measured['fidelity'], measured['smooth'])))
    if any(v is None for v in (measured['gt_roi'], measured['edit_gain'], source_roi)):
        raise ValueError('Reference edit region is empty; GT metric is undefined')
    values['GT'] = reference_gain(measured['gt_roi'], source_roi, measured['edit_gain'])
    values['Score'] = 0. if identical else composite(*(values[k] for k in METRICS[:-1]))
    validate_scores(values, bool(points['R']))
    return values


def missing(has_derived):
    return {k: None if k == 'Der.' and not has_derived else 0. for k in METRICS}
