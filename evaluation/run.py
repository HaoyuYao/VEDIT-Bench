import argparse
import importlib.metadata
import platform
import shutil
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True

from dataset import discover, import_deliveries, load, validate
from storage import implementation_hash, save_json

USAGE = '''Setup (Python 3.12 and Node.js/npm must already be installed):
  python -m venv .venv
  .venv/Scripts/python -m pip install -r requirements.txt
  npm install -g @openai/codex@0.171.0-alpha.13.2
  codex login
  .venv/Scripts/python run.py doctor

On macOS/Linux replace .venv/Scripts/python with .venv/bin/python.
Run these commands from this code folder. Keep data and run outputs outside it.
The benchmark root contains data/<domain>/<scene>/L*/instruction.txt,
eval.json and a reference MP4, plus the source MP4 at scene root or base/.
Each eval.json stores instruction, points with D/R/I string lists, and domain_validity.
Criteria are read verbatim; all preservation rules and task corrections belong in eval.json.
Candidates are <model>/<domain>/<scene>/L*/edited.mp4 or L*.mp4.
Missing candidate files score zero in AZ and are excluded from CO.
Each metric averages equally over applicable tasks. Der. is blank when inapplicable.

One-task trial with source/reference controls:
  python run.py evaluate --root ../benchmark --output ../trial --models model_a --tasks charts/01-trend/L2 --controls

All discovered models and tasks (uses authenticated CLI calls):
  python run.py evaluate --root ../benchmark --output ../evaluation_run

Freeze video bindings, optionally using an existing delivery table:
  python run.py prepare --root ../benchmark --output ../inputs.json
  python run.py prepare --root ../benchmark --delivery-table ../videos.csv --output ../inputs.json
The optional table supplies only model, task, path, delivered; scores are never read.
Supply corrected delivery paths here when prior audited videos replaced archived outputs.
Share the resulting path manifest with its referenced videos, including corrected deliveries.
  python run.py evaluate --manifest ../inputs.json --root ../benchmark --output ../evaluation_run

Repeat an interrupted command to reuse matching validated judgments.
Use a NEW output directory for an independent judge replication.
Recompute reports from this pipeline's saved point judgments, without CLI calls:
  python run.py aggregate --output ../evaluation_run

Default judge: gpt-6.1-terra, reasoning effort high, one anonymous candidate per call.
Reports contain individual 0..100 metrics, criterion scores/evidence and AZ/CO aggregates.
No historical score inputs or score intervals are used. The judge receives three anonymous
full videos and uses local tools to choose overviews, seek, inspect consecutive frames,
and enlarge/crop details. Tool traces and inspected images are retained per item.
Every D/R/I criterion requires an integer 0..4; null/insufficient_evidence is rejected.
Remaining ambiguity is described in evidence/uncertainty after targeted inspection.
CLI/tool failures stop report publication; they are not scored as missing deliveries.
Changing judge effort, prompts, evidence or model service can change fresh judgments;
saved validated judgments reproduce arithmetic, not deterministic model generations.
'''


def parser():
    result = argparse.ArgumentParser(description='Reproducible video-edit evaluation from raw videos through Codex CLI.',
                                     epilog=USAGE, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = result.add_subparsers(dest='command', required=True)
    doctor = sub.add_parser('doctor', help='Check dependencies and Codex CLI availability')
    doctor.add_argument('--codex', default='codex')
    for name in ('prepare', 'evaluate'):
        command = sub.add_parser(name, help='Export a path-only manifest' if name == 'prepare' else 'Run all evaluation stages')
        command.add_argument('--root', type=Path, help='Benchmark root containing data and model folders')
        command.add_argument('--models', nargs='+', help='Explicit registered cohort; default: discover model folders')
        command.add_argument('--tasks', nargs='+', help='Exact domain/scene/level task identifiers')
        command.add_argument('--output', required=True, type=Path)
        if name == 'prepare':
            command.add_argument('--delivery-table', type=Path, help='Optional CSV: read only model, task, path, delivered')
        else:
            command.add_argument('--manifest', type=Path)
            command.add_argument('--controls', action='store_true', help='Judge source and reference as anonymous candidates for every selected task')
            command.add_argument('--codex', default='codex', help='Codex executable name or absolute path')
            command.add_argument('--judge-model', default='gpt-6.1-terra')
            command.add_argument('--reasoning', choices=('low', 'medium', 'high', 'xhigh'), default='high')
            command.add_argument('--workers', type=int, default=2)
            command.add_argument('--timeout', type=int, default=1800, help='Seconds per autonomous video-inspection attempt')
            command.add_argument('--retries', type=int, default=1, help='Retries for invalid/failed calls; no resampling valid scores')
    command = sub.add_parser('aggregate', help='Recompute reports from saved current-run judgments')
    command.add_argument('--output', required=True, type=Path, help='Existing run directory')
    return result


def environment(executable):
    codex = shutil.which(executable)
    if codex is None:
        raise ValueError('Codex CLI was not found. Install it, add it to PATH, then run codex login.')
    process = subprocess.run([codex, '--version'], capture_output=True, encoding='utf-8', errors='replace', timeout=30, check=True)
    versions = {name: importlib.metadata.version(name) for name in ('av', 'numpy', 'opencv-python-headless')}
    return dict(codex=codex, cli_version=process.stdout.strip(), python=sys.version,
                platform=platform.platform(), dependencies=versions, implementation=implementation_hash())


def main(argv=None):
    args = parser().parse_args(argv)
    if args.command == 'doctor':
        import json
        print(json.dumps(environment(args.codex), indent=2))
        return
    package = Path(__file__).resolve().parent
    output = args.output.resolve()
    if output == package or package in output.parents:
        raise ValueError('Choose an output location outside the code folder')
    if args.command == 'aggregate':
        from engine import aggregate
        print(aggregate(output))
        return
    if args.command == 'evaluate' and args.manifest:
        manifest = load(args.manifest, args.root, args.models, args.tasks)
    else:
        if args.root is None:
            raise ValueError('--root is required without --manifest')
        manifest = discover(args.root, args.models, args.tasks)
    if args.command == 'prepare':
        if args.delivery_table:
            manifest = import_deliveries(manifest, args.delivery_table)
        validate(manifest)
        save_json(output, manifest)
        print(f'Saved path-only manifest: {output}')
        return
    if args.workers < 1 or args.timeout < 1 or args.retries < 0:
        raise ValueError('Invalid worker count, timeout or retries')
    validate(manifest)
    config = dict(environment(args.codex), judge_model=args.judge_model, reasoning=args.reasoning,
                  workers=args.workers, timeout=args.timeout, retries=args.retries, controls=args.controls)
    from engine import evaluate
    print(evaluate(manifest, output, config))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, ImportError, subprocess.SubprocessError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
