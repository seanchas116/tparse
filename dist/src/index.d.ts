export declare class Position {
    filePath: string;
    index: number;
    line: number;
    column: number;
    constructor(filePath: string, index: number, line: number, column: number);
    toString(): string;
}
export declare class Range {
    begin: Position;
    end: Position;
    constructor(begin: Position, end: Position);
}
export declare class Cache {
    cache: {};
    set<T>(parser: Parser<T>, index: number, result: Result<T>): void;
    get<T>(parser: Parser<T>, index: number): Result<T>;
}
export declare class FurthestFailure {
    furthest: Failure;
    add(failure: Failure): void;
}
export declare class State {
    text: string;
    position: Position;
    cache: Cache;
    furthestFailure: FurthestFailure;
    tracer: Tracer;
    constructor(text: string, position: Position, cache: Cache, furthestFailure: FurthestFailure, tracer: Tracer);
    substring(length: number): string;
    currentChar(): string;
    proceed(offset: number): State;
    static init(filePath: string, text: string, trace: boolean): State;
}
export declare class Success<T> {
    state: State;
    value: T;
    constructor(state: State, value: T);
    toString(): string;
}
export declare class Failure {
    state: State;
    expecteds: string[];
    constructor(state: State, expecteds: string[]);
    toString(): string;
}
export declare class SyntaxError implements Error {
    range: Range;
    expected: string[];
    found: string;
    name: string;
    message: string;
    error: Error;
    stack: string;
    constructor(range: Range, expected: string[], found: string);
}
export declare type Result<T> = Success<T> | Failure;
export declare class Tracer {
    last: string;
    trace<T>(result: Result<T>): void;
}
export declare class Parser<T> {
    private _parse;
    id: number;
    constructor(_parse: (state: State) => Result<T>);
    parseFrom(state: State): Result<T>;
    parse(filePath: string, text: string, trace?: boolean): T;
    map<U>(transform: (value: T) => U): Parser<U>;
    forEach(action: (value: T) => void): Parser<T>;
    repeat(min?: number, max?: number): Parser<T[]>;
    mayBe(): Parser<T>;
    withRange(): Parser<[T, Range]>;
    text(): Parser<string>;
    thenSkip<U>(parser: Parser<U>): Parser<T>;
    thenTake<U>(parser: Parser<U>): Parser<U>;
}
export declare function sequence<T0>(p0: Parser<T0>): Parser<[T0]>;
export declare function sequence<T0, T1>(p0: Parser<T0>, p1: Parser<T1>): Parser<[T0, T1]>;
export declare function sequence<T0, T1, T2>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>): Parser<[T0, T1, T2]>;
export declare function sequence<T0, T1, T2, T3>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>): Parser<[T0, T1, T2, T3]>;
export declare function sequence<T0, T1, T2, T3, T4>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>): Parser<[T0, T1, T2, T3, T4]>;
export declare function sequence<T0, T1, T2, T3, T4, T5>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>, p5: Parser<T5>): Parser<[T0, T1, T2, T3, T4, T5]>;
export declare function sequence<T0, T1, T2, T3, T4, T5, T6>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>, p5: Parser<T5>, p6: Parser<T6>): Parser<[T0, T1, T2, T3, T4, T5, T6]>;
export declare function sequence<T0, T1, T2, T3, T4, T5, T6, T7>(p0: Parser<T0>, p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>, p5: Parser<T5>, p6: Parser<T6>, p7: Parser<T7>): Parser<[T0, T1, T2, T3, T4, T5, T6, T7]>;
export declare function choose<T>(...parsers: Parser<T>[]): Parser<T>;
export declare function string(text: string): Parser<string>;
export declare function testChar(test: (char: string) => boolean, expected: string[]): Parser<string>;
export declare function regExp(re: RegExp): Parser<string>;
export declare const anyChar: Parser<string>;
export declare function lazy<T>(get: () => Parser<T>): Parser<T>;
