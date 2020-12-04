import fs from "fs";
import Telegram from "./parser";

// 测试内置类型-big endian
test("should compress PRIMITIVE_TYPES big endian", () => {
  /**
   * @type {Telegram}
   */
  const tcpHeader = new Telegram()
    .endianess("big")
    .uint16("srcPort")
    .uint16("dstPort")
    .uint32("seq")
    .uint32("ack")
    .uint16("windowSize")
    .uint16("checksum")
    .uint16("urgentPointer");

  const obj = {
    srcPort: 59554,
    dstPort: 993,
    seq: 148994017,
    ack: 1025537387,
    windowSize: 10707,
    checksum: 65,
    urgentPointer: 0,
  };

  const compressed = tcpHeader.compress(obj);
  expect(compressed.toString("hex")).toEqual("e8a203e108e177e13d20756b29d300410000");

  const decompressed = tcpHeader.decompress(compressed);
  expect(decompressed).toEqual(obj);
});

// 测试内置类型-little endian
test("should compress PRIMITIVE_TYPES little endian", () => {
  /**
   * @type {Telegram}
   */
  const tcpHeader = new Telegram()
    .endianess("little")
    .uint16("srcPort")
    .uint16("dstPort")
    .uint32("seq")
    .uint32("ack")
    .uint16("windowSize")
    .uint16("checksum")
    .uint16("urgentPointer");

  const obj = {
    srcPort: 59554,
    dstPort: 993,
    seq: 148994017,
    ack: 1025537387,
    windowSize: 10707,
    checksum: 65,
    urgentPointer: 0,
  };

  const compressed = tcpHeader.compress(obj);
  expect(compressed.toString("hex")).toEqual("a2e8e103e177e1086b75203dd32941000000");

  const decompressed = tcpHeader.decompress(compressed);
  expect(decompressed).toEqual(obj);
});

// 测试bit类型-big endian
test("should compress bits big endian ", () => {
  /**
   * @type {Telegram}
   */
  const tcpHeader = new Telegram()
    .endianess("big")
    .uint16("srcPort")
    .uint16("dstPort")
    .uint32("seq")
    .uint32("ack")
    .bit4("dataOffset") // 连续bit必须保证位数和为8的整数倍
    .bit12("reserved")
    .uint16("windowSize")
    .uint16("checksum")
    .uint16("urgentPointer");

  const obj = {
    srcPort: 59554,
    dstPort: 993,
    seq: 148994017,
    ack: 1025537387,
    dataOffset: 8,
    reserved: 121,
    windowSize: 10707,
    checksum: 65,
    urgentPointer: 0,
  };

  const compressed = tcpHeader.compress(obj);
  const decompressed = tcpHeader.decompress(compressed);

  expect(decompressed).toEqual(obj);
});

// 测试包含 nest 配置
test("should compress bits with nest big endian", () => {
  /**
   * @type {Telegram}
   */
  const tcpHeader = new Telegram()
    .endianess("big")
    .uint16("srcPort")
    .uint16("dstPort")
    .uint32("seq")
    .uint32("ack")
    .bit4("dataOffset")
    .bit6("reserved")
    .nest("flags", {
      type: new Telegram()
        .bit1("urg")
        .bit1("ack")
        .bit1("psh")
        .bit1("rst")
        .bit1("syn")
        .bit1("fin"),
    })
    .uint16("windowSize")
    .uint16("checksum")
    .uint16("urgentPointer");

  const obj = {
    srcPort: 59554,
    dstPort: 993,
    seq: 148994017,
    ack: 1025537387,
    dataOffset: 8,
    reserved: 63,
    flags: { urg: 0, ack: 1, psh: 1, rst: 0, syn: 0, fin: 0 },
    windowSize: 10707,
    checksum: 65,
    urgentPointer: 0,
  };

  const compressed = tcpHeader.compress(obj);
  const decompressed = tcpHeader.decompress(compressed);

  expect(decompressed).toEqual(obj);
});

// 测试包含skip 配置
test("should compress with skip", () => {
  /**
   * @type {Telegram}
   */
  const tcpHeader = new Telegram()
    .endianess("big")
    .uint16("srcPort")
    .uint16("dstPort")
    .uint32("seq")
    .uint32("ack")
    .bit4("dataOffset") // 连续bit必须保证位数和为8的整数倍
    .bit6("reserved")
    .skip(6, { type: "bit" })
    .uint16("windowSize")
    .uint16("checksum")
    .uint16("urgentPointer");

  const obj = {
    srcPort: 59554,
    dstPort: 993,
    seq: 148994017,
    ack: 1025537387,
    dataOffset: 8,
    reserved: 60,
    windowSize: 10707,
    checksum: 65,
    urgentPointer: 0,
  };

  const compressed = tcpHeader.compress(obj);
  const decompressed = tcpHeader.decompress(compressed);
  expect(decompressed).toEqual(obj);
});

// 测试string 类型压缩
test("should compress string", () => {
  /**
   * @type {Telegram}
   */
  let telegram = new Telegram()
    .string("name", { length: 8, stripNull: true })
    .string("zeroTerminated", { zeroTerminated: true });

  let obj = {
    name: "abc",
    zeroTerminated: "efg",
  };
  let compressed = telegram.compress(obj);
  let decompressed = telegram.decompress(compressed);

  expect(decompressed).toMatchObject({ name: "abc", zeroTerminated: "efg" });

  telegram = new Telegram()
    .string("name", { length: 8, stripNull: true })
    .string("zeroTerminated", { zeroTerminated: true })
    .string("uid", { length: 100, stripNull: true });

  obj = {
    name: "abc",
    zeroTerminated: "efg",
    uid: "123456",
  };
  compressed = telegram.compress(obj);
  decompressed = telegram.decompress(compressed);
  expect(decompressed).toEqual(obj);
});

const bmpFileHeader = new Telegram()
  .endianess("little")
  .string("type", {
    length: 2,
    assert: "BM",
  })
  .uint32("size")
  .uint16("reserved1")
  .uint16("reserved2")
  .uint32("offBits");

const bmpInfoHeader = new Telegram()
  .endianess("little")
  .uint32("size")
  .int32("width")
  .int32("height")
  .uint16("planes")
  .uint16("bitCount")
  .uint32("compression")
  .uint32("sizeImage")
  .int32("xPelsPerMeter")
  .int32("yPelsPerMeter")
  .uint32("clrUsed")
  .uint32("clrImportant");

// 复杂的测试 bmp test.bmp 压缩
test("should compress test.bmp", () => {
  // 读取文件
  const data = fs.readFileSync("examples/test.bmp");

  const bmpFile = new Telegram()
    .nest("fileHeader", {
      type: bmpFileHeader,
    })
    .nest("infoHeader", {
      type: bmpInfoHeader,
    });

  // 从原始数据解压数据
  const obj = bmpFile.decompress(data);

  // 压缩
  const compressed = bmpFile.compress(obj);

  // 从压缩数据解压
  const decompressed = bmpFile.decompress(compressed);

  // 解压结果相同
  expect(decompressed).toEqual(obj);

  // 比较压缩后的bufer和文件中的buffer是否一致
  expect(data.slice(0, compressed.length).equals(compressed));
});

// 复杂的测试 bmp test2.bmp 压缩
test("should compress test2.bmp", () => {
  // 读取文件
  const data = fs.readFileSync("examples/test2.bmp");

  const bmpFile = new Telegram()
    .nest("fileHeader", {
      type: bmpFileHeader,
    })
    .nest("infoHeader", {
      type: bmpInfoHeader,
    });

  // 从原始数据解压数据
  const obj = bmpFile.decompress(data);

  // 压缩
  const compressed = bmpFile.compress(obj);

  // 从压缩数据解压
  const decompressed = bmpFile.decompress(compressed);

  // 解压结果相同
  expect(decompressed).toEqual(obj);

  // 比较压缩后的bufer和文件中的buffer是否一致
  expect(data.slice(0, compressed.length).equals(compressed));
});
