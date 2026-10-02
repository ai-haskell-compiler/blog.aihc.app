"""Read Mach-O sections, symbols and relocations for corpus validation."""
import struct


def read(path):
    data = path.read_bytes()
    assert struct.unpack_from('<I', data)[0] == 0xfeedfacf
    commands = struct.unpack_from('<I', data, 16)[0]
    offset = 32
    sections = []
    symtab = None
    for _ in range(commands):
        command, size = struct.unpack_from('<II', data, offset)
        if command == 0x19:
            count = struct.unpack_from('<I', data, offset + 64)[0]
            for i in range(count):
                pos = offset + 72 + 80 * i
                name = data[pos:pos+16].split(b'\0')[0].decode()
                segment = data[pos+16:pos+32].split(b'\0')[0].decode()
                addr, length, start, align, reloc, nreloc = struct.unpack_from('<QQIIII', data, pos+32)
                sections.append({'name': name, 'segment': segment, 'address': addr,
                                 'bytes': data[start:start+length], 'reloc': reloc, 'nreloc': nreloc})
        elif command == 2:
            symtab = struct.unpack_from('<IIII', data, offset+8)
        offset += size
    symbols = []
    if symtab:
        start, count, strings, _ = symtab
        for i in range(count):
            name, kind, section, _, value = struct.unpack_from('<IBBHQ', data, start+16*i)
            end = data.index(b'\0', strings+name)
            symbols.append({'name': data[strings+name:end].decode(), 'kind': kind,
                            'section': section, 'value': value})
    return data, sections, symbols


def external_symbols(path):
    _, _, symbols = read(path)
    return sorted((s['name'], s['kind'] & 0x0e) for s in symbols if s['kind'] & 1)


def canonical_code(path):
    data, sections, symbols = read(path)
    for index, section in enumerate(sections, 1):
        if (section['segment'], section['name']) != ('__TEXT', '__text'):
            continue
        code = bytearray(section['bytes'])
        # AIHC relocates branches to named functions. Clang can resolve a
        # same-object function branch while assembling. Resolve this case
        # before comparing instruction bytes. External calls stay unresolved.
        for i in range(section['nreloc']):
            address, info = struct.unpack_from('<II', data, section['reloc'] + 8*i)
            kind, external, symbol = info >> 28, (info >> 27) & 1, info & 0xffffff
            if kind == 2 and external and symbols[symbol]['section'] == index:
                word = struct.unpack_from('<I', code, address)[0]
                immediate = word & 0x3ffffff
                if immediate & 0x2000000:
                    immediate -= 0x4000000
                displacement = symbols[symbol]['value'] - section['address'] - address + immediate * 4
                struct.pack_into('<I', code, address, (word & 0xfc000000) | ((displacement // 4) & 0x3ffffff))
        return bytes(code)
    return b''
