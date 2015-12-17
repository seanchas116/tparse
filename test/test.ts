require('source-map-support').install();
import {assert} from "chai";
import {SyntaxError, Position, Range, Parser, sequence, choose, string, regExp, lazy} from "../src/index";

const whitespaces = regExp(/[ \t\n\r]/).repeat();

describe("Parser", () => {

  describe("map", () => {
    it("maps parsed value", () => {
      const parser = regExp(/[0-9]/).repeat().text().map(s => parseInt(s, 10));
      assert.equal(parser.parseString("123"), 123);
    });
  });
  describe("repeat", () => {
    it("repeats parser", () => {
      const parser = regExp(/[a-zA-Z]/).repeat(2, 3).text();
      assert.throw(() => parser.parseString("a"), "[:1:2]: Expected '/[a-zA-Z]/'; found ''");
      assert.equal(parser.parseString("ab"), "ab");
      assert.equal(parser.parseString("xyz"), "xyz");
      assert.throw(() => parser.parseString("hjkl"), "[:1:4]: Expected '[end of input]'; found 'l'");
    });
  });
  describe("maybe", () => {
    it("parse 0 or 1 repeat", () => {
      const parser = regExp(/[a-zA-Z]/).maybe()
        .thenSkip(regExp(/[0-9]/).repeat());
      assert.equal(parser.parseString("a123"), "a");
      assert.isUndefined(parser.parseString("123"));
      assert.throws(() => parser.parseString("ab123"), "[:1:2]: Expected '/[0-9]/'; found 'b'");
    });
  });
  describe("text", () => {
    it("parses as text", () => {
      const parser = regExp(/[0-9]/).repeat().text();
      assert.equal(parser.parseString("01234"), "01234");
    });
  });
  describe("withRange", () => {
    it("parses content and its range", () => {
      const parser = whitespaces.thenTake(regExp(/[0-9]/).repeat().text().withRange());
      const [value, range] = parser.parse("test.txt", "\n  12345");
      const {begin, end} = range;

      assert.equal(value, "12345");
      console.log(begin);
      console.log(end);

      assert.deepEqual(begin, new Position("test.txt", 3, 2, 3));
      assert.deepEqual(end, new Position("test.txt", 8, 2, 8));
    });
  });
});
