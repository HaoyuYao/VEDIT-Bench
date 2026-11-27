from storage import read_json


def build(task, root):
    spec = read_json(root / task['eval_path'])
    label = task['task']
    if not isinstance(spec, dict) or set(spec) != {'instruction', 'points', 'domain_validity'}:
        raise ValueError(f'Expected instruction, points and domain_validity in eval.json: {label}')
    for key in ('instruction', 'domain_validity'):
        if not isinstance(spec[key], str) or not spec[key].strip():
            raise ValueError(f'Invalid {key} in eval.json: {label}')
    points = spec['points']
    if not isinstance(points, dict) or set(points) != set('DRI'):
        raise ValueError(f'Expected D, R and I criterion lists in eval.json: {label}')
    for category in 'DRI':
        values = points[category]
        if not isinstance(values, list) or not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError(f'Invalid {category} criteria in eval.json: {label}')
        if category in 'DI' and not values:
            raise ValueError(f'Empty {category} criteria in eval.json: {label}')
    origins = {category: [dict(source='eval.json', category=category, index=index)
                         for index in range(len(points[category]))] for category in 'DRI'}
    return dict(spec, provenance=origins)
