import { PRIMITIVE_TYPES, BIT_RANGE, NAME_MAP } from "./const";

const has = Object.prototype.hasOwnProperty;

export default class Telegram {
  constructor() {
    this.chain = [];
    this.bitChain = [];
    this.endian = "be";
    this.initialize();
  }

  initialize() {
    this.addPrimitiveType();
    this.addBitType();
  }

  addPrimitiveType() {
    Object.keys(PRIMITIVE_TYPES).forEach(type => {
      this[type.toLowerCase()] = (varName, options) =>
        this.setNextParser(type.toLowerCase(), varName, options);
      const typeWithoutEndian = type.replace(/BE|LE/, "").toLowerCase();
      if (typeof this[typeWithoutEndian] !== "function") {
        this[typeWithoutEndian] = (varName, options) =>
          this.setNextParser(typeWithoutEndian + this.endian, varName, options);
      }
    });
  }

  addBitType() {
    BIT_RANGE.forEach(i => {
      this[`bit${i}`] = (varName, options) => {
        options = options || {};
        options = { ...options, length: i };
        return this.setNextParser("bit", varName, options);
      };
    });
  }

  skip(length, options) {
    if (options && options.assert) {
      throw new Error("assert option on skip is not allowed.");
    }
    if (options === undefined) {
      options = {};
    }
    options.length = length;
    return this.setNextParser("skip", "", options);
  }

  string(varName, options) {
    if (!options.zeroTerminated && !options.length && !options.greedy) {
      throw new Error("Neither length, zeroTerminated, nor greedy is defined for string.");
    }
    if ((options.zeroTerminated || options.length) && options.greedy) {
      throw new Error("Greedy is mutually exclusive with length and zeroTerminated for string.");
    }
    if (options.stripNull && !(options.length || options.greedy)) {
      throw new Error("Length or greedy must be defined if stripNull is defined.");
    }

    options.encoding = options.encoding || "ascii";

    return this.setNextParser("string", varName, options);
  }

  array(varName, options) {
    if (!options.readUntil && !options.length && !options.lengthInBytes) {
      throw new Error("Length option of array is not defined.");
    }
    if (!options.type) {
      throw new Error("Type option of array is not defined.");
    }
    if (
      typeof options.type === "string" &&
      !(has.call(PRIMITIVE_TYPES, NAME_MAP[options.type]) || options.type === "string")
    ) {
      throw new Error(`Specified primitive type ${options.type} is not supported.`);
    }

    return this.setNextParser("array", varName, options);
  }

  nest(varName, options) {
    if (arguments.length === 1 && typeof varName === "object") {
      options = varName;
      varName = null;
    }

    if (!options.type) {
      throw new Error("Type option of nest is not defined.");
    }
    if (!(options.type instanceof Telegram) && !(typeof options.type === "function")) {
      throw new Error("Type option of nest must be a Telegram object.");
    }

    return this.setNextParser("nest", varName, options);
  }

  endianess(endianess) {
    switch (endianess.toLowerCase()) {
      case "little":
        this.endian = "le";
        break;
      case "big":
        this.endian = "be";
        break;
      default:
        throw new Error("Invalid endianess: " + endianess);
    }

    return this;
  }

  setNextParser(type, varName, options) {
    if (type === "bit") {
      const lastParser = this.chain[this.chain.length - 1];
      if (lastParser && lastParser.type === "bits") {
        lastParser.bitChain.push({ varName, options });
      } else {
        this.chain.push({ type: "bits", bitChain: [{ varName, options }] });
      }
    } else {
      this.chain.push({ type, varName, options });
    }
    return this;
  }

  decompress(buffer, needLength = false) {
    const input = { buffer, offset: 0, bitOffset: 0 };
    const { buf, result } = this.parse(input, {});
    if (needLength) {
      const length = buf.offset;
      return { result, length };
    }
    return result;
  }

  parse(buf, result) {
    for (const item of this.chain) {
      const typeProcessor = new typeClasses[item.type]({ endian: this.endian });
      typeProcessor.parse(buf, result, item);
    }
    return { buf, result };
  }
}

let typeClasses = {};

class Processor {
  constructor({ endian }) {
    this.endian = endian;
    this.buf = null;
    this.result = null;
    this.ownResult = null;
    this.item = null;
  }

  parse(buf, result, item) {
    this.buf = buf;
    this.result = result;
    this.item = item;
    this.initialize();
    this.realParse();
    this.assert();
    this.formatter();
    this.store();
    this.updateStatus();
  }

  initialize() {
    return;
  }

  realParse(buf, result, item) {
    return;
  }

  formatter(item) {
    const options = typeof item !== "undefined" ? item.options : this.item.options;
    if (options && typeof options.formatter === "function") {
      this.ownResult = options.formatter.call(this, this.ownResult);
    }
    return;
  }

  assert(item) {
    const options = typeof item !== "undefined" ? item.options : this.item.options;
    if (options && options.assert) {
      let isEqual = true;
      switch (typeof options.assert) {
        case "function":
          isEqual = options.assert.call(this, this.ownResult);
          break;
        case "number":
        case "string":
          isEqual = this.ownResult === options.assert;
          break;
        default:
          throw new Error("Assert option supports only numbers and string and assert functions.");
      }
      if (!isEqual) {
        throw new Error(`Assert error: ${this.item.varName} is ${this.ownResult}`);
      }
    }
    return;
  }

  store() {
    const { varName } = this.item;
    this.result[varName] = this.ownResult;
  }

  updateStatus() {
    return;
  }

  getResult() {
    return { buf: this.buf, result: this.result };
  }

  calcBitOffset(bitLength) {
    const { bitOffset } = this.buf;
    this.buf.bitOffset = (bitOffset + bitLength) % 8;
    const carry = Math.floor((bitOffset + bitLength) / 8);
    this.buf.offset += carry;
  }

  generateLength(option) {
    let length;
    if (typeof option === "number") {
      length = option;
    } else if (typeof option === "function") {
      length = option.call(this, this.result);
    } else if (typeof option === "string") {
      length = this.result[option];
    }
    return length;
  }
}

Object.keys(PRIMITIVE_TYPES).forEach(type => {
  typeClasses[`${type.toLowerCase()}`] = class extends Processor {
    realParse() {
      const { buffer, offset } = this.buf;
      this.ownResult = buffer[`read${type}`](offset);
    }

    updateStatus() {
      this.buf.offset += PRIMITIVE_TYPES[type];
    }
  };
});

class array extends Processor {
  constructor(options) {
    super(options);
    this.ownItemResult = null;
    this.type = null;
    this.typeName = null;
  }

  initialize() {
    this.ownResult = [];
    this.defineType();
  }

  defineType() {
    const {
      options: { type },
    } = this.item;
    if (typeof type === "string") {
      if (Object.keys(PRIMITIVE_TYPES).includes(NAME_MAP[type])) {
        this.typeName = "PRIMITIVE_TYPES";
      } else {
        this.typeName = type;
      }
      this.type = NAME_MAP[type];
    } else if (type instanceof Telegram) {
      this.typeName = "Telegram";
      this.type = type;
    }
  }

  realParse() {
    let i = 0;
    const {
      options: { length, readUntil },
    } = this.item;
    if (length) {
      const arrayLength = this.generateLength(length);
      for (i = 0; i < arrayLength; i++) {
        this.parseItem();
      }
    } else if (readUntil === "eof") {
      while (this.buf.offset < this.buf.buffer.length) {
        this.parseItem();
      }
    } else if (typeof readUntil === "number") {
      while (this.buf.offset < this.buf.buffer.length - readUntil) {
        this.parseItem();
      }
    }
  }

  parseItem() {
    this.realParseItem();
    this.pushItem();
    this.updateItemStatus();
  }

  realParseItem() {
    const { buffer, offset } = this.buf;
    switch (this.typeName) {
      case "PRIMITIVE_TYPES":
        this.ownItemResult = buffer[`read${this.type}`](offset);
        break;
      case "string":
        const {
          options: { subOptions },
        } = this.item;
        if (subOptions.hasOwnProperty("length")) {
          subOptions.length = this.generateLength(subOptions.length);
        }
        const stringParser = new Telegram().string("tmp", subOptions);
        const { result: str_result } = stringParser.parse(this.buf, {});
        this.ownItemResult = str_result.tmp;
        break;
      case "Telegram":
        const { result: new_result } = this.type.parse(this.buf, {});
        this.ownItemResult = new_result;
        break;
      default:
        break;
    }
  }

  pushItem() {
    this.ownResult.push(this.ownItemResult);
  }

  updateItemStatus() {
    if (this.typeName === "PRIMITIVE_TYPES") {
      this.buf.offset += PRIMITIVE_TYPES[this.type];
    }
  }
}

class bits extends Processor {
  constructor(options) {
    super(options);
    this.bitChain = null;
    this.bitItem = null;
  }

  swap(bitLength) {
    const length = Math.ceil(bitLength / 8);
    const { buffer, offset } = this.buf;
    const sliced = buffer.slice(offset, offset + length);
    const hexBuf = sliced.toString("hex").match(/.{1,2}/g);
    let len = offset + length - 1;
    for (const hex of hexBuf) {
      buffer.write(hex, len--, 1, "hex");
    }
    this.buf.buffer = buffer;
  }

  initialize() {
    const { bitChain } = this.item;
    this.bitChain = bitChain;
    const bitLength = this.bitChain.reduce((sum, item) => sum + item.options.length, 0);
    const isBigEndian = this.endian === "be";
    if (!isBigEndian) {
      this.swap(bitLength);
    }
  }

  parse(buf, result, item) {
    this.buf = buf;
    this.result = result;
    this.item = item;
    this.initialize();
    this.realParse();
  }

  realParse() {
    for (const bitItem of this.bitChain) {
      this.bitItem = bitItem;
      this.parseBit();
    }
  }

  parseBit() {
    this.realParseBit();
    this.formatter(this.bitItem);
    this.assert(this.bitItem);
    this.store();
    this.updateStatus();
  }

  realParseBit() {
    const { buffer, offset, bitOffset } = this.buf;
    const {
      options: { length },
    } = this.bitItem;
    const byteToBeRead = Math.ceil((bitOffset + length) / 8);
    let tmp = 0;
    switch (byteToBeRead) {
      case 1:
        tmp = buffer.readUInt8(offset);
        break;
      case 2:
        tmp = buffer.readUInt16BE(offset);
        break;
      case 3:
        const tmp1 = buffer.readUInt16BE(offset);
        const tmp2 = buffer.readUInt8(offset + 2);
        tmp = (tmp1 << 8) | tmp2;
        break;
      case 4:
        tmp = buffer.readUInt32BE(offset);
        break;
      case 5:
        const tmp3 = buffer.readUInt32BE(offset);
        const tmp4 = buffer.readUInt8(offset + 4);
        tmp = (tmp3 << 8) | tmp4;
        break;
      default:
        break;
    }
    const rshift = (bitOffset + length) % 8 ? 8 * byteToBeRead - (bitOffset + length) : 0;
    const mask = (1 << length) - 1;
    this.ownResult = (tmp >> rshift) & mask;
  }

  store() {
    const { varName } = this.bitItem;
    this.result[varName] = this.ownResult;
  }

  updateStatus() {
    const {
      options: { length },
    } = this.bitItem;
    this.calcBitOffset(length);
  }
}

class nest extends Processor {
  realParse() {
    const {
      options: { type },
    } = this.item;
    if (type instanceof Telegram) {
      const { result: new_result } = type.parse(this.buf, {});
      this.ownResult = new_result;
    } else if (typeof type === "function") {
      const subParser = type.call(this, this.result);
      if (subParser instanceof Telegram) {
        const { result: new_result } = subParser.parse(this.buf, {});
        this.ownResult = new_result;
      } else {
        throw new Error("Type option of nest must be a Telegram object.");
      }
    }
  }

  store() {
    const { varName } = this.item;
    if (varName) {
      this.result[varName] = this.ownResult;
    } else {
      Object.assign(this.result, this.ownResult);
    }
  }
}

class skip extends Processor {
  store() {
    return;
  }

  updateStatus() {
    const {
      options: { length, type },
    } = this.item;
    const skipLength = this.generateLength(length);
    if (type === "bit") {
      this.calcBitOffset(skipLength);
    } else {
      this.buf.offset += skipLength;
    }
  }
}

class string extends Processor {
  constructor(options) {
    super(options);
    this.stringLength = null;
    this.isZeroTerminated = false;
  }

  realParse() {
    const {
      options: { length, encoding, zeroTerminated, greedy, stripNull },
    } = this.item;
    const { buffer, offset } = this.buf;
    // calc the length of string
    const start = offset;
    if (length && zeroTerminated) {
      let i = start;
      const len = this.generateLength(length);
      for (i; i < start + len; i++) {
        if (buffer.readUInt8(i) === 0) {
          break;
        }
      }
      this.stringLength = i - start;
      this.isZeroTerminated = this.stringLength === len ? false : true;
    } else if (length) {
      this.stringLength = this.generateLength(length);
    } else if (zeroTerminated) {
      let i = start;
      for (i; i < buffer.length; i++) {
        if (buffer.readUInt8(i) === 0) {
          break;
        }
      }
      this.stringLength = i - start;
      this.isZeroTerminated = i === buffer.length ? false : true;
    } else if (greedy) {
      this.stringLength = buffer.length - start;
    }

    this.ownResult = buffer.toString(encoding, offset, offset + this.stringLength);
    if (stripNull) {
      this.ownResult = this.ownResult.replace(/\0/g, "");
    }
  }

  store() {
    const { varName } = this.item;
    this.result[varName] = this.ownResult;
  }

  updateStatus() {
    this.buf.offset += this.isZeroTerminated ? this.stringLength + 1 : this.stringLength;
  }
}

typeClasses.array = array;
typeClasses.bits = bits;
typeClasses.nest = nest;
typeClasses.skip = skip;
typeClasses.string = string;
