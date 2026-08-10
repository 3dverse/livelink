/**
 *
 */
const op_prio = {
    "!": 3,
    "&": 2,
    "|": 1,
    "^": 1,
} as const;

/**
 *
 */
function is_operator(op: string): boolean {
    return Object.prototype.hasOwnProperty.call(op_prio, op);
}

/**
 *
 */
function has_greater_precedence(op1: keyof typeof op_prio, op2: keyof typeof op_prio): boolean {
    return op_prio[op1] > op_prio[op2];
}

/**
 * Unary prefix operators are right-associative: "! ! a" must parse as !(!(a)),
 * so a second "!" should not pop the first one off the stack.
 */
const right_associative = new Set<string>(["!"]);

/**
 * @internal
 */
export function compute_rpn(filter_value: string): string {
    const tokens = filter_value.split(" ");
    const output: Array<string> = [];
    const operators: Array<string> = [];

    for (const token of tokens) {
        switch (token) {
            case "!":
            case "&":
            case "|":
            case "^":
                {
                    while (operators.length > 0) {
                        const op = operators[operators.length - 1] as keyof typeof op_prio;
                        if (!is_operator(op) || has_greater_precedence(token, op) || right_associative.has(token) && op_prio[op] === op_prio[token]) {
                            break;
                        }
                        operators.pop();
                        output.push(op);
                    }
                    operators.push(token);
                }
                break;
            case "(":
                {
                    operators.push(token);
                }
                break;
            case ")":
                {
                    while (operators.length > 0 && operators[operators.length - 1] !== "(") {
                        output.push(operators.pop()!);
                    }
                    console.assert(operators[operators.length - 1] === "(");
                    operators.pop();
                }
                break;
            default:
                {
                    output.push(token);
                }
                break;
        }
    }

    while (operators.length !== 0) {
        const op = operators.pop()!;
        console.assert(op !== "(");
        output.push(op);
    }

    return JSON.stringify(output);
}
