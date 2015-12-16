var util = require("util");
var colors = require("colors/safe");
function unionStrings(xs, ys) {
    var obj = {};
    for (var _i = 0; _i < xs.length; _i++) {
        var x = xs[_i];
        obj[x] = null;
    }
    for (var _a = 0; _a < ys.length; _a++) {
        var y = ys[_a];
        obj[y] = null;
    }
    return Object.keys(obj);
}
var Position = (function () {
    function Position(filePath, index, line, column) {
        this.filePath = filePath;
        this.index = index;
        this.line = line;
        this.column = column;
    }
    Position.prototype.toString = function () {
        return this.filePath + ":" + this.line + ":" + this.column;
    };
    return Position;
})();
exports.Position = Position;
var Range = (function () {
    function Range(begin, end) {
        this.begin = begin;
        this.end = end;
    }
    return Range;
})();
exports.Range = Range;
function cacheKey(parser, index) {
    return parser.id + " " + index;
}
var Cache = (function () {
    function Cache() {
        this.cache = {};
    }
    Cache.prototype.set = function (parser, index, result) {
        this.cache[cacheKey(parser, index)] = result;
    };
    Cache.prototype.get = function (parser, index) {
        return this.cache[cacheKey(parser, index)];
    };
    return Cache;
})();
exports.Cache = Cache;
var FurthestFailure = (function () {
    function FurthestFailure() {
    }
    FurthestFailure.prototype.add = function (failure) {
        if (!this.furthest) {
            this.furthest = failure;
        }
        var index = failure.state.position.index;
        var furthestIndex = this.furthest.state.position.index;
        if (furthestIndex == index) {
            this.furthest = new Failure(this.furthest.state, unionStrings(this.furthest.expecteds, failure.expecteds));
        }
        else if (furthestIndex < index) {
            this.furthest = failure;
        }
    };
    return FurthestFailure;
})();
exports.FurthestFailure = FurthestFailure;
var State = (function () {
    function State(text, position, cache, furthestFailure, tracer) {
        this.text = text;
        this.position = position;
        this.cache = cache;
        this.furthestFailure = furthestFailure;
        this.tracer = tracer;
    }
    State.prototype.substring = function (length) {
        return this.text.slice(this.position.index, this.position.index + length);
    };
    State.prototype.currentChar = function () {
        return this.text.charAt(this.position.index);
    };
    State.prototype.proceed = function (offset) {
        offset = Math.min(this.text.length - this.position.index, offset);
        var proceedStr = this.substring(offset);
        var proceedLines = proceedStr.split(/\r\n|\n|\r/);
        var lastLineLength = proceedLines[proceedLines.length - 1].length;
        var newIndex = this.position.index + offset;
        var newLine = this.position.line + proceedLines.length - 1;
        var newColumn = (1 < proceedLines.length) ? lastLineLength + 1 : this.position.column + lastLineLength;
        var newPos = new Position(this.position.filePath, newIndex, newLine, newColumn);
        return new State(this.text, newPos, this.cache, this.furthestFailure, this.tracer);
    };
    State.init = function (filePath, text, trace) {
        return new State(text, new Position(filePath, 0, 1, 1), new Cache(), new FurthestFailure(), trace ? new Tracer() : null);
    };
    return State;
})();
exports.State = State;
var Success = (function () {
    function Success(state, value) {
        this.state = state;
        this.value = value;
    }
    Success.prototype.toString = function () {
        return "[Success position=" + this.state.position + " value=" + this.value + "]";
    };
    return Success;
})();
exports.Success = Success;
var Failure = (function () {
    function Failure(state, expecteds) {
        this.state = state;
        this.expecteds = expecteds;
    }
    Failure.prototype.toString = function () {
        return "[Failure position=" + this.state.position + " expected=[" + this.expecteds + "]";
    };
    return Failure;
})();
exports.Failure = Failure;
var SyntaxError = (function () {
    function SyntaxError(range, expected, found) {
        this.range = range;
        this.expected = expected;
        this.found = found;
        this.name = "SyntaxError";
        this.error = new Error();
        this.name = "SyntaxError";
        this.message = "Expected " + expected.map(function (e) { return ("'" + e + "'"); }).join(", ") + "; found '" + found + "'";
    }
    Object.defineProperty(SyntaxError.prototype, "stack", {
        get: function () {
            return this.error["stack"];
        },
        enumerable: true,
        configurable: true
    });
    return SyntaxError;
})();
exports.SyntaxError = SyntaxError;
util.inherits(SyntaxError, Error);
var Tracer = (function () {
    function Tracer() {
        this.last = "";
    }
    Tracer.prototype.trace = function (result) {
        var message = result.toString();
        if (message == this.last) {
            return;
        }
        this.last = message;
        if (result instanceof Failure) {
            console.log(colors.red(message));
        }
        else {
            console.log(colors.green(message));
        }
    };
    return Tracer;
})();
exports.Tracer = Tracer;
var parserId = 0;
var Parser = (function () {
    function Parser(_parse) {
        this._parse = _parse;
        this.id = parserId++;
    }
    Parser.prototype.parseFrom = function (state) {
        var index = state.position.index;
        var result = state.cache.get(this, index);
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
    };
    Parser.prototype.parse = function (filePath, text, trace) {
        if (trace === void 0) { trace = false; }
        var state = State.init(filePath, text, trace);
        var result = this.parseFrom(state);
        if (result instanceof Success && result.state.position.index == text.length) {
            return result.value;
        }
        var furthestFailure = state.furthestFailure.furthest;
        var range = new Range(furthestFailure.state.position, furthestFailure.state.proceed(1).position);
        throw new SyntaxError(range, furthestFailure.expecteds.slice(), furthestFailure.state.currentChar());
    };
    Parser.prototype.map = function (transform) {
        var _this = this;
        return new Parser(function (state) {
            var result = _this.parseFrom(state);
            if (result instanceof Failure) {
                return result;
            }
            else if (result instanceof Success) {
                return new Success(result.state, transform(result.value));
            }
        });
    };
    Parser.prototype.forEach = function (action) {
        return this.map(function (x) {
            action(x);
            return x;
        });
    };
    Parser.prototype.repeat = function (min, max) {
        var _this = this;
        if (min === void 0) { min = 0; }
        if (max === void 0) { max = Infinity; }
        return new Parser(function (state) {
            var values = [];
            for (var count = 0; true; ++count) {
                if (max <= count) {
                    return new Success(state, values);
                }
                var result = _this.parseFrom(state);
                if (result instanceof Success) {
                    state = result.state;
                    values.push(result.value);
                }
                else if (result instanceof Failure) {
                    if (count < min) {
                        return result;
                    }
                    else {
                        return new Success(result.state, values);
                    }
                }
            }
        });
    };
    Parser.prototype.mayBe = function () {
        return this.repeat(0, 1).map(function (xs) { return xs[0]; });
    };
    Parser.prototype.withRange = function () {
        var _this = this;
        return new Parser(function (state) {
            var begin = state.position;
            var result = _this.parseFrom(state);
            if (result instanceof Success) {
                var end = result.state.position;
                var valueWithRange = [result.value, new Range(begin, end)];
                return new Success(result.state, valueWithRange);
            }
            else if (result instanceof Failure) {
                return result;
            }
        });
    };
    Parser.prototype.text = function () {
        var _this = this;
        return new Parser(function (state) {
            var begin = state.position.index;
            var result = _this.parseFrom(state);
            var end = result.state.position.index;
            var text = state.text.slice(begin, end);
            if (result instanceof Success) {
                return new Success(result.state, text);
            }
            else if (result instanceof Failure) {
                return result;
            }
        });
    };
    Parser.prototype.thenSkip = function (parser) {
        return sequence(this, parser).map(function (_a) {
            var a = _a[0], b = _a[1];
            return a;
        });
    };
    Parser.prototype.thenTake = function (parser) {
        return sequence(this, parser).map(function (_a) {
            var a = _a[0], b = _a[1];
            return b;
        });
    };
    return Parser;
})();
exports.Parser = Parser;
function sequence() {
    var parsers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        parsers[_i - 0] = arguments[_i];
    }
    return new Parser(function (state) {
        var values = [];
        for (var _i = 0; _i < parsers.length; _i++) {
            var parser = parsers[_i];
            var result = parser.parseFrom(state);
            if (result instanceof Success) {
                state = result.state;
                values.push(result.value);
            }
            else if (result instanceof Failure) {
                return result;
            }
        }
        return new Success(state, values);
    });
}
exports.sequence = sequence;
function choose() {
    var parsers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        parsers[_i - 0] = arguments[_i];
    }
    return new Parser(function (state) {
        var expecteds = [];
        for (var _i = 0; _i < parsers.length; _i++) {
            var parser = parsers[_i];
            var result = parser.parseFrom(state);
            if (result instanceof Success) {
                return result;
            }
            else if (result instanceof Failure) {
                for (var _a = 0, _b = result.expecteds; _a < _b.length; _a++) {
                    var expected = _b[_a];
                    expecteds.push(expected);
                }
            }
        }
        return new Failure(state, expecteds);
    });
}
exports.choose = choose;
function string(text) {
    return new Parser(function (state) {
        var substr = state.substring(text.length);
        if (substr == text) {
            return new Success(state.proceed(text.length), text);
        }
        else {
            return new Failure(state, [text]);
        }
    });
}
exports.string = string;
function testChar(test, expected) {
    return new Parser(function (state) {
        var substr = state.substring(1);
        if (test(substr)) {
            return new Success(state.proceed(1), substr);
        }
        else {
            return new Failure(state, expected);
        }
    });
}
exports.testChar = testChar;
function regExp(re) {
    return testChar(function (c) { return !!c.match(re); }, [re.toString()]);
}
exports.regExp = regExp;
exports.anyChar = testChar(function (c) { return c.length == 1; }, ["[any character]"]);
function lazy(get) {
    var parser;
    return new Parser(function (state) {
        if (!parser) {
            parser = get();
        }
        return parser.parseFrom(state);
    });
}
exports.lazy = lazy;
