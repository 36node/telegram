import fs from "fs";
import Telegram from "../src";

// C structure BITMAPFILEHEADER
// typedef struct tagBITMAPFILEHEADER {
//   WORD  bfType;
//   DWORD bfSize;
//   WORD  bfReserved1;
//   WORD  bfReserved2;
//   DWORD bfOffBits;
// } BITMAPFILEHEADER, *PBITMAPFILEHEADER;
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

// C structure BITMAPINFOHEADER definition
// typedef struct tagBITMAPINFOHEADER {
//     DWORD  biSize;
//     LONG   biWidth;
//     LONG   biHeight;
//     WORD   biPlanes;
//     WORD   biBitCount;
//     DWORD  biCompression;
//     DWORD  biSizeImage;
//     LONG   biXPelsPerMeter;
//     LONG   biYPelsPerMeter;
//     DWORD  biClrUsed;
//     DWORD  biClrImportant;
// } BITMAPINFOHEADER;
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

fs.readFile("examples/test.bmp", (err, data) => {
  if (err) throw err;
  console.log(bmpFile.decompress(data));
});
