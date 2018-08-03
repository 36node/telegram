import Whisper from "./parser";

const tcpHeader = new Whisper()
  .endianess("big")
  .uint16("srcPort")
  .uint16("dstPort")
  .uint32("seq")
  .uint32("ack")
  .bit4("dataOffset")
  .bit6("reserved")
  .nest("flags", {
    type: new Whisper()
      .bit1("urg")
      .bit1("ack")
      .bit1("psh")
      .bit1("rst")
      .bit1("syn")
      .bit1("fin")
  })
  .uint16("windowSize")
  .uint16("checksum")
  .uint16("urgentPointer");

const tcpHeaderBuf = Buffer.from(
  "e8a203e108e177e13d20756b801829d3004100000101080a2ea486ba793310bc",
  "hex"
);

test("tcpHeader decompress", () => {
  expect(tcpHeader.decompress(tcpHeaderBuf)).toEqual({
    srcPort: 59554,
    dstPort: 993,
    seq: 148994017,
    ack: 1025537387,
    flags: { urg: 0, ack: 1, psh: 1, rst: 0, syn: 0, fin: 0 },
    dataOffset: 8,
    reserved: 0,
    windowSize: 10707,
    checksum: 65,
    urgentPointer: 0
  });
});
