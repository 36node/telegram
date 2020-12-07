import { readBufferBits, readUIntBits, swapBuffer, writeBufferBits } from "./lib";

test("should readUIntBits", async () => {
  expect(readUIntBits(10, 4)).toEqual([1, 0, 1, 0]);

  expect(readUIntBits(14, 4)).toEqual([1, 1, 1, 0]);
  expect(readUIntBits(34, 6)).toEqual([1, 0, 0, 0, 1, 0]);

  const exp = [];
  exp.length = 53;
  exp.fill(1);
  expect(readUIntBits(Math.pow(2, 53) - 1, 53)).toEqual(exp);
});

test("should readerBufferBits", () => {
  const buf = Buffer.from("5d", "hex");

  const ret = readBufferBits(buf, 2, 3);

  expect(ret).toEqual([0, 1, 1]);
});

test("should writeBufferBits", () => {
  const buf = Buffer.from("5d", "hex");

  writeBufferBits(buf, [1, 0, 0], 2);

  expect(buf.toString("hex")).toEqual("65");
});

test("should swap buffer", () => {
  const buf1 = Buffer.from([1, 2, 3, 4]);
  swapBuffer(buf1, 1, 2);
  expect(buf1.equals(Buffer.from([1, 3, 2, 4])));

  const buf2 = Buffer.from([1, 2, 3, 4, 5, 6, 7]);
  swapBuffer(buf2, 2, 3);
  expect(buf2.equals(Buffer.from([1, 2, 5, 4, 3, 6, 7])));
});
