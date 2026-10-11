#!/usr/bin/env python3
"""Joins thin Mach-O executables into one universal binary, as `lipo
-create` does, for building on machines without Apple's tools.

    scripts/lipo.py out arm64-binary x86_64-binary
"""
import struct
import sys

ALIGN = 14  # 16 KiB, what lipo uses for arm64


def cpu(data: bytes) -> tuple[int, int]:
    magic, cputype, subtype = struct.unpack_from("<III", data, 0)
    if magic != 0xFEEDFACF:
        raise SystemExit("not a thin 64-bit Mach-O")
    return cputype, subtype


def main() -> None:
    out, *inputs = sys.argv[1:]
    thin = [open(p, "rb").read() for p in inputs]
    header = struct.pack(">II", 0xCAFEBABE, len(thin))
    offset = 1 << ALIGN
    entries, bodies = b"", []
    for data in thin:
        cputype, subtype = cpu(data)
        entries += struct.pack(">iiIII", cputype, subtype, offset, len(data), ALIGN)
        bodies.append((offset, data))
        offset = (offset + len(data) + (1 << ALIGN) - 1) & ~((1 << ALIGN) - 1)
    with open(out, "wb") as f:
        f.write(header + entries)
        for at, data in bodies:
            f.seek(at)
            f.write(data)


if __name__ == "__main__":
    main()
