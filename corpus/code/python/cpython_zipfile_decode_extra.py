    def _decodeExtra(self, filename_crc):
        # Try to decode the extra field.
        extra = self.extra
        unpack = struct.unpack
        while len(extra) >= 4:
            tp, ln = unpack('<HH', extra[:4])
            if ln+4 > len(extra):
                raise BadZipFile("Corrupt extra field %04x (size=%d)" % (tp, ln))
            if tp == 0x0001:
                data = extra[4:ln+4]
                # ZIP64 extension (large files and/or large archives)
                try:
                    if self.file_size in (0xFFFF_FFFF_FFFF_FFFF, 0xFFFF_FFFF):
                        field = "File size"
                        self.file_size, = unpack('<Q', data[:8])
                        data = data[8:]
                    if self.compress_size == 0xFFFF_FFFF:
                        field = "Compress size"
                        self.compress_size, = unpack('<Q', data[:8])
                        data = data[8:]
                    if self.header_offset == 0xFFFF_FFFF:
                        field = "Header offset"
                        self.header_offset, = unpack('<Q', data[:8])
                except struct.error:
                    raise BadZipFile(f"Corrupt zip64 extra field. "
                                     f"{field} not found.") from None
            elif tp == 0x7075:
                data = extra[4:ln+4]
                # Unicode Path Extra Field
                try:
                    up_version, up_name_crc = unpack('<BL', data[:5])
                    if up_version == 1 and up_name_crc == filename_crc:
                        up_unicode_name = data[5:].decode('utf-8')
                        if up_unicode_name:
                            self.filename = _sanitize_filename(up_unicode_name)
                        else:
                            import warnings
                            warnings.warn("Empty unicode path extra field (0x7075)", stacklevel=2)
                except struct.error as e:
                    raise BadZipFile("Corrupt unicode path extra field (0x7075)") from e
                except UnicodeDecodeError as e:
                    raise BadZipFile('Corrupt unicode path extra field (0x7075): invalid utf-8 bytes') from e

            extra = extra[ln+4:]
