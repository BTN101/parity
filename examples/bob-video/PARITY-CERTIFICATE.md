# Parity certificate — INTEREST

**Behavioural equivalence with declared changes.** 6 accepted changes, recorded in the ledger. Nothing undeclared in 20,000 inputs.

| | |
|---|---|
| Legacy | `interest.cbl` (GnuCOBOL, `-std=ibm`) |
| Modern | Java 21 (BigDecimal translation) |
| Inputs | 20,000 generated, seed 1 (reproducible) |
| Statements exercised | 20 of 20 |
| Decisions exercised both ways | 2 of 2 |
| Generated | 2026-09-27T11:11:55.212Z |

## Input domain

Derived from the legacy program's own declarations and comparisons.

- **F-TYPE** `PIC X(1)` — text, 1 chars; values S, P, C
- **BALANCE** `PIC S9(7)V99` — signed, 7 integer digits, 2 decimals; edges from code: 999.99, 1000, 1000.01
- **RATE** `PIC 9V9999` — UNSIGNED, 1 integer digit, 4 decimals
- **DAYS** `PIC 9(3)` — UNSIGNED, 3 integer digits, 0 decimals

## Findings

### NEW-BAL silently loses leading digits on overflow

Accepted as an intentional change. Seen on 847 of 20,000 inputs.

NEW-BAL is declared PIC 9(7)V99 (UNSIGNED, 7 integer digits, 2 decimals), so it cannot hold 9,999,999.99 or more. With no ON SIZE ERROR clause, larger results are stored with their high-order digits cut off. Legacy: 0046569.32. Modern: 10046569.32.

```
input   S,9999999.00,9.0000,1
legacy   46575.32,005.00,0046569.32
modern   46575.32,005.00,10046569.32
```
- line 24: `01  NEW-BAL                  PIC 9(7)V99.`
- line 55: `COMPUTE NEW-BAL = BALANCE + INTEREST - FEE`

> **Decision:** accept — User accepts modern behaviour: NEW-BAL shows the full value rather than silently truncating high-order digits.  
> User, 2026-09-27T11:06:43.091Z

### Input BALANCE larger than its field is truncated on the way in

Accepted as an intentional change. Seen on 233 of 20,000 inputs.

BALANCE is declared PIC S9(7)V99 (signed, 7 integer digits, 2 decimals). An input of 10000000.00 cannot fit, and the legacy program silently keeps only the low-order digits. The modern code uses the full value.

```
input   S,10000000.00,0.0000,0
legacy   00000.00,012.50,0000012.50
modern   00000.00,005.00,9999995.00
```
- line 19: `01  BALANCE                  PIC S9(7)V99.`

> **Decision:** accept — User accepts modern behaviour: full BALANCE value is used rather than silently truncating on input.  
> User, 2026-09-27T11:06:45.907Z

### Input RATE larger than its field is truncated on the way in

Accepted as an intentional change. Seen on 61 of 20,000 inputs.

RATE is declared PIC 9V9999 (UNSIGNED, 1 integer digit, 4 decimals). An input of 10.0000 cannot fit, and the legacy program silently keeps only the low-order digits. The modern code uses the full value.

```
input   S,1000000.00,10.0000,1
legacy   00000.00,005.00,0999995.00
modern   27397.26,005.00,1027392.26
```
- line 20: `01  RATE                     PIC 9V9999.`

> **Decision:** accept — User accepts modern behaviour: full RATE value is used rather than silently truncating on input.  
> User, 2026-09-27T11:06:48.112Z

### Input DAYS larger than its field is truncated on the way in

Accepted as an intentional change. Seen on 56 of 20,000 inputs.

DAYS is declared PIC 9(3) (UNSIGNED, 3 integer digits, 0 decimals). An input of 1000 cannot fit, and the legacy program silently keeps only the low-order digits. The modern code uses the full value.

```
input   S,1000.00,9.0000,1000
legacy   00000.00,005.00,0000995.00
modern   24657.53,005.00,0025652.53
```
- line 21: `01  DAYS                     PIC 9(3).`

> **Decision:** accept — User accepts modern behaviour: full DAYS value is used rather than silently truncating on input.  
> User, 2026-09-27T11:06:51.330Z

### Negative RATE input loses its sign on the way in

Accepted as an intentional change. Seen on 100 of 20,000 inputs.

RATE is unsigned (PIC 9V9999). An input of -9.0000 is stored as its absolute value by the legacy program.

```
input   S,1000.00,-9.0000,1000
legacy   00000.00,005.00,0000995.00
modern  -24657.53,005.00,0023662.53
```
- line 20: `01  RATE                     PIC 9V9999.`

> **Decision:** accept — User accepts modern behaviour: negative RATE is used as-is rather than silently becoming positive.  
> User, 2026-09-27T11:06:53.608Z

### Negative DAYS input loses its sign on the way in

Accepted as an intentional change. Seen on 78 of 20,000 inputs.

DAYS is unsigned (PIC 9(3)). An input of -1 is stored as its absolute value by the legacy program.

```
input   S,1000.00,9.0000,-1
legacy   00024.66,005.00,0001019.66
modern  -00024.66,005.00,0000970.34
```
- line 21: `01  DAYS                     PIC 9(3).`

> **Decision:** accept — User accepts modern behaviour: negative DAYS is used as-is rather than silently becoming positive.  
> User, 2026-09-27T11:06:55.911Z

## Resolved

Decided, then fixed in the modern code. No longer observed.

- `O-FEE:sign-loss` — preserve: User wants legacy unsigned behaviour: negative FEE silently drops its sign. (User, 2026-09-27T11:06:28.184Z)
- `O-FEE:sign-loss+truncation` — preserve: User wants legacy behaviour: FEE drops sign and truncates high-order digits on overflow. (User, 2026-09-27T11:06:30.391Z)
- `O-INT:high-order-truncation` — preserve: User wants legacy behaviour: INTEREST silently truncates high-order digits on overflow. (User, 2026-09-27T11:06:32.643Z)
- `O-FEE:rounding` — preserve: User wants legacy intermediate-precision truncation reproduced exactly for FEE. (User, 2026-09-27T11:06:35.508Z)
- `O-NEW:sign-loss` — accept: User accepts modern behaviour: negative NEW-BAL prints with its sign rather than silently becoming positive. (User, 2026-09-27T11:06:38.123Z)
- `O-NEW:sign-loss+truncation` — accept: User accepts modern behaviour: NEW-BAL shows sign and full value rather than silently truncating and dropping sign. (User, 2026-09-27T11:06:40.702Z)

## What this does not prove

This is differential testing, not formal proof: it shows the programs agree on every input tried, chosen to target the places COBOL and modern arithmetic are known to disagree. The legacy leg runs under GnuCOBOL in IBM compatibility mode, which approximates but is not IBM Enterprise COBOL on z/OS. Programs that use CICS, DB2 or VSAM are exercised through a driver, not natively.
