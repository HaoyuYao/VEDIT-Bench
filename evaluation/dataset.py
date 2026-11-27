import csv
from pathlib import Path

from storage import read_json

LEVELS = ('L1', 'L2', 'L3')


def unique(paths, label):
    paths = sorted(set(paths))
    if len(paths) != 1:
        raise ValueError(f'Expected one {label}, found {len(paths)}: {paths}')
    return paths[0]


def discover(root, models=None, tasks=None):
    root = Path(root).resolve()
    data = root / 'data'
    if models is None:
        models = sorted(p.name for p in root.iterdir() if p.is_dir() and p != data
                        and (any(p.glob('*/*/L[123].mp4')) or any(p.glob('*/*/L[123]/edited.mp4'))))
    if not models or len(set(models)) != len(models):
        raise ValueError('Provide a nonempty, unique model list')
    if any(not (root / m).is_dir() for m in models):
        raise ValueError('A registered model directory does not exist')
    selected = set(tasks or [])
    result = []
    for instruction in sorted(data.glob('*/*/L*/instruction.txt')):
        domain, scene, level = instruction.relative_to(data).parts[:3]
        task = '/'.join((domain, scene, level))
        if level not in LEVELS or (selected and task not in selected):
            continue
        folder = instruction.parent.parent
        base = unique([*folder.glob('*.mp4'), *folder.glob('base/*.mp4')], f'source for {task}')
        gt = unique(instruction.parent.glob('*.mp4'), f'reference for {task}')
        evaluation = instruction.parent / 'eval.json'
        if not evaluation.is_file():
            raise ValueError(f'Missing evaluation criteria: {evaluation}')
        outputs = {}
        for model in models:
            directory = root / model / domain / scene
            paths = [*directory.glob(level + '.mp4'), *directory.glob(level + '/edited.mp4')]
            outputs[model] = unique(paths, f'candidate for {model}/{task}').relative_to(root).as_posix() if paths else None
        result.append(dict(task=task, domain=domain, scene=scene, level=level,
                           instruction_path=instruction.relative_to(root).as_posix(),
                           eval_path=evaluation.relative_to(root).as_posix(),
                           source_path=base.relative_to(root).as_posix(),
                           reference_path=gt.relative_to(root).as_posix(), outputs=outputs))
    if not result or selected - {t['task'] for t in result}:
        raise ValueError('No tasks found, or an explicitly selected task is missing')
    return dict(root=str(root), models=models, tasks=result)


def import_deliveries(manifest, path):
    selected = {(m, t['task']) for t in manifest['tasks'] for m in manifest['models']}
    entries = {}
    with Path(path).open(encoding='utf-8-sig', newline='') as stream:
        for row in csv.DictReader(stream):
            key = row['model'], row['task']
            if key not in selected:
                continue
            if key in entries:
                raise ValueError(f'Duplicate delivery binding: {key}')
            if row['delivered'] not in ('True', 'False'):
                raise ValueError(f'Invalid delivery flag: {key}')
            entries[key] = row['path'] if row['delivered'] == 'True' else None
    if set(entries) != selected:
        raise ValueError('Delivery table does not cover the selected cohort')
    for task in manifest['tasks']:
        task['outputs'] = {m: entries[m, task['task']] for m in manifest['models']}
    validate(manifest)
    return manifest


def validate(manifest):
    root = Path(manifest['root'])
    models = manifest['models']
    if not models or len(models) != len(set(models)):
        raise ValueError('Invalid model cohort')
    seen = set()
    for task in manifest['tasks']:
        if task['task'] in seen or set(task['outputs']) != set(models):
            raise ValueError('Duplicate task or inconsistent model cohort')
        seen.add(task['task'])
        if task['task'] != '/'.join(task[k] for k in ('domain', 'scene', 'level')):
            raise ValueError('Invalid task identity')
        paths = [task[k] for k in ('instruction_path', 'eval_path', 'source_path', 'reference_path')]
        paths += [p for p in task['outputs'].values() if p is not None]
        if any(not isinstance(p, str) or not (root / p).is_file() for p in paths):
            raise ValueError(f'A bound input is missing: {task["task"]}')
    if not seen:
        raise ValueError('Empty task cohort')


def load(path, root=None, models=None, tasks=None):
    manifest = read_json(path)
    if root is not None:
        manifest['root'] = str(Path(root).resolve())
    if models:
        if set(models) - set(manifest['models']):
            raise ValueError('Selected model absent from manifest')
        manifest['models'] = models
        for task in manifest['tasks']:
            task['outputs'] = {m: task['outputs'][m] for m in models}
    if tasks:
        if set(tasks) - {t['task'] for t in manifest['tasks']}:
            raise ValueError('Selected task absent from manifest')
        manifest['tasks'] = [t for t in manifest['tasks'] if t['task'] in tasks]
    validate(manifest)
    return manifest
