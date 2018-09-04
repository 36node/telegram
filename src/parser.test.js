import fs from "fs";
import Telegram from "./parser";

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
    urgentPointer: 0,
  });
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

const bmpFile = new Telegram()
  .nest("fileHeader", {
    type: bmpFileHeader,
  })
  .nest("infoHeader", {
    type: bmpInfoHeader,
  });

test("bmpFile1 decompress", () => {
  fs.readFile("examples/test.bmp", (err, data) => {
    if (err) throw err;
    expect(bmpFile.decompress(data)).toEqual({
      fileHeader: {
        type: "BM",
        size: 46182,
        reserved1: 0,
        reserved2: 0,
        offBits: 54,
      },
      infoHeader: {
        size: 40,
        width: 124,
        height: 124,
        planes: 1,
        bitCount: 24,
        compression: 0,
        sizeImage: 0,
        xPelsPerMeter: 0,
        yPelsPerMeter: 0,
        clrUsed: 0,
        clrImportant: 0,
      },
    });
  });
});

test("bmpFile2 decompress", () => {
  fs.readFile("examples/test2.bmp", (err, data) => {
    if (err) throw err;
    expect(bmpFile.decompress(data)).toEqual({
      fileHeader: {
        type: "BM",
        size: 151458,
        reserved1: 0,
        reserved2: 0,
        offBits: 138,
      },
      infoHeader: {
        size: 124,
        width: 259,
        height: 194,
        planes: 1,
        bitCount: 24,
        compression: 0,
        sizeImage: 151320,
        xPelsPerMeter: 3779,
        yPelsPerMeter: 3779,
        clrUsed: 0,
        clrImportant: 0,
      },
    });
  });
});

const oct2int = s => parseInt(s, 8);

const tarHeader = new Telegram()
  .string("name", { length: 100, stripNull: true })
  .string("mode", { length: 8, stripNull: true, formatter: oct2int })
  .string("uid", { length: 8, stripNull: true, formatter: oct2int })
  .string("gid", { length: 8, stripNull: true, formatter: oct2int })
  .string("size", { length: 12, stripNull: true, formatter: oct2int })
  .string("mtime", { length: 12, stripNull: true, formatter: oct2int })
  .string("chksum", { length: 8, stripNull: true, formatter: oct2int })
  .string("typeflag", { length: 1, stripNull: true, formatter: oct2int })
  .string("linkname", { length: 100, stripNull: true })
  .string("magic", { length: 6, stripNull: true })
  .string("version", { length: 2, stripNull: true, formatter: oct2int })
  .string("uname", { length: 32, stripNull: true })
  .string("gname", { length: 32, stripNull: true })
  .string("devmajor", { length: 8, stripNull: true, formatter: oct2int })
  .string("devminor", { length: 8, stripNull: true, formatter: oct2int })
  .string("prefix", { length: 155, stripNull: true })
  .skip(12);

const tarItem = new Telegram()
  .nest({
    type: tarHeader,
  })
  .skip(function(json) {
    return Math.ceil(json.size / 512) * 512;
  });

const tarArchive = new Telegram().array("files", {
  length: 8,
  type: tarItem,
});

test("tarFile decompress", () => {
  fs.readFile("examples/test.tar", (err, data) => {
    if (err) throw err;
    expect(tarArchive.decompress(data)).toEqual({
      files: [
        {
          name: "a/",
          mode: 493,
          uid: 501,
          gid: 20,
          size: 0,
          mtime: 1515642944,
          chksum: 5047,
          typeflag: 5,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/h",
          mode: 420,
          uid: 501,
          gid: 20,
          size: 44,
          mtime: 1515642944,
          chksum: 5152,
          typeflag: 0,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/c/",
          mode: 493,
          uid: 501,
          gid: 20,
          size: 0,
          mtime: 1515642936,
          chksum: 5199,
          typeflag: 5,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/b/",
          mode: 493,
          uid: 501,
          gid: 20,
          size: 0,
          mtime: 1515642920,
          chksum: 5196,
          typeflag: 5,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/b/e",
          mode: 420,
          uid: 501,
          gid: 20,
          size: 11,
          mtime: 1515642920,
          chksum: 5293,
          typeflag: 0,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/c/g",
          mode: 420,
          uid: 501,
          gid: 20,
          size: 33,
          mtime: 1515642936,
          chksum: 5299,
          typeflag: 0,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/c/d/",
          mode: 493,
          uid: 501,
          gid: 20,
          size: 0,
          mtime: 1515642929,
          chksum: 5346,
          typeflag: 5,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
        {
          name: "a/c/d/f",
          mode: 420,
          uid: 501,
          gid: 20,
          size: 22,
          mtime: 1515642929,
          chksum: 5448,
          typeflag: 0,
          linkname: "",
          magic: "ustar",
          version: 0,
          uname: "keichi",
          gname: "staff",
          devmajor: 0,
          devminor: 0,
          prefix: "",
        },
      ],
    });
  });
});
