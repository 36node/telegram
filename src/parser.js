import { PRIMITIVE_TYPES, BIT_RANGE, NAME_MAP } from "./const";

const has = Object.prototype.hasOwnProperty;

export default class Whisper {
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

    return this.setNextParser("skip", "", { length });
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

    options.encoding = options.encoding || "utf8";

    return this.setNextParser("string", varName, options);
  }

  array(varName, options) {
    if (!options.readUntil && !options.length && !options.lengthInBytes) {
      throw new Error("Length option of array is not defined.");
    }
    if (!options.type) {
      throw new Error("Type option of array is not defined.");
    }
    if (typeof options.type === "string" && !has.call(PRIMITIVE_TYPES, NAME_MAP[options.type])) {
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
    if (!(options.type instanceof Whisper)) {
      throw new Error("Type option of nest must be a Parser object.");
    }
    if (!(options.type instanceof Whisper) && !varName) {
      throw new Error("options.type must be a object if variable name is omitted.");
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

  decompress(buffer) {
    const input = { buffer, offset: 0, bitOffset: 0 };
    const { result } = this.parse(input, {});
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
    this.formatter();
    this.assert();
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
          isEqual = this.ownResult === options.assert;
          break;
        default:
          throw new Error("Assert option supports only numbers and assert functions.");
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
      options: { length }
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
    const { bitOffset } = this.buf;
    const {
      options: { length }
    } = this.bitItem;
    this.buf.bitOffset = (bitOffset + length) % 8;
    const carry = Math.floor((bitOffset + length) / 8);
    this.buf.offset += carry;
  }
}

class nest extends Processor {
  realParse() {
    const {
      options: { type }
    } = this.item;
    if (type instanceof Whisper) {
      const { result: new_result } = type.parse(this.buf, {});
      this.ownResult = new_result;
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
      options: { type }
    } = this.item;
    if (typeof type === "string") {
      this.typeName = "PRIMITIVE_TYPES";
      this.type = NAME_MAP[type];
    } else if (type instanceof Whisper) {
      this.typeName = "WHISPER";
      this.type = type;
    }
  }

  realParse() {
    let i = 0;
    const {
      options: { length }
    } = this.item;
    const arrayLength = typeof length === "number" ? length : this.result[length];
    for (i = 0; i < arrayLength; i++) {
      this.parseItem();
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
      case "WHISPER":
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

class skip extends Processor {
  store() {
    return;
  }

  updateStatus() {
    const {
      options: { length }
    } = this.item;
    this.buf.offset += length;
  }
}

typeClasses.nest = nest;
typeClasses.array = array;
typeClasses.skip = skip;
typeClasses.bits = bits;
