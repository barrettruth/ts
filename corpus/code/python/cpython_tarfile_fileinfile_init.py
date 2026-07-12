    def __init__(self, fileobj, offset, size, name, blockinfo=None):
        self.fileobj = fileobj
        self.offset = offset
        self.size = size
        self.position = 0
        self.name = name
        self.closed = False

        if blockinfo is None:
            blockinfo = [(0, size)]

        # Construct a map with data and zero blocks.
        self.map_index = 0
        self.map = []
        lastpos = 0
        realpos = self.offset
        for offset, size in blockinfo:
            if offset > lastpos:
                self.map.append((False, lastpos, offset, None))
            self.map.append((True, offset, offset + size, realpos))
            realpos += size
            lastpos = offset + size
        if lastpos < self.size:
            self.map.append((False, lastpos, self.size, None))
