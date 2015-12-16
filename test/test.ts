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
    .thenSkip(_)
    .withRange()
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

describe("Parser", () => {
  it("parses arithmetic", () => {
    console.log("parsing");
    console.log(parseExpr.parse("test.txt", "(1 + 2) * 3 + 4"));
  });
});
