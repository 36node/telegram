/**
 * Returns an Array of length 8 containing the read bits.
 *
 * @example
 * readByteBits(42) => [0,0,1,0,1,0,1,0]
 *
 * @param {Number} byte one byte
 * @return {Array}
 */
export function readByteBits(byte) {
  if (byte > 255 || byte < 0 || ~~byte !== byte) throw new RangeError("invalid byte");
  const result = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) result[7 - i] = (byte >> i) & 1;
  return result;
}

/**
 * Return an array of length bitLength of read interger
 *
 * @example
 * readUnitBits(10, 4) => [1, 0, 1, 0]
 *
 * @param {number} val number to read
 * @param {number} bitLength max is 53
 */
export function readUIntBits(val, bitLength) {
  if (val > Number.MAX_SAFE_INTEGER || val < 0) throw new RangeError("invalid number");

  const result = [];
  result.length = bitLength;
  result.fill(0);
  for (let i = 0; i < bitLength; i++) result[bitLength - 1 - i] = (val >> i) & 1;

  return result;
}

/**
 * Returns an Array containing bitLength bits starting at bitOffset.
 *
 * @example
 * readBufferBits(buffer, 2, 4) => [0,0,1,0]
 *
 * @param {Buffer} buffer the buffer to read
 * @param {Number} offset where to start (in bits)
 * @param {Number} length how many bits to read
 * @returns {Array}
 */
export function readBufferBits(buffer, offset = 0, length) {
  if (!length) length = buffer.length * 8 - offset;

  const start = Math.floor(offset / 8);
  const bytesToRead = Math.floor(length / 8) + 2;

  const arr = [];
  arr.length = bytesToRead * 8;

  for (let i = 0; i < bytesToRead; i++) {
    const toRead = buffer[start + i];
    if (toRead === undefined) continue;
    const bits = readByteBits(buffer[start + i]);
    arr[i * 8] = bits[0];
    arr[i * 8 + 1] = bits[1];
    arr[i * 8 + 2] = bits[2];
    arr[i * 8 + 3] = bits[3];
    arr[i * 8 + 4] = bits[4];
    arr[i * 8 + 5] = bits[5];
    arr[i * 8 + 6] = bits[6];
    arr[i * 8 + 7] = bits[7];
  }

  const subOffset = offset % 8;
  return arr.slice(subOffset, subOffset + length);
}

/**
 * Returns a UInt8 (0-255) which equals the given bits.
 *
 * @example
 * writeByteBits([0,0,1,0,1,0,1,0]) => 42
 *
 * @param {Array} byte 8 bits
 * @return {Number} 8-bit unsigned integer
 */
export function writeByteBits(byte) {
  if (!Array.isArray(byte) || byte.length !== 8) throw new RangeError("invalid array length");

  let data = 0;

  for (let i = 0; i < 8; i++) if (byte[7 - i]) data |= 1 << i;

  return data;
}

/**
 * Modifies the buffer's bits to equal newBits starting at bitOffset.
 *
 * @example
 * writeBufferBits(buffer, [0,0,1,0], 0) => buffer was modified
 *
 * @param {Buffer} buffer the buffer to modify
 * @param {Array} bits the bits to insert
 * @param {Number} offset where to start (in bits)
 * @returns {undefined}
 */
export function writeBufferBits(buffer, bits, offset) {
  const start = Math.floor(offset / 8);
  const end = Math.ceil((offset + bits.length) / 8);

  const subBuffer = buffer.slice(start, end);
  const byteData = readBufferBits(subBuffer);

  let subOffset = offset % 8;

  for (var i = 0; i < bits.length; i++) byteData[subOffset++] = bits[i];

  const length = end - start;
  for (let i = 0; i < length; i++) subBuffer[i] = writeByteBits(byteData.slice(i * 8, (i + 1) * 8));
}

/**
 *
 * @param {Buffer} buffer
 * @param {number} value
 */
export function writeBufferUInt(buffer, value) {
  buffer.writeBigInt64BE(value);
}
