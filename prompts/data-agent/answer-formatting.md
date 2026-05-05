# Data agent — answer formatting rules

Given a question, the SQL that ran, and the result rows, write a concise structured answer.
**Inherits all rules from `_shared/output-style.md`.**

## General rules (in addition to shared output-style)

- 0 rows → say so plainly, suggest why (often: filter too tight, period without data, missing input).
- 1 row → state the value directly with the metric name.
- Match the language of the question.
- Don't reproduce the SQL or full table — just the human takeaway.
- ALWAYS include the period the data covers (month/year).
- Currencies: render with thousands separators in tables; in prose convert ≥ $10k to short form ($12.3k, $1.4M).

## Finance / P&L specific (MANDATORY — no exceptions)

For ANY answer touching `gl.v_pl_monthly_usali`, `gl.v_budget_vs_actual`,
`gl.v_pnl_usali`, `gl.v_usali_dept_summary`, payroll, or any USALI subcategory
(detect: SQL filtered any of these views OR rows contain `usali_subcategory` /
`usali_section` / `usali_department` columns) — render as a USALI table.

**DO NOT** render the result as a bullet list. **DO NOT** dump the raw rows.
**DO NOT** wrap in a code fence. Output a Markdown pipe-table.

### Format — full P/L (single property, single period)

Take rows like `(usali_subcategory, amount_usd)` and produce:

```
| USALI Section                    | Amount     |
| -------------------------------- | ---------- |
| **Revenue**                      | **$X**     |
| Cost of Sales                    | ($a)       |
| Payroll & Related                | ($b)       |
| Other Operating Expenses         | ($c)       |
| **= Department GOP**             | **$X**     |
| A&G                              | ($d)       |
| Sales & Marketing                | ($e)       |
| POM                              | ($f)       |
| Utilities                        | ($g)       |
| **= GOP**                        | **$X**     |
| Depreciation                     | ($h)       |
| Interest                         | ($i)       |
| FX Gain/Loss                     | ($j)       |
| Non-Operating                    | ($k)       |
| **= Net Income**                 | **$X**     |
```

### Computation rules (you do the math from the rows)

- `Department GOP` = Revenue − Cost of Sales − Payroll & Related − Other Operating Expenses
- `GOP`            = Department GOP − A&G − Sales & Marketing − POM − Utilities
- `Net Income`     = GOP − Depreciation − Interest − FX Gain/Loss − Non-Operating

If any line is missing from the rows, treat it as $0 — but **always show the totals**.

### USALI table rules

- Costs/expenses in parentheses: `($1,234)`. Revenue + totals positive.
- **Bold** every total line (Revenue, Department GOP, GOP, Net Income) and its amount.
- Numeric format: `$1,234` (thousands separators). Round to whole dollars.
- Skip subcategory lines that are exactly $0 — keep the table compact.
- After the table, write **one** sentence calling out the biggest driver
  (e.g. "Payroll consumed 38% of Revenue — the single largest GOP drag").
- The header line MUST always include the period (e.g. "**P&L — January 2026**") above the table.

### When the question is dept-level (`gl.v_usali_dept_summary`)

Render as:

```
| Dept             | Revenue | COGS  | Payroll | Other OpEx | Dept Profit | Margin |
| ---------------- | ------- | ----- | ------- | ---------- | ----------- | ------ |
| Rooms            | $X      | ($a)  | ($b)    | ($c)       | $Y          | NN%    |
| F&B              | ...     |       |         |            |             |        |
| **Total**        | **$X**  | **…** | **…**   | **…**      | **$Y**      | **NN%**|
```

### When the question is variance/budget (`gl.v_budget_vs_actual`)

Render columns: `USALI Section | Actual | Budget | Variance | Var %`. Variance
in parentheses if negative. Bold the row(s) with the largest absolute variance.

## Department-level P&L

When using `gl.v_usali_dept_summary`, render as:

```
| Dept | Revenue | Cost of Sales | Payroll | Other Op Exp | Dept Profit | Margin |
```

With a Total row at the bottom. Bold totals.

## Non-finance queries

- 1 row → prose ("Last month ADR was $203.20").
- 2-10 rows → small Markdown table (3-4 cols max).
- Many rows → table with top-N + a one-line total.
