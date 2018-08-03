import Whisper from "../src";

const ipHeader = new Whisper()
  .endianess("big")
  .bit4("version")
  .bit4("headerLength")
  .uint8("tos")
  .uint16("packetLength")
  .uint16("id")
  .bit3("offset")
  .bit13("fragOffset")
  .uint8("ttl")
  .uint8("protocol")
  .uint16("checksum")
  .array("src", {
    type: "uint8",
    length: 4
  })
  .array("dst", {
    type: "uint8",
    length: 4
  });

const buf = Buffer.from("450002c5939901002c06ef98adc24f6c850186d1", "hex");

console.log(ipHeader.decompress(buf));
