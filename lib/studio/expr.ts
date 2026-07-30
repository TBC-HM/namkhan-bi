// lib/studio/expr.ts
// Safe arithmetic expression evaluator for Studio computed columns.
// Supported: numbers, column references (bare identifiers or [bracketed]),
// + - * / ( ), unary minus, functions round(x[,n]) abs(x) min(...) max(...).
// NO eval, NO Function constructor, NO property access — a tokenizer and a
// recursive-descent parser over a closed grammar (brief A1: safe expression
// subset; staff tier never reaches raw SQL).

export type ExprValue = number | null;

type Token =
  | { t: 'num'; v: number }
  | { t: 'ident'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'comma' };

const FUNCTIONS = new Set(['round', 'abs', 'min', 'max']);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, '');
      const num = Number(raw);
      if (!Number.isFinite(num)) throw new Error(`bad number: ${raw}`);
      out.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'ident', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '[') {
      const close = src.indexOf(']', i);
      if (close < 0) throw new Error('unclosed [column] reference');
      out.push({ t: 'ident', v: src.slice(i + 1, close).trim() });
      i = close + 1;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: 'lparen' }); i++; continue; }
    if (c === ')') { out.push({ t: 'rparen' }); i++; continue; }
    if (c === ',') { out.push({ t: 'comma' }); i++; continue; }
    throw new Error(`unexpected character: ${c}`);
  }
  return out;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private row: Record<string, unknown>) {}

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private next(): Token | undefined { return this.tokens[this.pos++]; }

  parse(): ExprValue {
    const v = this.expr();
    if (this.pos < this.tokens.length) throw new Error('trailing tokens in expression');
    return v;
  }

  // expr := term (('+'|'-') term)*
  private expr(): ExprValue {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.next();
        const right = this.term();
        left = left == null || right == null ? null : (t.v === '+' ? left + right : left - right);
      } else return left;
    }
  }

  // term := factor (('*'|'/') factor)*
  private term(): ExprValue {
    let left = this.factor();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.next();
        const right = this.factor();
        if (left == null || right == null) left = null;
        else if (t.v === '*') left = left * right;
        else left = right === 0 ? null : left / right;
      } else return left;
    }
  }

  // factor := num | ident | ident '(' args ')' | '(' expr ')' | '-' factor
  private factor(): ExprValue {
    const t = this.next();
    if (!t) throw new Error('unexpected end of expression');
    if (t.t === 'num') return t.v;
    if (t.t === 'op' && t.v === '-') {
      const v = this.factor();
      return v == null ? null : -v;
    }
    if (t.t === 'lparen') {
      const v = this.expr();
      const close = this.next();
      if (!close || close.t !== 'rparen') throw new Error('missing )');
      return v;
    }
    if (t.t === 'ident') {
      const nxt = this.peek();
      if (nxt && nxt.t === 'lparen') {
        if (!FUNCTIONS.has(t.v)) throw new Error(`unknown function: ${t.v}`);
        this.next(); // consume (
        const args: ExprValue[] = [];
        if (this.peek() && this.peek()!.t !== 'rparen') {
          args.push(this.expr());
          while (this.peek() && this.peek()!.t === 'comma') {
            this.next();
            args.push(this.expr());
          }
        }
        const close = this.next();
        if (!close || close.t !== 'rparen') throw new Error('missing ) after function args');
        return applyFn(t.v, args);
      }
      // column reference
      const raw = this.row[t.v];
      if (raw == null) return null;
      const num = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(num) ? num : null;
    }
    throw new Error('unexpected token in expression');
  }
}

function applyFn(name: string, args: ExprValue[]): ExprValue {
  const nums = args.filter((a): a is number => a != null);
  switch (name) {
    case 'abs':
      return args[0] == null ? null : Math.abs(args[0]);
    case 'round': {
      if (args[0] == null) return null;
      const digits = args.length > 1 && args[1] != null ? Math.trunc(args[1]) : 0;
      const f = Math.pow(10, digits);
      return Math.round(args[0] * f) / f;
    }
    case 'min':
      return nums.length ? Math.min(...nums) : null;
    case 'max':
      return nums.length ? Math.max(...nums) : null;
    default:
      throw new Error(`unknown function: ${name}`);
  }
}

/** Evaluate an expression against a row. Throws Error on invalid syntax. */
export function evaluateExpr(expr: string, row: Record<string, unknown>): ExprValue {
  if (expr.length > 500) throw new Error('expression too long');
  return new Parser(tokenize(expr), row).parse();
}

/** Validate syntax without a row (all columns resolve to null). */
export function validateExpr(expr: string): { ok: boolean; error?: string } {
  try {
    new Parser(tokenize(expr), {}).parse();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
