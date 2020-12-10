import Telegram from "./parser";

// 测试decompress下byte位置
test("should decompress tcp header buffer with right byte position", () => {
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

  const buffer = Buffer.from("e8a203e108e177e13d20756b29d300410000", "hex");

  const obj = {
    length: 18,
    result: {
      ack: {
        offset: 4,
        start: 8,
        value: 1025537387,
      },
      checksum: {
        offset: 2,
        start: 14,
        value: 65,
      },
      dstPort: {
        offset: 2,
        start: 2,
        value: 993,
      },
      seq: {
        offset: 4,
        start: 4,
        value: 148994017,
      },
      srcPort: {
        offset: 2,
        start: 0,
        value: 59554,
      },
      urgentPointer: {
        offset: 2,
        start: 16,
        value: 0,
      },
      windowSize: {
        offset: 2,
        start: 12,
        value: 10707,
      },
    },
  };

  const decompressed = tcpHeader.decompress(buffer, true, true);
  expect(decompressed).toEqual(obj);
});
