const PRIMITIVE_TYPES = {
  UInt8: 1,
  UInt16LE: 2,
  UInt16BE: 2,
  UInt32LE: 4,
  UInt32BE: 4,
  Int8: 1,
  Int16LE: 2,
  Int16BE: 2,
  Int32LE: 4,
  Int32BE: 4,
  FloatLE: 4,
  FloatBE: 4,
  DoubleLE: 8,
  DoubleBE: 8
};

const SPECIAL_TYPES = {
  Array: null,
  Skip: null,
  Nest: null,
  Bit: null
};

const BIT_RANGE = [...Array(33).keys()].slice(1);

let NAME_MAP = {};
Object.keys({ ...PRIMITIVE_TYPES, ...SPECIAL_TYPES }).forEach(type => {
  NAME_MAP[type.toLowerCase()] = type;
});

export { PRIMITIVE_TYPES, SPECIAL_TYPES, BIT_RANGE, NAME_MAP };
