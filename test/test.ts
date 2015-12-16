import {assert} from "chai";
import {Range, Parser, sequence, choose, string, regExp, lazy} from "../src/index";

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

const parseInteger: Parser<IntegerNode> =
  regExp(/[0-9]/).repeat(1)
    .withRange()
    .thenSkip(_)
    .map(([chars, range]) => {
      return {value: parseInt(chars.join("")), range};
    });

function parseToken(str: string) {
  return string(str).thenSkip(_);
}

const parseFactor: Parser<Node> =
  choose(
    parseInteger,
    parseToken("(")
      .thenTake(lazy(() => parseExpr))
      .thenSkip(parseToken(")"))
  )

function buildTree([first, rest]: [Node, [string, Node][]]) {
  let left = first;
  for (const [op, right] of rest) {
    left = {left, op, right};
  }
  return left;
}

const parseTerm: Parser<Node> =
  sequence(
    parseFactor,
    _.thenTake(
      sequence(
        _.thenTake(choose(string("*"), string("/"))),
        _.thenTake(parseFactor)
      ).repeat()
    )
  )
    .map(buildTree);

const parseExpr: Parser<Node> =
  sequence(
    parseTerm,
    _.thenTake(
      sequence(
        _.thenTake(choose(string("+"), string("-"))),
        _.thenTake(parseTerm)
      ).repeat()
    )
  )
    .map(buildTree);

const parser = _.thenTake(parseExpr);

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
});
