import csv
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from statistics import mean

from metrics import METRICS, missing, score
from storage import file_hash, fingerprint, read_json, save_json


def combine(rows, keys):
    groups = defaultdict(list)
    for row in rows:
        groups[tuple(row[k] for k in keys)].append(row)
    output = []
    for key, group in sorted(groups.items()):
        for population in ('AZ', 'CO'):
            selected = group if population == 'AZ' else [r for r in group if r['delivered']]
            row = dict(zip(keys, key), population=population, registered=len(group),
                       delivered=sum(r['delivered'] for r in group))
            for metric in METRICS:
                values = [r[metric] for r in selected if r[metric] is not None]
                row[metric] = mean(values) if values else None
                row[metric + '_n'] = len(values)
            output.append(row)
    return output


def tables(rows):
    overall = combine(rows, ('model',))
    for row in overall:
        row['rank'] = None if row['Score'] is None else 1 + sum(
            r['Score'] is not None and r['Score'] > row['Score'] for r in overall if r['population'] == row['population'])
    indexed = {(r['model'], r['population']): r for r in overall}
    main = []
    for model in sorted({r['model'] for r in rows}, key=lambda m: (indexed[m, 'AZ']['rank'], m)):
        a, c = indexed[model, 'AZ'], indexed[model, 'CO']
        row = dict(model=model, done=f"{a['delivered']}/{a['registered']}", AZ_rank=a['rank'], CO_rank=c['rank'])
        for label, group in [('AZ', a), ('CO', c)]:
            row.update({label + ' ' + k: f'{group[k]:.2f}' if group[k] is not None else '' for k in METRICS})
        main.append(row)
    result = {'main_7x2.csv': main, 'overall.csv': overall, 'videos.csv': rows}
    for keys in [('level',), ('domain',), ('domain', 'level')]:
        result['_'.join(keys) + '.csv'] = combine(rows, ('model', *keys))
    return result


def export(path, rows):
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def aggregate(output):
    manifest = read_json(output / 'manifest.json')
    config = read_json(output / 'run.json')
    status = read_json(output / 'status.json')
    if status['status'] == 'failed':
        raise ValueError('Run has failed items; rerun evaluate before aggregation')
    rows, controls, point_rows = [], [], []
    for entry in config['entries']:
        directory = output / 'items' / entry['id']
        result = read_json(directory / 'result.json')
        if result['binding'] != entry['binding'] or result['status'] != 'scored':
            raise ValueError(f'Incomplete or stale result: {entry["id"]}')
        row = result['row']
        if row['delivered']:
            measurement = read_json(directory / 'measurement.json')
            judgment = read_json(directory / 'judgment.json')
            spec = read_json(directory / 'rubric.json')
            from judge import validate
            validate(judgment['response'], spec)
            if measurement['binding'] != entry['binding'] or judgment['response']['status'] != 'scored' or judgment['fingerprint'] != result['judge_fingerprint']:
                raise ValueError('Unscored or mismatched evidence')
            row = dict(row, **score(judgment['response'], measurement['objective'],
                                    measurement['source_roi'], row['identical_source']))
            for category in 'DRI':
                for index, (value, evidence) in enumerate(zip(judgment['response'][category], judgment['response'][category + '_evidence'])):
                    point_rows.append(dict(model=row['model'], task=row['task'], control=entry['control'],
                                           category=category, criterion_index=index, criterion=spec['points'][category][index],
                                           points=value, score=value * 25, evidence=evidence))
        else:
            row = dict(row, **missing(result['has_derived']))
        (controls if entry['control'] else rows).append(row)
    if len(rows) != len(manifest['models']) * len(manifest['tasks']):
        raise ValueError('Cohort coverage mismatch')
    destination = output / 'reports' / config['run_id']
    for name, content in tables(rows).items():
        export(destination / name, content)
    export(destination / 'points.csv', point_rows)
    export(destination / 'controls.csv', controls)
    warnings = []
    for row in controls:
        if row['model'] == 'control_source' and row['Dir.'] >= 50:
            warnings.append(dict(task=row['task'], problem='Source control Direct >= 50'))
        if row['model'] == 'control_reference' and (row['Dir.'] < 75 or (row['Der.'] is not None and row['Der.'] < 75)):
            warnings.append(dict(task=row['task'], problem='Reference control Direct or Derived < 75'))
    save_json(destination / 'control_checks.json', warnings)
    save_json(output / 'status.json', dict(status='complete', run_id=config['run_id'], report=str(destination), control_warnings=len(warnings)))
    return destination


def evaluate(manifest, output, config):
    from judge import grade
    from media import extract, features
    from objective import measure
    from rubrics import build

    output.mkdir(parents=True, exist_ok=True)
    root = Path(manifest['root'])
    cache = output / 'media' / config['implementation'][:16]
    entries, specs = [], {}
    for task in manifest['tasks']:
        spec = build(task, root)
        specs[task['task']] = spec
        inputs = {k: file_hash(root / task[k]) for k in ('source_path', 'reference_path', 'instruction_path', 'eval_path')}
        candidates = list(task['outputs'].items())
        if config['controls']:
            candidates += [('control_source', task['source_path']), ('control_reference', task['reference_path'])]
        for model, path in candidates:
            control = model not in manifest['models']
            signature = file_hash(root / path) if path else None
            binding = fingerprint(dict(inputs=inputs, candidate=signature, rubric=spec,
                                       implementation=config['implementation'], model=config['judge_model'], reasoning=config['reasoning'],
                                       cli_version=config['cli_version']))
            identity = fingerprint([model, task['task'], control])[:24]
            entries.append(dict(id=identity, binding=binding, model=model, task=task['task'], path=path,
                                sha256=signature, control=control, inputs=inputs))
    config = dict(config, entries=entries)
    config['run_id'] = fingerprint(dict(entries=entries, implementation=config['implementation']))[:24]
    save_json(output / 'manifest.json', manifest)
    save_json(output / 'run.json', config)
    save_json(output / 'status.json', dict(status='running', run_id=config['run_id']))
    task_map = {t['task']: t for t in manifest['tasks']}
    prepared, failures = {}, []

    def work(entry, row, objective, source_roi, videos, directory):
        spec = specs[entry['task']]
        judgment = grade(spec, videos, directory / 'judgment.json', config)
        if judgment['response']['status'] != 'scored':
            raise ValueError(f'Insufficient visual evidence: {entry["model"]}/{entry["task"]}; inspect judgment.json')
        row.update(score(judgment['response'], objective, source_roi, row['identical_source']))
        save_json(directory / 'result.json', dict(status='scored', binding=entry['binding'], row=row,
                  judge_fingerprint=judgment['fingerprint'], has_derived=bool(spec['points']['R'])))
        return entry['model'] + '/' + entry['task']

    with ThreadPoolExecutor(max_workers=config['workers']) as pool:
        futures = {}
        for index, entry in enumerate(entries, 1):
            task = task_map[entry['task']]
            directory = output / 'items' / entry['id']
            directory.mkdir(parents=True, exist_ok=True)
            spec = specs[entry['task']]
            save_json(directory / 'rubric.json', spec)
            row = dict(model=entry['model'], domain=task['domain'], level=task['level'], task=task['task'],
                       path=entry['path'], source_path=task['source_path'], reference_path=task['reference_path'],
                       delivered=entry['path'] is not None, sha256=entry['sha256'], identical_source=False)
            if entry['path'] is None:
                row.update(missing(bool(spec['points']['R'])))
                save_json(directory / 'result.json', dict(status='scored', binding=entry['binding'], row=row, has_derived=bool(spec['points']['R'])))
                continue
            try:
                if task['task'] not in prepared:
                    source = extract(root / task['source_path'], cache)
                    reference = extract(root / task['reference_path'], cache)
                    b, g = features(source), features(reference)
                    baseline = measure(b, g, b)
                    prepared[task['task']] = (source, reference, baseline['gt_roi'])
                source, reference, source_roi = prepared[task['task']]
                candidate = extract(root / entry['path'], cache)
                b, g, p = features(source), features(reference), features(candidate)
                if p['meta']['sha256'] != entry['sha256'] or b['meta']['sha256'] != entry['inputs']['source_path'] or g['meta']['sha256'] != entry['inputs']['reference_path']:
                    raise ValueError('Video changed after binding')
                objective = measure(b, g, p)
                row['identical_source'] = b['native']['decoded_sha256'] == p['native']['decoded_sha256']
                save_json(directory / 'measurement.json', dict(binding=entry['binding'], objective=objective,
                          source_roi=source_roi, source=b['meta'], reference=g['meta'], candidate=p['meta'],
                          identical_source=row['identical_source']))
                videos = [root / task['source_path'], root / task['reference_path'], root / entry['path']]
                future = pool.submit(work, entry, row, objective, source_roi, videos, directory)
                futures[future] = entry
                print(f'Prepared {index}/{len(entries)}: {entry["model"]}/{task["task"]}', flush=True)
            except Exception as error:
                failures.append(dict(id=entry['id'], error=str(error)))
        for number, future in enumerate(as_completed(futures), 1):
            try:
                print(f'Judged {number}/{len(futures)}: {future.result()}', flush=True)
            except Exception as error:
                failures.append(dict(id=futures[future]['id'], error=str(error)))
                print(f'Failed: {error}', flush=True)
    if failures:
        save_json(output / 'status.json', dict(status='failed', run_id=config['run_id'], failures=failures))
        raise RuntimeError(f'{len(failures)} items failed; no current report published. Inspect status.json.')
    return aggregate(output)
