#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
mcd-desktop-pet 一体化跨平台打包脚本
实现 Windows 单可执行文件 与 macOS 单应用包 自动化构建流水线。
"""

import sys
import os
import shutil
import subprocess
import argparse
import hashlib
import json
import zipfile
import platform

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
RELEASE_DIR = os.path.join(DIST_DIR, "release")


def log(msg, prefix="[*]"):
    print(f"\033[1;34m{prefix}\033[0m {msg}")


def log_success(msg):
    print(f"\033[1;32m[✓]\033[0m {msg}")


def log_warn(msg):
    print(f"\033[1;33m[!]\033[0m {msg}")


def log_error(msg):
    print(f"\033[1;31m[✗]\033[0m {msg}")


def run_cmd(cmd, cwd=PROJECT_ROOT, check=True, env=None):
    if isinstance(cmd, list):
        cmd = [shutil.which(cmd[0]) or cmd[0], *cmd[1:]]
    log(f"执行命令: {' '.join(cmd) if isinstance(cmd, list) else cmd} (cwd: {os.path.relpath(cwd, PROJECT_ROOT)})")
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    ret = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), env=merged_env)
    if check and ret.returncode != 0:
        log_error(f"命令执行失败，退出码: {ret.returncode}")
        sys.exit(ret.returncode)
    return ret.returncode == 0


def get_version():
    pkg_path = os.path.join(PROJECT_ROOT, "web", "package.json")
    try:
        with open(pkg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("version", "1.0.0")
    except Exception:
        return "1.0.0"


def find_godot_executable():
    if os.environ.get("GODOT_BIN"):
        return os.environ.get("GODOT_BIN")
    candidates = [
        shutil.which("godot"),
        shutil.which("godot4"),
        "/opt/homebrew/bin/godot",
        "/usr/local/bin/godot",
        "C:\\Program Files\\Godot\\Godot_v4.exe",
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None


def calculate_sha256(filepath):
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def build_web():
    log("【阶段 1/4】构建 React 19 可视化大屏前端产物 (web/dist)...")
    web_dir = os.path.join(PROJECT_ROOT, "web")
    web_dist = os.path.join(web_dir, "dist")
    index_html = os.path.join(web_dist, "index.html")
    if not os.path.exists(index_html):
        run_cmd(["pnpm", "build"], cwd=web_dir)
    else:
        log("检测到已有 web/dist 产物，跳过重新构建（使用 --force-web 强制重建）")
    log_success("Web 控制台静态产物就绪")


def export_godot(target_platform, godot_bin):
    desktop_dir = os.path.join(PROJECT_ROOT, "desktop")
    dist_desktop = os.path.join(DIST_DIR, "desktop")
    os.makedirs(dist_desktop, exist_ok=True)

    if not godot_bin:
        log_warn("未检测到 Godot 4 引擎，将跳过内嵌桌面导出产物")
        return None

    log(f"【阶段 2/4】使用 Godot 导出 [{target_platform}] 桌面宠物客户端...")

    if target_platform == "windows":
        out_path = os.path.join(dist_desktop, "windows", "mcd-pet-runtime.exe")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        ok = run_cmd([godot_bin, "--headless", "--path", desktop_dir, "--export-release", "Windows Desktop", out_path], check=False)
        return out_path if ok and os.path.exists(out_path) else None

    elif target_platform == "macos":
        out_zip = os.path.join(dist_desktop, "macos", "McdDesktopPet.zip")
        os.makedirs(os.path.dirname(out_zip), exist_ok=True)
        ok = run_cmd([godot_bin, "--headless", "--path", desktop_dir, "--export-release", "macOS", out_zip], check=False)
        if ok and os.path.exists(out_zip):
            app_dir = os.path.join(dist_desktop, "macos", "mcd-pet-runtime.app")
            if os.path.exists(app_dir):
                shutil.rmtree(app_dir)
            with zipfile.ZipFile(out_zip, 'r') as zf:
                zf.extractall(os.path.dirname(out_zip))
            return app_dir
        return None

    return None


def build_go_binary(target_os, target_arch, output_path):
    log(f"【阶段 3/4】编译 Go 一体化主程序 ({target_os}/{target_arch})...")
    env = {
        "GOOS": target_os,
        "GOARCH": target_arch,
        "CGO_ENABLED": "0",
    }
    run_cmd(["go", "build", "-trimpath", "-ldflags", "-s -w", "-o", output_path, "./cmd/mcd-desktop-pet"], env=env)
    if not os.path.exists(output_path):
        log_error(f"Go 二进制编译失败: {output_path}")
        sys.exit(1)
    log_success(f"Go 二进制编译完成: {output_path}")


def package_macos_app(go_binary_path, output_app_path, version):
    log(f"封装 macOS 单应用包: {output_app_path}...")
    macos_dir = os.path.join(output_app_path, "Contents", "MacOS")
    resources_dir = os.path.join(output_app_path, "Contents", "Resources")
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(resources_dir, exist_ok=True)

    dest_bin = os.path.join(macos_dir, "mcd-desktop-pet")
    shutil.copy2(go_binary_path, dest_bin)
    os.chmod(dest_bin, 0o755)

    for icon_name in ["icon.icns", "icon.png", "icon.svg"]:
        icon_path = os.path.join(PROJECT_ROOT, "desktop", icon_name)
        if os.path.exists(icon_path):
            shutil.copy2(icon_path, os.path.join(resources_dir, icon_name))

    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>mcd-desktop-pet</string>
    <key>CFBundleIdentifier</key>
    <string>com.mcd.desktoppet</string>
    <key>CFBundleName</key>
    <string>mcd-desktop-pet</string>
    <key>CFBundleDisplayName</key>
    <string>麦当劳便利贴桌宠</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>CFBundleVersion</key>
    <string>{version}</string>
    <key>CFBundleShortVersionString</key>
    <string>{version}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
"""
    with open(os.path.join(output_app_path, "Contents", "Info.plist"), "w", encoding="utf-8") as f:
        f.write(plist_content)

    log_success("macOS 单应用包封装完成")


def make_zip(source_dir, output_zip):
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, source_dir)
                zf.write(abs_path, rel_path)


def main():
    parser = argparse.ArgumentParser(description="mcd-desktop-pet 跨平台发布构建流水线")
    parser.add_argument("--platform", choices=["all", "windows", "macos"], default="all", help="构建目标平台")
    parser.add_argument("--skip-godot", action="store_true", help="跳过 Godot 导出")
    parser.add_argument("--force-web", action="store_true", help="强制重新构建前端")
    args = parser.parse_args()

    version = get_version()
    godot_bin = None if args.skip_godot else find_godot_executable()

    os.makedirs(RELEASE_DIR, exist_ok=True)
    temp_build_dir = os.path.join(DIST_DIR, "temp_build")
    if os.path.exists(temp_build_dir):
        shutil.rmtree(temp_build_dir)
    os.makedirs(temp_build_dir, exist_ok=True)

    if args.force_web:
        web_dist = os.path.join(PROJECT_ROOT, "web", "dist")
        if os.path.exists(web_dist):
            shutil.rmtree(web_dist)

    build_web()

    targets = ["windows", "macos"] if args.platform == "all" else [args.platform]
    checksums = {}

    for target in targets:
        if target == "windows":
            exe_name = "mcd-desktop-pet.exe"
            go_out = os.path.join(temp_build_dir, exe_name)
            build_go_binary("windows", "amd64", go_out)

            win_dir = os.path.join(temp_build_dir, "windows_pkg")
            os.makedirs(win_dir, exist_ok=True)
            shutil.copy2(go_out, os.path.join(win_dir, exe_name))

            zip_name = f"mcd-desktop-pet-v{version}-windows-x64.zip"
            zip_path = os.path.join(RELEASE_DIR, zip_name)
            make_zip(win_dir, zip_path)
            checksums[zip_name] = calculate_sha256(zip_path)
            log_success(f"Windows 发行包生成: {zip_path}")

        elif target == "macos":
            for arch in ["arm64", "amd64"]:
                go_out = os.path.join(temp_build_dir, f"mcd-desktop-pet-darwin-{arch}")
                build_go_binary("darwin", arch, go_out)

                mac_pkg_dir = os.path.join(temp_build_dir, f"macos_{arch}_pkg")
                os.makedirs(mac_pkg_dir, exist_ok=True)
                app_path = os.path.join(mac_pkg_dir, "mcd-desktop-pet.app")
                package_macos_app(go_out, app_path, version)

                zip_name = f"mcd-desktop-pet-v{version}-macos-{arch}.zip"
                zip_path = os.path.join(RELEASE_DIR, zip_name)
                make_zip(mac_pkg_dir, zip_path)
                checksums[zip_name] = calculate_sha256(zip_path)
                log_success(f"macOS ({arch}) 发行包生成: {zip_path}")

    # Generate SHA256SUMS.txt
    sha_file = os.path.join(RELEASE_DIR, "SHA256SUMS.txt")
    with open(sha_file, "w", encoding="utf-8") as f:
        for fname, sha in checksums.items():
            f.write(f"{sha}  {fname}\n")
    log_success(f"【阶段 4/4】生成校验和文件: {sha_file}")

    print("\n" + "=" * 60)
    log_success(f"🎉 全部发布产物构建完成！版本: v{version}")
    for fname, sha in checksums.items():
        print(f"  📦 {fname} (SHA-256: {sha[:12]}...)")
    print("=" * 60)


if __name__ == "__main__":
    main()
