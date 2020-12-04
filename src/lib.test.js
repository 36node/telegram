import { readBufferBits, readUIntBits, writeBufferBits } from "./lib";

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
