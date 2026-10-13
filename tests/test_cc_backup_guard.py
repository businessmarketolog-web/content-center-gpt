"""Offline backup integrity tests with fictional SQL only. No DB credentials or network."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'tools' / 'cc_backup_guard.py'
SPEC = importlib.util.spec_from_file_location('cc_backup_guard', SOURCE)
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)
PROJECT = 'a' * 20


class OfflineBackupGuardTests(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)
        self.dir = Path(self.work.name)
        for name in guard.FILES:
            (self.dir / name).write_text('-- fictional ' + name + '\n', encoding='utf-8')

    def create(self):
        return guard.create(self.dir, PROJECT)

    def test_valid_complete_export_roundtrip(self):
        created = self.create()
        verified = guard.verify(self.dir, PROJECT)
        self.assertEqual(verified, created)
        self.assertEqual(len(verified['files']), 3)

    def test_missing_sql_file_is_rejected(self):
        (self.dir / 'data.sql').unlink()
        with self.assertRaisesRegex(ValueError, 'missing'):
            self.create()

    def test_empty_sql_is_rejected(self):
        (self.dir / 'roles.sql').write_bytes(b'')
        with self.assertRaisesRegex(ValueError, 'Empty'):
            self.create()

    def test_modified_export_fails_checksum_verification(self):
        self.create()
        (self.dir / 'data.sql').write_text('-- attacker tampered with export\n', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Checksum'):
            guard.verify(self.dir, PROJECT)

    def test_manifest_must_not_be_overwritten(self):
        self.create()
        with self.assertRaisesRegex(ValueError, 'exists'):
            self.create()

    def test_incomplete_manifest_rejected(self):
        self.create()
        path = self.dir / guard.MANIFEST
        data = json.loads(path.read_text())
        data['files'].pop('roles.sql')
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'exactly'):
            guard.verify(self.dir, PROJECT)

    def test_wrong_source_project_is_rejected(self):
        self.create()
        with self.assertRaisesRegex(ValueError, 'Wrong project'):
            guard.verify(self.dir, 'b' * 20)

    def test_symlinked_component_is_rejected(self):
        external = self.dir / 'outside.sql'
        external.write_text('-- bogus --')
        (self.dir / 'data.sql').unlink()
        try:
            (self.dir / 'data.sql').symlink_to(external)
        except (OSError, NotImplementedError):
            self.skipTest('Symlinks unavailable on this OS')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.create()


if __name__ == '__main__':
    unittest.main()
