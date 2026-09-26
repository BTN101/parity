# Parity certificate — INTEREST

**Behavioural equivalence with declared changes.** 3 accepted changes, recorded in the ledger. Nothing undeclared in 20,000 inputs.

| | |
|---|---|
| Legacy | `interest.cbl` (GnuCOBOL, `-std=ibm`) |
| Modern | Java 21 (translated by Bob) |
| Inputs | 20,000 generated, seed 1 (reproducible) |
| Statements exercised | 20 of 20 |
| Decisions exercised both ways | 2 of 2 |
| Generated | 2026-09-23T15:15:24.402Z |

## Input domain

Derived from the legacy program's own declarations and comparisons.

- **F-TYPE** `PIC X(1)` — text, 1 chars; values S, P, C
- **BALANCE** `PIC S9(7)V99` — signed, 7 integer digits, 2 decimals; edges from code: 999.99, 1000, 1000.01
- **RATE** `PIC 9V9999` — UNSIGNED, 1 integer digit, 4 decimals
- **DAYS** `PIC 9(3)` — UNSIGNED, 3 integer digits, 0 decimals

## Findings

### Input DAYS larger than its field is truncated on the way in

Accepted as an intentional change. Seen on 53 of 20,000 inputs.

DAYS is declared PIC 9(3) (UNSIGNED, 3 integer digits, 0 decimals). An input of 1000 cannot fit, and the legacy program silently keeps only the low-order digits. The modern code uses the full value.

```
input   S,1000.00,9.0000,1000
legacy   00000.00,005.00,0000995.00
modern  24657.53,005.00,0025652.53
```
- line 21: `01  DAYS                     PIC 9(3).`

> **Decision:** accept — Out-of-range DAYS values are invalid input that upstream validation rejects; reproducing the legacy wraparound has no business value.  
> Head of Retail Finance, 2026-09-23T15:00:59.768Z

### Negative DAYS input loses its sign on the way in

Accepted as an intentional change. Seen on 66 of 20,000 inputs.

DAYS is unsigned (PIC 9(3)). An input of -1 is stored as its absolute value by the legacy program.

```
input   S,1000.00,9.0000,-1
legacy   00024.66,005.00,0001019.66
modern  -00024.66,005.00,0000970.34
```
- line 21: `01  DAYS                     PIC 9(3).`

> **Decision:** accept — Out-of-range DAYS values are invalid input that upstream validation rejects; reproducing the legacy wraparound has no business value.  
> Head of Retail Finance, 2026-09-23T15:00:59.768Z

### Negative RATE input loses its sign on the way in

Accepted as an intentional change. Seen on 3 of 20,000 inputs.

RATE is unsigned (PIC 9V9999). An input of -9.0000 is stored as its absolute value by the legacy program.

```
input   S,1000.00,-9.0000,1000
legacy   00000.00,005.00,0000995.00
modern  24657.53,005.00,0025652.53
```
- line 20: `01  RATE                     PIC 9V9999.`

> **Decision:** accept — Out-of-range RATE values are invalid input that upstream validation rejects; reproducing the legacy wraparound has no business value.  
> Head of Retail Finance, 2026-09-23T15:00:59.768Z

## Resolved

Decided, then fixed in the modern code. No longer observed.

- `O-INT:format` — preserve: Downstream settlement files are fixed-width; outputs must be zero-padded exactly like the COBOL fields. (Head of Retail Finance, 2026-09-23T15:00:52.586Z)
- `O-FEE:format` — preserve: Downstream settlement files are fixed-width; outputs must be zero-padded exactly like the COBOL fields. (Head of Retail Finance, 2026-09-23T15:00:54.980Z)
- `O-NEW:format` — preserve: Downstream settlement files are fixed-width; outputs must be zero-padded exactly like the COBOL fields. (Head of Retail Finance, 2026-09-23T15:00:57.513Z)
- `O-FEE:value` — preserve: Translation bug: the COBOL only treats F-TYPE P specially; every other type including C uses the balance-based fee formula. The C-type flat-fee rule must be removed. (Head of Retail Finance, 2026-09-23T15:00:58.284Z)
- `O-FEE:rounding` — preserve: Fees must match the legacy system to the cent. (Head of Retail Finance, 2026-09-23T15:00:59.767Z)

## What this does not prove

This is differential testing, not formal proof: it shows the programs agree on every input tried, chosen to target the places COBOL and modern arithmetic are known to disagree. The legacy leg runs under GnuCOBOL in IBM compatibility mode, which approximates but is not IBM Enterprise COBOL on z/OS. Programs that use CICS, DB2 or VSAM are exercised through a driver, not natively.
