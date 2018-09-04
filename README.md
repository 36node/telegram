# telegram

[![NPM version](https://img.shields.io/npm/v/telegram.svg?style=flat)](https://npmjs.com/package/telegram)
[![NPM downloads](https://img.shields.io/npm/dm/telegram.svg?style=flat)](https://npmjs.com/package/telegram)
[![CircleCI](https://circleci.com/gh/zzswang/telegram/tree/master.svg?style=shield)](https://circleci.com/gh/zzswang/telegram/tree/master)
[![codecov](https://codecov.io/gh/zzswang/telegram/branch/master/graph/badge.svg)](https://codecov.io/gh/zzswang/telegram)
[![donate](https://img.shields.io/badge/$-donate-ff69b4.svg?maxAge=2592000&style=flat)](https://github.com/zzswang/donate)

## Install

```bash
yarn add telegram
```

## Usage

```js
const telegram = require("telegram");

telegram();
```

## API

### new Telegram()
Constructs a Telegram object. Returned object represents a parser which parses
nothing.

### decompress(buffer)
Parse a `Buffer` object `buffer` with this parser and return an object as result.

### [u]int{8, 16, 32}{le, be}(name[, options])
Parse bytes as an integer and store it in a variable named `name`. `name` should consist only of alphanumeric characters and start with an alphabet.

Number of bits can be chosen from 8, 16 and 32. Byte-ordering can be either `l` for little endian or `b` for big endian. With no prefix, it parses as a signed number, with `u` prefixed as an unsigned number.

```javascript
var parser = new Telegram()
  // Signed 32-bit integer (little endian)
  .int32le("a")
  // Unsigned 8-bit integer
  .uint8("b")
  // Signed 16-bit integer (big endian)
  .int16be("c");
```

### bit\[1-64\](name, options)
Parse bytes as a bit field and store it in variable `name`. There are 64 methods from `bit1` to `bit64` each corresponding to 1-bit-length to 64-bits-length bit field.

### {float, double}{le, be}(name[, options])
Parse bytes as an floating-point value and store it in a variable named `name`.

```javascript
var parser = new Telegram()
  // 32-bit floating value (big endian)
  .floatbe("a")
  // 64-bit floating value (little endian)
  .doublele("b");
```

### string(name, options)
Parse bytes as a string. `options` is an object which can have
the following keys:

- `encoding` - (Optional, defaults to `utf8`) Specify which encoding to use.
  `"utf8"`, `"ascii"`, `"hex"` and else are valid. See
  [`Buffer.toString`](http://nodejs.org/api/buffer.html#buffer_buf_tostring_encoding_start_end)
  for more info.
- `length ` - (Optional) Length of the string. Can be a number, string or a function. Use number for statically sized arrays.
- `zeroTerminated` - (Optional, defaults to `false`) If true, then this parser reads until it reaches zero.
- `greedy` - (Optional, defaults to `false`) If true, then this parser reads until it reaches the end of the buffer. Will consume zero-bytes.
- `stripNull` - (Optional, must be used with `length`) If true, then strip null characters from end of the string.

### array(name, options)
Parse bytes as an array. `options` is an object which can have the following keys:

- `type` - (Required) Type of the array element. Can be a string or an user defined Parser object. If it's a string, you have to choose from [u]int{8, 16, 32}{le, be} | string.
- `length` -
  Length of the array. Can be a number, string or a function. Use number for statically sized arrays.

```javascript
var parser = new Telegram()
  // Statically sized array
  .array("data", {
    type: "int32",
    length: 8
  })

  // Dynamically sized array (references another variable)
  .uint8("dataLength")
  .array("data2", {
    type: "int32",
    length: "dataLength"
  })

  // Dynamically sized array (with some calculation)
  .array("data3", {
    type: "int32",
    length: function() {
      return this.dataLength - 1;
    } // other fields are available through this
  })

```

### nest([name,] options)
Execute an inner parser and store its result to key `name`. If `name` is null
or omitted, the result of the inner parser is directly embedded into the
current object. `options` is an object which can have the following keys:

- `type` - (Required) A `Parser` object.

### skip(length[, options])
Skip parsing for `length` bytes. If `options` has key named `type` and the value of `type` is `"bit"`, skip parsing for `length` bits.

### endianess(endianess)
Define what endianess to use in this parser. `endianess` can be either
`"little"` or `"big"`. The default endianess of `Parser` is set to big-endian.

```javascript
var parser = new Telegram()
  .endianess("little")
  // You can specify endianess explicitly
  .uint16be("a")
  .uint32le("a")
  // Or you can omit endianess (in this case, little-endian is used)
  .uint16("b")
  .int32("c");
```

### Common options
These are common options that can be specified in all parsers.

- `formatter` - Function that transforms the parsed value into a more desired
  form.
    ```javascript
    var parser = new Telegram().array("ipv4", {
      type: uint8,
      length: "4",
      formatter: function(arr) {
        return arr.join(".");
      }
    });
    ```

- `assert` - Do assertion on the parsed result (useful for checking magic
  numbers and so on). If `assert` is a `string` or `number`, the actual parsed
  result will be compared with it with `===` (strict equality check), and an
  exception is thrown if they mismatch. On the other hand, if `assert` is a
  function, that function is executed with one argument (parsed result) and if
  it returns false, an exception is thrown.

    ```javascript
    // simple maginc number validation
    var ClassFile = Telegram.start()
      .endianess("big")
      .uint32("magic", { assert: 0xcafebabe });
    ```

## Examples
See `examples` for more complex examples.

## Contributing

1.  Fork it!
2.  Create your feature branch: `git checkout -b my-new-feature`
3.  Commit your changes: `git commit -am 'Add some feature'`
4.  Push to the branch: `git push origin my-new-feature`
5.  Submit a pull request :D

## Author

**telegram** © [zzswang](https://github.com/zzswang), Released under the [MIT](./LICENSE) License.

Authored and maintained by zzswang with help from contributors ([list](https://github.com/zzswang/telegram/contributors)).

> [github.com/zzswang](https://github.com/zzswang) · GitHub [@zzswang](https://github.com/zzswang)
