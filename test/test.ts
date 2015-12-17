require('source-map-support').install();
import {assert} from "chai";
import {SyntaxError, Range, Parser, sequence, choose, string, regExp, lazy} from "../src/index";

interface IntegerNode {
  value: number;
  range: Range;
}

interface BinOpNode {
  left: Node;
  op: string;
  right: Node;
}

type Node = IntegerNode | BinOpNode;

const _ = regExp(/[ \t\n\r]/).repeat();

const integer: Parser<IntegerNode> =
  regExp(/[0-9]/).repeat(1)
    .withRange()
    .thenSkip(_)
    .map(([chars, range]) => {
      return {value: parseInt(chars.join("")), range};
    });

function token(str: string) {
  return string(str).thenSkip(_);
}

const factor: Parser<Node> =
  choose(
    integer,
    token("(")
      .thenTake(lazy(() => expr))
      .thenSkip(token(")"))
  )

function buildTree([first, rest]: [Node, [string, Node][]]) {
  let left = first;
  for (const [op, right] of rest) {
    left = {left, op, right};
  }
  return left;
}

const term: Parser<Node> =
  sequence(
    factor,
    _.thenTake(
      sequence(
        _.thenTake(choose(string("*"), string("/"))),
        _.thenTake(factor)
      ).repeat()
    )
  )
    .map(buildTree);

const expr: Parser<Node> =
  sequence(
    term,
    _.thenTake(
      sequence(
        _.thenTake(choose(string("+"), string("-"))),
        _.thenTake(term)
      ).repeat()
    )
  )
    .map(buildTree);

const parser = _.thenTake(expr);

describe("Parser", () => {
  it("parses arithmetic", () => {
    const source = `
      (1 + 2)
        * 3
        + (4 * 5)
    `;
    const expr = parser.parse("test.txt", source) as BinOpNode;
    const node = (expr.right as BinOpNode).right as IntegerNode;
    assert.equal(node.value, 5);
    assert.equal(node.range.begin.filePath, "test.txt");
    assert.equal(node.range.begin.line, 4);
    assert.equal(node.range.begin.column, 16);
    assert.equal(node.range.begin.index, 42);
    assert.equal(node.range.end.line, 4);
    assert.equal(node.range.end.column, 17);
    assert.equal(node.range.end.index, 43);
  });

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
