import fs from "fs";
import Telegram from "../src";

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

fs.readFile("examples/test.tar", function(err, data) {
  console.dir(tarArchive.decompress(data), { depth: null, colors: true });
});
