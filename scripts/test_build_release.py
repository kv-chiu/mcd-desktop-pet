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
            self.assertTrue(release.run_cmd(['pnpm', '-C', 'shared', 'build']))
            self.assertEqual(run.call_args.args[0], ['C:/tools/pnpm.cmd', '-C', 'shared', 'build'])
            self.assertFalse(run.call_args.kwargs['shell'])

    @unittest.skipIf(os.name == 'nt', 'Unix executable permissions require a Unix filesystem')
    def test_macos_app_keeps_executable_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'desktop' / 'macos'
            output.mkdir(parents=True)
            with zipfile.ZipFile(output / 'McdDesktopPet.zip', 'w') as archive:
                info = zipfile.ZipInfo('McdDesktopPet.app/Contents/MacOS/McdDesktopPet')
                info.external_attr = 0o100755 << 16
                archive.writestr(info, b'example executable')

            with patch.object(release, 'DIST_DIR', directory), patch.object(
                release, 'run_cmd', return_value=True
            ):
                self.assertTrue(release.export_godot('macos', '/mock/godot'))

            executable = output / 'McdDesktopPet.app' / 'Contents' / 'MacOS' / 'McdDesktopPet'
            self.assertTrue(executable.stat().st_mode & 0o111)

    def test_failed_export_stops_before_package_assembly(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(
            release, 'RELEASE_DIR', directory
        ), patch.object(release, 'build_shared'), patch.object(release, 'build_web'), patch.object(
            release, 'bundle_server_and_cli'
        ), patch.object(release, 'find_godot_executable', return_value='/mock/godot'), patch.object(
            release, 'export_godot', return_value=False
        ), patch.object(release, 'assemble_platform_package') as assemble, patch(
            'sys.argv', ['build-release.py', '--platform', 'linux']
        ):
            with self.assertRaises(SystemExit) as error:
                release.main()
            self.assertEqual(error.exception.code, 1)
            assemble.assert_not_called()


if __name__ == '__main__':
    unittest.main()
