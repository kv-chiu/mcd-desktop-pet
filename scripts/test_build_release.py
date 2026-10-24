import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile


spec = importlib.util.spec_from_file_location(
    'build_release', Path(__file__).with_name('build-release.py')
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleasePackagingTests(unittest.TestCase):
    def test_resolves_windows_command_shims(self):
        with patch.object(release.shutil, 'which', return_value='C:/tools/pnpm.cmd'), patch.object(
            release.subprocess, 'run'
        ) as run:
            run.return_value.returncode = 0
            self.assertTrue(release.run_cmd(['pnpm', '--filter', 'mcd-pet-web', 'build']))
            self.assertEqual(run.call_args.args[0], ['C:/tools/pnpm.cmd', '--filter', 'mcd-pet-web', 'build'])
            self.assertFalse(run.call_args.kwargs['shell'])

    @unittest.skipIf(os.name == 'nt', 'Unix executable permissions require a Unix filesystem')
    def test_macos_app_keeps_executable_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            bin_path = Path(directory) / 'mcd-desktop-pet'
            bin_path.write_text('#!/bin/sh\nexit 0\n')
            bin_path.chmod(0o755)

            app_output = Path(directory) / 'mcd-desktop-pet.app'
            release.package_macos_app(str(bin_path), str(app_output), '1.0.0')

            executable = app_output / 'Contents' / 'MacOS' / 'mcd-desktop-pet'
            self.assertTrue(executable.exists())
            self.assertTrue(executable.stat().st_mode & 0o111)

    def test_sha256_calculation(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"mcd-desktop-pet release test content")
            f.flush()
            temp_path = f.name

        try:
            sha = release.calculate_sha256(temp_path)
            self.assertEqual(len(sha), 64)
        finally:
            os.unlink(temp_path)


if __name__ == '__main__':
    unittest.main()
