tparse
================

tparse is a PEG-like parser combinator for TypeScript and JavaScript.

## Features

* Statically typed
* Parsing results are memoized for O(n) parsing

## Install

```
npm install --save tparse
```

## Example (parsing arithmetic expression)

```ts
import {Range, Parser, sequence, choose, string, regExp, lazy} from "tparse";

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
parser.parse("test.txt", "1 + (2 * 3)");

```

### Result

```json
{
  "left": {
    "value": 1,
    "range": {
      "begin": {
        "filePath": "test.txt",
        "index": 0,
        "line": 1,
        "column": 1
      },
      "end": {
        "filePath": "test.txt",
        "index": 1,
        "line": 1,
        "column": 2
      }
    }
  },
  "op": "+",
  "right": {
    "left": {
      "value": 2,
      "range": ...
    },
    "op": "*",
    "right": {
      "value": 3,
      "range": ...
    }
  }
}
```
