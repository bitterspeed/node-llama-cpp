import fs from "node:fs/promises";
import {withLock} from "lifecycle-utils";
import {GgufReadOffset} from "../utils/GgufReadOffset.js";
import {defaultExtraAllocationSize} from "../consts.js";
import {GgufFileReader} from "./GgufFileReader.js";

type GgufFsFileReaderOptions = {
    filePath: string,
    signal?: AbortSignal
};

export class GgufFsFileReader extends GgufFileReader {
    public readonly filePath: string;
    private readonly _signal?: AbortSignal;

    public constructor({filePath, signal}: GgufFsFileReaderOptions) {
        super();
        this.filePath = filePath;
        this._signal = signal;
    }

    public async readByteRange(offset: number | GgufReadOffset, length: number) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        const endOffset = readOffset.offset + length;

        if (endOffset >= this._buffer.length)
            await this._readToExpandBufferUpToOffset(endOffset);

        const res = this._buffer.subarray(readOffset.offset, endOffset);
        readOffset.moveBy(length);
        return res;
    }

    private async _readToExpandBufferUpToOffset(endOffset: number, extraAllocationSize: number = defaultExtraAllocationSize) {
        return await withLock(this, "modifyBuffer", this._signal, async () => {
            if (endOffset < this._buffer.length)
                return;

            const missingBytesBuffer = await this._readByteRange(
                this._buffer.length,
                endOffset + extraAllocationSize - this._buffer.length
            );

            this._addToBuffer(missingBytesBuffer);
        });
    }

    private async _readByteRange(start: number, length: number) {
        const fd = await fs.open(this.filePath, "r");
        try {
            if (this._signal?.aborted)
                throw this._signal.reason;

            const buffer = Buffer.alloc(length);
            await fd.read(buffer, 0, length, start);
            return buffer;
        } finally {
            await fd.close();
        }
    }
}
