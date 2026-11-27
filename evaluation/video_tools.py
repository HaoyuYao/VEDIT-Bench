"""Anonymous local video seeking tools used autonomously by the Codex judge."""
import argparse
import base64
import json
import sys
import uuid
from pathlib import Path

import av
import cv2
import numpy as np

cv2.setNumThreads(1)
ROLES = ('source', 'reference', 'candidate')


def metadata(path):
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        fps = float(stream.average_rate or stream.guessed_rate or 25)
        times = [float(frame.time) if frame.time is not None else index / fps
                 for index, frame in enumerate(container.decode(stream))]
        if not times:
            raise ValueError(f'Empty video: {path.name}')
        duration = times[-1] + (float(np.median(np.diff(times))) if len(times) > 1 else 1/fps)
        return dict(fps=fps, frames=len(times), duration=duration, timestamps=times,
                    width=stream.width, height=stream.height)


def render(path, indices, directory, role, width=640, crop=None, single=False):
    wanted = set(indices)
    cells, actual, timestamps, pages = [], [], [], []
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        stream.codec_context.thread_count = 1
        fps = float(stream.average_rate or stream.guessed_rate or 25)
        for index, frame in enumerate(container.decode(stream)):
            if index > max(wanted):
                break
            if index not in wanted:
                continue
            pixels = frame.to_ndarray(format='bgr24')
            if crop:
                h, w = pixels.shape[:2]
                x0, y0, x1, y1 = crop
                pixels = pixels[int(y0*h):max(int(y0*h)+1, int(y1*h)), int(x0*w):max(int(x0*w)+1, int(x1*w))]
            height = round(pixels.shape[0] * width / pixels.shape[1])
            pixels = cv2.resize(pixels, (width, max(1, height)), interpolation=cv2.INTER_AREA if width < pixels.shape[1] else cv2.INTER_CUBIC)
            sec = float(frame.time) if frame.time is not None else index / fps
            header = np.full((32, width, 3), 30, np.uint8)
            cv2.putText(header, f'{role} f{index} {sec:.3f}s', (6, 23), cv2.FONT_HERSHEY_SIMPLEX, .6, (255, 255, 255), 1, cv2.LINE_AA)
            cells.append(np.vstack([header, pixels]))
            actual.append(index)
            timestamps.append(sec)
    if not cells:
        raise ValueError('No frames decoded in requested interval')
    columns = 1 if single else 3
    for offset in range(0, len(cells), 18):
        batch = cells[offset:offset+18]
        while len(batch) % columns:
            batch.append(np.zeros_like(cells[0]))
        board = np.vstack([np.hstack(batch[i:i+columns]) for i in range(0, len(batch), columns)])
        destination = directory / f'{role}_{uuid.uuid4().hex[:10]}.jpg'
        ok, encoded = cv2.imencode('.jpg', board, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not ok:
            raise ValueError('Image encoding failed')
        encoded.tofile(destination)
        pages.append(str(destination.resolve()))
    return pages, actual, timestamps


def tool_list():
    role = {'type': 'string', 'enum': list(ROLES)}
    width = {'type': 'integer', 'minimum': 160, 'maximum': 3840}
    definitions = [
        ('info', 'Read metadata for all three complete anonymous videos.', {}, []),
        ('overview', 'Visually inspect a full-duration video overview. Returns images directly.',
         dict(role=role, count={'type': 'integer', 'minimum': 2, 'maximum': 192}, width=width), ['role']),
        ('frames', 'Visually inspect a chosen interval. step=1 returns every consecutive frame. Returns timestamped images directly. At most 192 frames per call.',
         dict(role=role, start={'type': 'number', 'minimum': 0}, end={'type': 'number', 'minimum': 0},
              step={'type': 'integer', 'minimum': 1}, width=width), ['role', 'start', 'end']),
        ('still', 'Inspect a large frame at a chosen time, optionally with normalized crop [x0,y0,x1,y1]. Returns the image directly.',
         dict(role=role, time={'type': 'number', 'minimum': 0}, width=width,
              crop={'type': 'array', 'items': {'type': 'number'}, 'minItems': 4, 'maxItems': 4}), ['role', 'time'])]
    return [dict(name=name, description=description,
                 annotations=dict(readOnlyHint=True, destructiveHint=False, openWorldHint=False),
                 inputSchema=dict(type='object', properties=properties, required=required, additionalProperties=False))
            for name, description, properties, required in definitions]


def serve():
    """Minimal stdio MCP server; only the three fixed local videos are accessible."""
    from contextlib import redirect_stdout
    import io
    for line in sys.stdin:
        request = json.loads(line)
        method, request_id = request.get('method'), request.get('id')
        if request_id is None:
            continue
        try:
            if method == 'initialize':
                result = dict(protocolVersion=request['params']['protocolVersion'], capabilities={'tools': {}},
                              serverInfo=dict(name='anonymous-video-inspection', version='1.0'))
            elif method == 'ping':
                result = {}
            elif method == 'tools/list':
                result = {'tools': tool_list()}
            elif method == 'tools/call':
                params = request['params']
                name, arguments = params['name'], params.get('arguments', {})
                definitions = {tool['name']: tool['inputSchema'] for tool in tool_list()}
                if name not in definitions or set(arguments) - set(definitions[name]['properties']):
                    raise ValueError('Unknown tool or argument')
                argv = [name]
                if name != 'info':
                    argv.append(arguments['role'])
                    for key, value in arguments.items():
                        if key != 'role':
                            argv += ['--' + key] + ([str(x) for x in value] if isinstance(value, list) else [str(value)])
                captured = io.StringIO()
                with redirect_stdout(captured):
                    main(argv)
                record = json.loads(captured.getvalue())
                content = [dict(type='text', text=json.dumps(record))]
                for path in record.get('images', []):
                    content.append(dict(type='image', mimeType='image/jpeg',
                                        data=base64.b64encode(Path(path).read_bytes()).decode('ascii')))
                result = dict(content=content, isError=False)
            else:
                raise ValueError('Unsupported method: ' + str(method))
            response = dict(jsonrpc='2.0', id=request_id, result=result)
        except (Exception, SystemExit) as error:
            if method == 'tools/call':
                response = dict(jsonrpc='2.0', id=request_id,
                                result=dict(content=[dict(type='text', text=str(error))], isError=True))
            else:
                response = dict(jsonrpc='2.0', id=request_id, error=dict(code=-32603, message=str(error)))
        print(json.dumps(response), flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    sub.add_parser('info')
    for mode in ('overview', 'frames', 'still'):
        command = sub.add_parser(mode)
        command.add_argument('role', choices=ROLES)
        command.add_argument('--width', type=int, default=640 if mode != 'still' else 1600)
        if mode == 'overview':
            command.add_argument('--count', type=int, default=24)
        elif mode == 'frames':
            command.add_argument('--start', type=float, required=True)
            command.add_argument('--end', type=float, required=True)
            command.add_argument('--step', type=int, default=1)
        else:
            command.add_argument('--time', type=float, required=True)
            command.add_argument('--crop', nargs=4, type=float)
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parent
    cache = root / 'metadata.json'
    all_meta = json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else {}
    for role in ROLES if args.mode == 'info' else (args.role,):
        if role not in all_meta:
            all_meta[role] = metadata(root / f'{role}.mp4')
    cache.write_text(json.dumps(all_meta), encoding='utf-8')
    if args.mode == 'info':
        print(json.dumps({role: {k: v for k, v in value.items() if k != 'timestamps'} for role, value in all_meta.items()}))
        return
    meta = all_meta[args.role]
    times = np.array(meta['timestamps'])
    if not 160 <= args.width <= 3840:
        parser.error('width must be 160..3840')
    step = None
    if args.mode == 'overview':
        if not 2 <= args.count <= 192:
            parser.error('count must be 2..192')
        targets = np.linspace(times[0], times[-1], min(args.count, meta['frames']))
        indices = sorted(set(np.abs(times[:, None] - targets).argmin(axis=0).tolist()))
    elif args.mode == 'frames':
        if args.step < 1 or not 0 <= args.start < args.end <= meta['duration'] + 1/meta['fps']:
            parser.error('require 0 <= start < end <= duration and step >= 1')
        first = max(0, int(np.searchsorted(times, args.start, side='right'))-1)
        last = min(meta['frames']-1, int(np.searchsorted(times, args.end)))
        indices = list(range(first, last+1, args.step))
        if len(indices) > 192:
            parser.error('at most 192 frames per command; use shorter consecutive intervals or larger step')
        step = args.step
    else:
        if not 0 <= args.time <= meta['duration']:
            parser.error('time must be inside the video')
        if args.crop and not (0 <= args.crop[0] < args.crop[2] <= 1 and 0 <= args.crop[1] < args.crop[3] <= 1):
            parser.error('crop requires normalized x0 y0 x1 y1 inside 0..1')
        indices = [int(np.abs(times - args.time).argmin())]
    directory = root / 'views'
    directory.mkdir(exist_ok=True)
    pages, actual, timestamps = render(root / f'{args.role}.mp4', indices, directory, args.role,
                                       args.width, getattr(args, 'crop', None), args.mode == 'still')
    record = dict(role=args.role, mode=args.mode, step=step, frames=actual, timestamps=timestamps,
                  images=pages, width=args.width, crop=getattr(args, 'crop', None))
    with (root / 'inspection.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(record) + '\n')
    print(json.dumps(record))


if __name__ == '__main__':
    if sys.argv[1:] == ['--mcp']:
        serve()
    else:
        main()
