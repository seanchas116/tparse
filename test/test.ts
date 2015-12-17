require('source-map-support').install();
import {assert} from "chai";
import {SyntaxError, Range, Parser, sequence, choose, string, regExp, lazy} from "../src/index";

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
      assert.throw(() => parser.parseString("hjkl"), "[:1:5]: Expected '[EOS]'; found ''");
    });
  });
});
