import * as util from "util";
const colors = require("colors/safe");

function unionStrings(xs: string[], ys: string[]) {
  const obj = {};
  for (const x of xs) {
    obj[x] = null;
  }
  for (const y of ys) {
    obj[y] = null;
  }
  return Object.keys(obj);
}

export
class Position {
  constructor(
    public filePath: string,
    public index: number,
    public line: number,
    public column: number
  ) {}

  toString() {
    return `${this.filePath}:${this.line}:${this.column}`;
  }
}

export
class Range {
  constructor(public begin: Position, public end: Position) {
  }
}

function cacheKey<T>(parser: Parser<T>, index: number) {
  return `${parser.id} ${index}`;
}

export
class Cache {
  cache = {};

  set<T>(parser: Parser<T>, index: number, result: Result<T>) {
    this.cache[cacheKey(parser, index)] = result;
  }
  get<T>(parser: Parser<T>, index: number): Result<T> {
    return this.cache[cacheKey(parser, index)];
  }
}

export
class FurthestFailure {
  furthest: Failure;

  add(failure: Failure) {
    if (!this.furthest) {
      this.furthest = failure;
    }
    const {index} = failure.state.position;
    const {index: furthestIndex} = this.furthest.state.position;
    if (furthestIndex == index) {
      this.furthest = new Failure(this.furthest.state, unionStrings(this.furthest.expecteds, failure.expecteds));
    }
    else if (furthestIndex < index) {
      this.furthest = failure;
    }
  }
}

export
class State {

  constructor(public text: string, public position: Position, public cache: Cache, public furthestFailure: FurthestFailure, public tracer: Tracer) {
  }

  substring(length: number) {
    return this.text.slice(this.position.index, this.position.index + length);
  }

  currentChar() {
    return this.text.charAt(this.position.index);
  }

  proceed(offset: number) {
    offset = Math.min(this.text.length - this.position.index, offset);
    const proceedStr = this.substring(offset);
    const proceedLines = proceedStr.split(/\r\n|\n|\r/);
    const lastLineLength = proceedLines[proceedLines.length - 1].length;

    const newIndex = this.position.index + offset;
    const newLine = this.position.line + proceedLines.length - 1;
    const newColumn = (1 < proceedLines.length) ? lastLineLength + 1 : this.position.column + lastLineLength;

    const newPos = new Position(this.position.filePath, newIndex, newLine, newColumn);
    return new State(this.text, newPos, this.cache, this.furthestFailure, this.tracer);
  }

  static init(filePath: string, text: string, trace: boolean) {
    return new State(text, new Position(filePath, 0, 1, 1), new Cache(), new FurthestFailure(), trace ? new Tracer() : null);
  }
}

export
class Success<T> {
  constructor(public state: State, public value: T) {
  }
  toString() {
    return `[Success position=${this.state.position} value=${this.value}]`;
  }
}

export
class Failure {
  constructor(public state: State, public expecteds: string[]) {
  }
  toString() {
    return `[Failure position=${this.state.position} expected=[${this.expecteds}]`;
  }
}

export
class SyntaxError implements Error {
  name = "SyntaxError";
  message: string;
  error: Error;

  get stack() {
    return this.error["stack"];
  }

  constructor(public position: Position, public expected: string[], public found: string) {
    this.error = new Error();
    this.name = "SyntaxError";
    this.message = `[${position}]: Expected ${
      expected.map(e => `'${e}'`).join(", ")
    }; found '${found}'`;
  }
}

util.inherits(SyntaxError, Error);

export
type Result<T> = Success<T> | Failure;

export
class Tracer {
  last = "";

  trace<T>(result: Result<T>) {
    const message = result.toString();
    if (message == this.last) {
      return;
    }
    this.last = message;
    if (result instanceof Failure) {
      console.log(colors.red(message));
    } else {
      console.log(colors.green(message));
    }
  }
}

interface ParserOpts {

}

let parserId = 0;

export
class Parser<T> {
  id = parserId++;

  constructor(private _parse: (state: State) => Result<T>) {
  }

  parseFrom(state: State): Result<T> {
    const index = state.position.index;
    let result = state.cache.get(this, index);
    if (!result) {
      result = this._parse(state);
      state.cache.set(this, index, result);
    }
    if (state.tracer) {
      state.tracer.trace(result);
    }
    if (result instanceof Failure) {
      state.furthestFailure.add(result);
    }
    return result;
  }

  parse(filePath: string, text: string, trace = false) {
    const state = State.init(filePath, text, trace);
    const result = this.parseFrom(state);
    if (result instanceof Success) {
      if (result.state.position.index == text.length) {
        return result.value;
      }
      const nextState = result.state.proceed(1);
      throw new SyntaxError(nextState.position, ["[EOS]"], nextState.substring(1));
    }
    const furthestFailure = state.furthestFailure.furthest;
    throw new SyntaxError(furthestFailure.state.position, [...furthestFailure.expecteds], furthestFailure.state.currentChar());
  }

  parseString(text: string, trace = false) {
    return this.parse("", text, trace);
  }

  map<U>(transform: (value: T) => U): Parser<U> {
    return new Parser<U>(state => {
      const result = this.parseFrom(state);
      if (result instanceof Failure) {
        return result;
      }
      else if (result instanceof Success) {
        return new Success(result.state, transform(result.value));
      }
    });
  }

  forEach(action: (value: T) => void) {
    return this.map(x => {
      action(x);
      return x;
    });
  }

  repeat(min = 0, max = Infinity) {
    return new Parser(state => {
      const values: T[] = [];
      for (let count = 0; true; ++count) {
        if (max <= count) {
          return new Success(state, values);
        }

        const result = this.parseFrom(state);
        if (result instanceof Success) {
          state = result.state;
          values.push(result.value);
        } else if (result instanceof Failure) {
          if (count < min) {
            return result;
          } else {
            return new Success(result.state, values);
          }
        }
      }
    });
  }

  mayBe() {
    return this.repeat(0, 1).map(xs => xs[0]);
  }

  withRange(): Parser<[T, Range]> {
    return new Parser<[T, Range]>(state => {
      const begin = state.position;
      const result = this.parseFrom(state);
      if (result instanceof Success) {
        const end = result.state.position;
        const valueWithRange: [T, Range] = [result.value, new Range(begin, end)];
        return new Success(result.state, valueWithRange);
      } else if (result instanceof Failure) {
        return result;
      }
    });
  }

  text(): Parser<string> {
    return new Parser<string>(state => {
      const begin = state.position.index;
      const result = this.parseFrom(state);
      const end = result.state.position.index;
      const text = state.text.slice(begin, end);
      if (result instanceof Success) {
        return new Success(result.state, text);
      } else if (result instanceof Failure) {
        return result;
      }
    });
  }

  thenSkip<U>(parser: Parser<U>): Parser<T> {
    return sequence(this, parser).map(([a, b]) => a);
  }
  thenTake<U>(parser: Parser<U>): Parser<U> {
    return sequence(this, parser).map(([a, b]) => b);
  }
}

export function sequence<T0>(p0: Parser<T0>): Parser<[T0]>
export function sequence<T0, T1>(p0: Parser<T0>, p1: Parser<T1>): Parser<[T0, T1]>
export function sequence<T0, T1, T2>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>): Parser<[T0, T1, T2]>
export function sequence<T0, T1, T2, T3>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>): Parser<[T0, T1, T2, T3]>
export function sequence<T0, T1, T2, T3, T4>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>): Parser<[T0, T1, T2, T3, T4]>
export function sequence<T0, T1, T2, T3, T4, T5>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>, p5: Parser<T5>): Parser<[T0, T1, T2, T3, T4, T5]>
export function sequence<T0, T1, T2, T3, T4, T5, T6>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>, p5: Parser<T5>, p6: Parser<T6>): Parser<[T0, T1, T2, T3, T4, T5, T6]>
export function sequence<T0, T1, T2, T3, T4, T5, T6, T7>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>, p5: Parser<T5>, p6: Parser<T6>, p7: Parser<T7>): Parser<[T0, T1, T2, T3, T4, T5, T6, T7]>

export
function sequence(...parsers: any[]): Parser<any> {
  return new Parser(state => {
    const values: any[] = [];

    for (const parser of parsers) {
      const result = parser.parseFrom(state);
      if (result instanceof Success) {
        state = result.state;
        values.push(result.value);
      } else if (result instanceof Failure) {
        return result;
      }
    }
    return new Success(state, values);
  });
}

// parser1 / parser2 / ...
export
function choose<T>(...parsers: Parser<T>[]): Parser<T> {
  return new Parser<T>(state => {
    const expecteds: string[] = [];

    for (const parser of parsers) {
      const result = parser.parseFrom(state);
      if (result instanceof Success) {
        return result;
      } else if (result instanceof Failure) {
        for (const expected of result.expecteds) {
          expecteds.push(expected);
        }
      }
    }

    return new Failure(state, expecteds);
  });
}

// "string"
export
function string(text: string): Parser<string> {
  return new Parser(state => {
    const substr = state.substring(text.length);
    if (substr == text) {
      return new Success(state.proceed(text.length), text);
    }
    else {
      return new Failure(state, [text]);
    }
  });
}

export
function testChar(test: (char: string) => boolean, expected: string[]): Parser<string> {
  return new Parser(state => {
    const substr = state.substring(1);
    if (test(substr)) {
      return new Success(state.proceed(1), substr);
    }
    else {
      return new Failure(state, expected);
    }
  });
}

// /[0-9a-zA-Z]/
export
function regExp(re: RegExp): Parser<string> {
  return testChar(c => !!c.match(re), [re.toString()]);
}

export
const anyChar = testChar((c) => c.length == 1, ["[any character]"]);

export
function lazy<T>(get: () => Parser<T>) {
  let parser: Parser<T>;
  return new Parser<T>(state => {
    if (!parser) {
      parser = get();
    }
    return parser.parseFrom(state);
  });
}
