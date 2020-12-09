import { PRIMITIVE_TYPES, BIT_RANGE, NAME_MAP } from "./const";
import { readBufferBits, readUIntBits, swapBuffer, writeBufferBits } from "./lib";

const has = Object.prototype.hasOwnProperty;

/**
 * 解析使用的class
 */
let parserClasses = {};

/**
 * 压缩使用的class
 */
let compresserClasses = {};

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
    const buf = { buffer, offset: 0, bitOffset: 0 };
    const result = {};

    try {
      this.parse(buf, result);
    } catch (err) {
      result.err = err.message;
    }

    if (needLength) {
      const length = buf.offset;
      return { result, length };
    }
    return result;
  }

  initializeCompresser(obj) {
    // 初始化 compresser

    this.compressers = this.chain.map(
      item => new compresserClasses[item.type]({ endian: this.endian, item, obj })
    );

    this.compressBitsLength = this.compressers.reduce((acc, cur) => {
      return acc + cur.getBitsLength();
    }, 0);
  }

  compress(obj) {
    this.initializeCompresser(obj);

    // 初始化 compresser
    const compressers = this.compressers;

    // 结果buffer的长度
    const resultBufferLength = Math.ceil(this.compressBitsLength / 8);

    // 申请结果buffer的空间
    const resultBuffer = Buffer.alloc(resultBufferLength);

    // 结果写入buffer

    // 记录需要swap的部分
    const swapPart = [];

    let offset = 0;
    compressers.forEach(compresser => {
      const ret = compresser.compress(obj);
      const resultBits = readBufferBits(ret, 0, compresser.getBitsLength());

      const bitsLength = compresser.getBitsLength();

      if (compresser.item.type === "bits") {
        swapPart.push({
          offset: Math.floor(offset / 8),
          length: Math.ceil(bitsLength / 8),
        });
      }

      writeBufferBits(resultBuffer, resultBits, offset);
      offset += bitsLength;
    });

    if (swapPart.length > 0 && this.endian === "le") {
      for (let swap of swapPart) {
        swapBuffer(resultBuffer, swap.offset, swap.length);
      }
    }

    return resultBuffer;
  }

  parse(buf, result) {
    for (const item of this.chain) {
      const typeProcessor = new parserClasses[item.type]({ endian: this.endian });
      typeProcessor.parse(buf, result, item);
    }
    return { buf, result };
  }
}

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
    this.store();
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

/**
 * 压缩器
 */
class Compresser {
  constructor({ endian, item, obj }) {
    this.endian = endian;
    this.item = item;
    this.obj = obj;
    this.initialize();
  }

  generateLength(option) {
    let length;
    if (typeof option === "number") {
      length = option;
    } else if (typeof option === "function") {
      length = option.call(this, this.obj);
    } else if (typeof option === "string") {
      length = this.obj[option];
    }
    return length;
  }

  initialize() {
    const { varName, options = {} } = this.item;

    const { encoder } = options;

    if (encoder && typeof encoder === "function") {
      this.value = encoder(this.obj[varName]);
    } else {
      this.value = this.obj[varName];
    }
  }

  /**
   * 执行压缩
   * @param {*} obj 压缩的对象
   */
  compress() {
    return this.realCompress();
  }

  // 获取当前数据需要的位数
  getBitsLength() {
    return 0;
  }

  realCompress() {
    return;
  }
}

Object.keys(PRIMITIVE_TYPES).forEach(type => {
  parserClasses[`${type.toLowerCase()}`] = class extends Processor {
    realParse() {
      const { buffer, offset } = this.buf;
      this.ownResult = buffer[`read${type}`](offset);
    }

    updateStatus() {
      this.buf.offset += PRIMITIVE_TYPES[type];
    }
  };

  // initial compresser
  compresserClasses[`${type.toLowerCase()}`] = class extends Compresser {
    realCompress() {
      const ret = Buffer.alloc(PRIMITIVE_TYPES[type]);

      ret[`write${type}`](this.value);
      return ret;
    }

    getBitsLength() {
      return PRIMITIVE_TYPES[type] * 8;
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

class arrayCompresser extends Compresser {
  initialize() {
    super.initialize();

    if (!Array.isArray(this.value)) {
      throw new TypeError(this.item.varName + " value should be value");
    }

    const {
      options: { length, type, subOptions },
    } = this.item;

    let arrayLength;
    const valueLength = this.value.length;

    if (length) {
      arrayLength = this.generateLength(length) || 0;
      if (valueLength !== arrayLength) {
        throw new RangeError(this.item.varName + " value length not equal length option");
      }
    } else {
      // 如果配置中没有 length 则value中的所有数据被写入
      arrayLength = valueLength;
    }
    this.resultBitLengths = [];

    // 压缩数据
    if (typeof type === "string") {
      if (!Object.keys(NAME_MAP).includes(type)) {
        throw new TypeError(
          this.item.varName + " type shoule be one of " + Object.keys(NAME_MAP).join(",")
        );
      }
      this.resultBuffers = this.value.map(val => {
        const compresser = new compresserClasses[type]({
          endian: this.endian,
          item: {
            varName: "tmp",
            options: subOptions,
            type,
          },
          obj: { tmp: val, ...this.obj },
        });

        this.resultBitLengths.push(compresser.getBitsLength());
        return compresser.compress({ tmp: val });
      });
      this.type = NAME_MAP[type];
    } else if (type instanceof Telegram) {
      this.type = type;

      this.resultBuffers = this.value.map(val => {
        const buf = type.compress(val);
        this.resultBitLengths.push(type.compressBitsLength);
        return buf;
      });
    }
  }

  getBitsLength() {
    return this.resultBitLengths.reduce((len, cur) => {
      return len + cur;
    }, 0);
  }

  realCompress() {
    // 结果buffer的长度
    const resultBufferLength = Math.ceil(this.getBitsLength() / 8);

    // 申请结果buffer的空间
    const resultBuffer = Buffer.alloc(resultBufferLength);
    let offset = 0;

    this.resultBuffers.forEach((buf, index) => {
      const bits = readBufferBits(buf, 0, this.resultBitLengths[index]);
      writeBufferBits(resultBuffer, bits, offset);
      offset += this.resultBitLengths[index];
    });

    return resultBuffer;
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

class bitsCompresser extends Compresser {
  initialize() {
    const { bitChain = [] } = this.item;
    this.bitChain = bitChain;

    this.value = this.bitChain.reduce((acc, cur) => {
      const { varName, options = {} } = cur;
      const { encoder } = options;

      if (encoder && typeof encoder === "function") {
        acc[varName] = encoder(this.obj[varName]);
      } else {
        acc[varName] = this.obj[varName];
      }

      return acc;
    }, {});
  }

  /**
   * 压缩
   * @param {object} value
   */
  realCompress() {
    const bitsLength = this.getBitsLength();
    const byteLength = Math.ceil(bitsLength / 8);
    const retBuf = Buffer.alloc(byteLength);

    let bitOffset = 0;
    this.bitChain.forEach(bitItem => {
      const {
        options: { length },
        varName,
      } = bitItem;

      const val = this.value[varName];

      const valBits = readUIntBits(val, length);

      writeBufferBits(retBuf, valBits, bitOffset);

      bitOffset += length;
    });

    return retBuf;
  }

  getBitsLength() {
    return this.bitChain
      ? this.bitChain.reduce((bitLength, bitItem) => {
          const {
            options: { length },
          } = bitItem;
          return bitLength + length;
        }, 0)
      : 0;
  }
}

class nest extends Processor {
  constructor(opts) {
    super(opts);
    this.ownResult = {};
  }

  realParse() {
    let {
      options: { type },
    } = this.item;

    // 支持函数
    if (typeof type === "function") {
      type = type.call(this, this.result);
    }

    if (!type instanceof Telegram) {
      throw new Error("Type option of nest must be a Telegram object.");
    }

    type.parse(this.buf, this.ownResult);
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

class nestCompresser extends Compresser {
  initialize() {
    super.initialize();
    if (!this.type) {
      let {
        options: { type },
        varName,
      } = this.item;

      // 支持函数
      if (typeof type === "function") {
        type = type.call(this, this.obj);
      }

      if (!type instanceof Telegram) {
        throw new Error("Type option of nest must be a Telegram object.");
      }

      if (varName) {
        type.initializeCompresser(this.value);
      } else {
        type.initializeCompresser(this.obj);
      }
      this.type = type;
    }
  }

  getBitsLength() {
    return this.type.compressBitsLength;
  }

  realCompress() {
    const { varName } = this.item;

    if (varName) {
      return this.type.compress(this.value);
    } else {
      return this.type.compress(this.obj);
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

    // TODO: 加上越界判断后，32960 中测试用例好多都通不过了，后面统一建issue处理
    // if (this.buf.offset >= this.buf.buffer.length) {
    //   throw new Error("skip is out of bounds");
    // }
  }
}

class skipCompresser extends Compresser {
  getBitsLength() {
    const {
      options: { length, type },
    } = this.item;

    const skipLength = this.generateLength(length);

    if (type === "bit") {
      return skipLength;
    } else {
      return skipLength * 8;
    }
  }

  realCompress() {
    const {
      options: { fill = 0 },
    } = this.item;

    const bitsLength = this.getBitsLength();
    const byteLength = Math.ceil(bitsLength / 8);
    const retBuf = Buffer.alloc(byteLength);
    retBuf.fill(fill);
    return retBuf;
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

class stringCompresser extends Compresser {
  initialize() {
    super.initialize();
    const {
      options: { length, zeroTerminated },
    } = this.item;

    /**
     * @type {string}
     */
    const value = this.value;

    if (!zeroTerminated && !length && length < 0) {
      throw new RangeError("length should exist and greater than 0");
    }

    // 最终需要被写入字符串的长度
    this.writeLength = 0;
    // 最终需要被写入的字符串
    this.writeStr = "";

    // 如果有配置length
    // 待验证字符串在length范围内
    // 如果字符串中有 '0' 被终止，则待写入的字符串长度为 '0' 之前的 加上 '0' 字符 的长度
    // 如果没有被终止，则应该为配置的length
    if (zeroTerminated && length) {
      const len = this.generateLength(length);
      const val = value.substr(0, len);
      const shouldTerminate = val.indexOf("\0") !== -1;
      if (shouldTerminate) {
        this.writeStr = val.split("\0")[0] + "\0";
        this.writeLength = this.writeStr.length;
      } else {
        this.writeStr = val;
        this.writeLength = len;
      }
    }

    // 没有配置length
    // 如果字符串中有 '0' 被终止，则待写入的字符串长度为 '0' 之前的 加上 '0' 字符 的长度
    // 如果字符串中没有 '0', 则去字符串本身 加上 '0' 字符的长度
    if (zeroTerminated && !length) {
      const val = value;
      const shouldTerminate = val.indexOf("\0") !== -1;
      if (shouldTerminate) {
        this.writeStr = val.split("\0")[0] + "\0";
      } else {
        this.writeStr = val + "\0";
      }
      this.writeLength = this.writeStr.length;
    }

    // 只配置了length
    if (length) {
      this.writeLength = this.generateLength(length);
      this.writeStr = value;
    }
  }

  getBitsLength() {
    return this.writeLength * 8;
  }

  realCompress() {
    const {
      options: { encoding },
    } = this.item;

    // const value = this.extraValue();
    // return Buffer.from(value, encoding);
    const buf = Buffer.alloc(this.writeLength);
    buf.fill(0);
    buf.write(this.writeStr, encoding);
    return buf;
  }
}

parserClasses.array = array;
parserClasses.bits = bits;
parserClasses.nest = nest;
parserClasses.skip = skip;
parserClasses.string = string;

compresserClasses.array = arrayCompresser;
compresserClasses.bits = bitsCompresser;
compresserClasses.nest = nestCompresser;
compresserClasses.skip = skipCompresser;
compresserClasses.string = stringCompresser;
