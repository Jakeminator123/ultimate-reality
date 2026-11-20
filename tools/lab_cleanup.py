"""Gallra verifierade arbetskopior under labbets lås på Windows."""

import _winapi
import ctypes
import hashlib
import importlib.util
import json
import msvcrt
import os
import py_compile
import re
import stat
import sys
import tempfile
from ctypes import wintypes
from pathlib import Path

from material_versions import SHA, SLUG, sha


def local(root, path):
    if not path.is_relative_to(root) or path.resolve(strict=True) != path:
        raise ValueError(f"Sökvägen lämnar arbetsytan eller följer en länk: {path}")
    cursor = path
    while cursor != root.parent:
        if cursor.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError(f"Länk eller junction: {cursor}")
        if cursor == root:
            break
        cursor = cursor.parent
    return path


def discard(root, path, expected, dry_run):
    """Kontrollera och radera samma öppna fil. En samtidig läsare/skrivare behåller filen."""
    local(root, path)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    final_name = kernel.GetFinalPathNameByHandleW
    final_name.argtypes = (wintypes.HANDLE, wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD)
    final_name.restype = wintypes.DWORD
    dispose = kernel.SetFileInformationByHandle
    dispose.argtypes = (wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD)
    dispose.restype = wintypes.BOOL
    # OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT. No sharing with other jobs.
    access = 0x80000000 | (0 if dry_run else 0x10000)
    handle = _winapi.CreateFile(str(path), access, 0, 0, 3, 0x00200000, 0)
    try:
        fd = msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
    except BaseException:
        _winapi.CloseHandle(handle)
        raise
    removed = False
    with os.fdopen(fd, "rb") as file:
        name = ctypes.create_unicode_buffer(32768)
        length = final_name(handle, name, len(name), 0)
        if not 0 < length < len(name):
            raise ctypes.WinError(ctypes.get_last_error())
        actual = name.value.removeprefix("\\\\?\\")
        if actual.startswith("UNC\\"):
            actual = "\\\\" + actual[4:]
        if Path(actual) != path or not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError(f"Den öppna filen ligger på en annan sökväg: {path}")
        size = os.fstat(fd).st_size
        if hashlib.file_digest(file, "sha256").hexdigest() != expected:
            raise ValueError(f"Filens innehåll avviker: {path}")
        if not dry_run:
            flag = wintypes.BOOL(True)
            if not dispose(handle, 4, ctypes.byref(flag), ctypes.sizeof(flag)):  # FileDispositionInfo
                raise ctypes.WinError(ctypes.get_last_error())
            removed = True
    print(f"{'Gallrad' if removed else 'Kan gallras'}: {path} ({size} byte)")
    return size


def clean_bytecode(project, dry_run):
    """Jämför med färsk kompilering utan att importera eller exekvera källfilen."""
    cache_name = re.compile(rf"(.+)\.{re.escape(sys.implementation.cache_tag)}(?:\.opt-([12]))?\.pyc$")
    with tempfile.TemporaryDirectory(prefix="ur-bytecode-") as tmp:
        probe = Path(tmp) / "probe.pyc"
        for folder in ("tools", "tests", "test"):
            base = project / folder
            if not base.is_dir():
                continue
            local(project, base)
            for current, dirs, files in os.walk(base):
                parent = Path(current)
                dirs[:] = [d for d in dirs if d not in {"node_modules", ".venv", ".git"} and
                           not (parent / d).lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT]
                if parent.name != "__pycache__":
                    continue
                dirs.clear()
                for name in sorted(files):
                    match = cache_name.fullmatch(name)
                    if not match:
                        continue
                    cache = parent / name
                    source = parent.parent / (match[1] + ".py")
                    if not source.is_file():
                        continue
                    try:
                        local(project, cache)
                        local(project, source)
                        with cache.open("rb") as file:
                            header = file.read(8)
                        modes = {0: "TIMESTAMP", 1: "UNCHECKED_HASH", 3: "CHECKED_HASH"}
                        mode = modes.get(int.from_bytes(header[4:], "little"))
                        if header[:4] != importlib.util.MAGIC_NUMBER or not mode:
                            continue
                        py_compile.compile(str(source), str(probe), doraise=True, optimize=int(match[2] or 0),
                                           invalidation_mode=py_compile.PycInvalidationMode[mode])
                        discard(project, cache, sha(probe), dry_run)
                    except (OSError, ValueError, py_compile.PyCompileError) as error:
                        print(f"Behåll {cache}: {error}", file=sys.stderr)


def registered_runs(project):
    protected = set()
    avatars = project / "avatars"
    if avatars.exists():
        for dealer in local(project, avatars).iterdir():
            models = dealer / "3d" / "versioner" / "modeller"
            if not models.is_dir():
                continue
            for record in local(project, models).glob("*.json"):
                data = json.loads(local(project, record).read_text(encoding="utf-8-sig"))
                source = data["run"]
                if isinstance(source, str):
                    protected.add(source)
    return protected


def trial_stage(project, dealer, take, stage_name):
    if not all(SLUG.fullmatch(s) for s in (dealer, take, stage_name)):
        raise ValueError("Ange dealer, tagning och mellanmapp med lokala kortnamn.")
    if stage_name != "utprovning" and not re.fullmatch(r"filmprov-[0-9a-f]{8,64}", stage_name):
        raise ValueError("Mellanmappen ska vara utprovning eller filmprov-<rörelsehash>.")
    trial = local(project, project / "test" / "dealer" / dealer / take)
    return local(project, trial / stage_name)


def finish_trial(project, dealer, take, stage_name, dry_run):
    stage = trial_stage(project, dealer, take, stage_name)
    trial = stage.parent
    store = local(project, project / "avatars" / dealer / "3d" / "versioner")
    registration = json.loads(local(project, trial / "registrering.json").read_text(encoding="utf-8-sig"))
    receipt = registration["filmRecord"]
    if not isinstance(receipt, str) or not SHA.fullmatch(receipt):
        raise ValueError("Tagningen har inget giltigt filmkvitto.")
    record = local(project, store / "filmer" / (receipt + ".json")).read_bytes()
    film = json.loads(record)
    if hashlib.sha256(record).hexdigest() != receipt or film["take"] != take:
        raise ValueError("Filmkvittot stämmer inte med den avslutade tagningen.")
    if stage_name != "utprovning" and not film["motion"].startswith(stage_name.removeprefix("filmprov-")):
        raise ValueError("Mellanmappens rörelse stämmer inte med den registrerade.")
    candidates = []
    for filename, suffix, digest, key in (
        (f"{dealer}-{take}.glb", ".glb", film["motion"], "motion"),
        (f"{take}.mp4", ".mp4", film["sha256"], "movie"),
    ):
        if not isinstance(digest, str) or not SHA.fullmatch(digest) or registration[key] != digest:
            raise ValueError(f"Registreringen stämmer inte för {filename}.")
        copy = stage / filename
        if not copy.exists():
            continue  # Ett tidigare avslut kan redan ha gallrat den här filen.
        if sha(local(project, copy)) != digest:
            raise ValueError(f"Mellanexporten tillhör ett annat innehåll: {copy}")
        for kept in (trial / filename, store / "filer" / (digest + suffix)):
            if sha(local(project, kept)) != digest:
                raise ValueError(f"Den bevarade filen stämmer inte med registret: {kept}")
        candidates.append((copy, digest))
    for copy, digest in candidates:
        discard(project, copy, digest, dry_run)
