#!/usr/bin/env python3
"""Offline hash/manifest verification for a PRIVATE, full Supabase CLI export.
Does not connect to a database, decrypt anything or send data over the network.
An integrity pass is NOT a successful actual database restore.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

FILES = ('roles.sql', 'schema.sql', 'data.sql')
MANIFEST = 'backup-manifest.json'
FORMAT = 'content-center-full-export-v1'


def checked_file(folder: Path, name: str) -> Path:
    if name not in FILES:
        raise ValueError('Unexpected file name')
    p = folder / name
    if p.is_symlink() or not p.is_file():
        raise ValueError(f'Backup component missing, not a file, or symlink: {name}')
    if p.stat().st_size <= 0:
        raise ValueError(f'Empty backup component: {name}')
    return p


def fingerprint(p: Path) -> dict:
    h = hashlib.sha256()
    size = 0
    with p.open('rb') as f:
        while block := f.read(1024 * 1024):
            size += len(block)
            h.update(block)
    return {'bytes': size, 'sha256': h.hexdigest()}


def create(folder: Path, project: str) -> dict:
    if not re.fullmatch(r'[a-z0-9]{20}', project):
        raise ValueError('Source project ref must be a 20-character Supabase ref')
    manifest_path = folder / MANIFEST
    if manifest_path.exists() or manifest_path.is_symlink():
        raise ValueError('Manifest exists. Do not overwrite a prior backup attestation.')
    files = {n: fingerprint(checked_file(folder, n)) for n in FILES}
    data = {'format': FORMAT, 'project_ref': project,
            'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
            'files': files, 'disclaimer': 'Checksum only; full restore NOT verified'}
    temp = folder / (MANIFEST + '.temporary')
    if temp.exists() or temp.is_symlink():
        raise ValueError('Temporary manifest already exists')
    try:
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write('\n')
        os.replace(temp, manifest_path)
    finally:
        if temp.exists():
            temp.unlink()
    return data


def verify(folder: Path, project: str | None = None) -> dict:
    f = folder / MANIFEST
    if f.is_symlink() or not f.is_file():
        raise ValueError('Missing or symlinked manifest')
    manifest = json.loads(f.read_text(encoding='utf-8'))
    if manifest.get('format') != FORMAT:
        raise ValueError('Invalid backup manifest format')
    ref = manifest.get('project_ref')
    if not isinstance(ref, str) or not re.fullmatch(r'[a-z0-9]{20}', ref):
        raise ValueError('Invalid project ref in manifest')
    if project is not None and ref != project:
        raise ValueError("Wrong project: cannot verify another project's backup")
    files = manifest.get('files')
    if not isinstance(files, dict) or set(files) != set(FILES):
        raise ValueError('Backup must contain exactly roles.sql, schema.sql and data.sql')
    for n in FILES:
        if files[n] != fingerprint(checked_file(folder, n)):
            raise ValueError(f'Checksum/length mismatch: {n}')
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('create', 'verify'))
    parser.add_argument('--directory', required=True, type=Path)
    parser.add_argument('--project-ref', help='Production project ref; required for create')
    args = parser.parse_args()
    try:
        if not args.directory.is_dir() or args.directory.is_symlink():
            raise ValueError('Backup directory is missing or a symlink')
        if args.action == 'create':
            if not args.project_ref:
                raise ValueError('--project-ref required for create')
            data = create(args.directory, args.project_ref)
        else:
            data = verify(args.directory, args.project_ref)
        print('OK: OFFLINE checksum only; project=' + data['project_ref'] +
              '; components=' + str(len(data['files'])) +
              '; this does NOT prove a full Supabase restore')
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print('BACKUP INTEGRITY FAILED: ' + str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
