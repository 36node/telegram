import fs from "fs";
import Telegram from "../src";

const SOI = new Telegram();

const EOI = new Telegram();

const APP0 = new Telegram()
  .endianess("big")
  .uint16("length")
  .string("id", {
    encoding: "ascii",
    zeroTerminated: true,
    validate: "JFIF",
  })
  .uint16("version")
  .uint8("unit")
  .uint16("xDensity")
  .uint16("yDensity")
  .uint8("thumbWidth")
  .uint8("thumbHeight")
  .array("thumbData", {
    type: "uint8",
    length: function(json) {
      return json.Xt * json.Yt * 3;
    },
  });

const COM = new Telegram()
  .endianess("big")
  .uint16("length")
  .string("comment", {
    encoding: "ascii",
    length: function(json) {
      return json.length - 2;
    },
  });

const SOS = new Telegram()
  .endianess("big")
  .uint16("length")
  .uint8("componentCount")
  .array("components", {
    type: new Telegram().uint8("id").uint8("dht"),
    length: "componentCount",
  })
  .uint8("spectrumStart")
  .uint8("spectrumEnd")
  .uint8("spectrumSelect");

const DQT = new Telegram()
  .endianess("big")
  .uint16("length")
  .array("tables", {
    type: new Telegram().uint8("precisionAndTableId").array("table", {
      type: "uint8",
      length: 64,
    }),
    length: function(json) {
      return (json.length - 2) / 65;
    },
  });

const SOF0 = new Telegram()
  .endianess("big")
  .uint16("length")
  .uint8("precision")
  .uint16("width")
  .uint16("height")
  .uint8("componentCount")
  .array("components", {
    type: new Telegram()
      .uint8("id")
      .uint8("samplingFactor")
      .uint8("quantizationTableId"),
    length: "componentCount",
  });

const Ignore = new Telegram()
  .endianess("big")
  .uint16("length")
  .skip(function(json) {
    return json.length - 2;
  });

const switchMarker = json => {
  switch (json.marker) {
    case 0xffd8:
      return SOI;
    case 0xffd9:
      return EOI;
    case 0xffe0:
      return APP0;
    case 0xffda:
      return SOS;
    case 0xffdb:
      return DQT;
    case 0xffc0:
      return SOF0;
    default:
      return Ignore;
  }
};

const Segment = new Telegram()
  .endianess("big")
  .uint16("marker")
  .nest("segment", { type: switchMarker });

const JPEG = new Telegram().array("segments", {
  type: Segment,
  length: 9,
});

fs.readFile("examples/test.jpg", function(err, data) {
  console.dir(JPEG.decompress(data), { depth: null, colors: true });
  // console.log(require("util").inspect(JPEG.decompress(data), { depth: null }));
});
