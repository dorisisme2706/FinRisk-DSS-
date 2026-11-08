"""Build a source-only handoff ZIP from this checkout without private runtime assets."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = {
    'app/backend_ml/contracts/response_examples.json',
    'app/backend_ml/fresh_process_smoke_h13.json',
    'app/backend_ml/splits/split_manifest.csv',
    'app/evidence/h13/reference-en.png',
    'app/evidence/h13/reference-vi.png',
}


def excluded(name):
    p = Path(name)
    return (name in PRIVATE or p.name.startswith('.env') or
            any(part in {'.git', '.venv', '__pycache__', 'node_modules', 'attachments', 'finrisk-data'} for part in p.parts) or
            p.suffix.lower() in {'.parquet', '.joblib', '.zip', '.7z', '.pyc', '.log', '.pem', '.key'} or
            '.7z.' in p.name or
            (name.startswith('app/evidence/') and not name.startswith('app/evidence/h13/')) or
            (p.parent.as_posix() == 'app' and p.suffix.lower() in {'.md', '.txt', '.json'}) or
            (name.startswith('app/qa/') and p.suffix.lower() == '.md'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    out = args.out.resolve()
    if out.is_relative_to(ROOT):
        raise ValueError('Output must be outside the checkout')
    paths = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\0')
    files = sorted(set(n for n in paths if n and not excluded(n) and (ROOT/n).is_file()))
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in files:
            z.write(ROOT/name, 'FinRisk_DSS_Source/'+name)
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == len(files)
        for name in files:
            assert z.read('FinRisk_DSS_Source/'+name) == (ROOT/name).read_bytes()
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    out.with_suffix('.sha256').write_text(digest+'  '+out.name+'\n')
    print(json.dumps({'files':len(files), 'sha256':digest, 'out':str(out)}))


if __name__ == '__main__':
    main()
