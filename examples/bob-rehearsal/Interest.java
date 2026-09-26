import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Scanner; // v4

/**
 * Java translation of INTEREST.CBL
 *
 * Storage fields (determine sign/overflow behaviour):
 *   INTEREST  PIC S9(5)V99   – signed,   5 integer + 2 decimal  → O-INT
 *   FEE       PIC 9(3)V99    – unsigned, 3 integer + 2 decimal  → O-FEE
 *   NEW-BAL   PIC 9(7)V99    – unsigned, 7 integer + 2 decimal  → O-NEW
 *
 * Input  (stdin): TYPE,BALANCE,RATE,DAYS   one record per line
 * Output (stdout): O-INT,O-FEE,O-NEW       one result per line, %.2f each
 *
 * COBOL storage semantics:
 *   - Truncate (DOWN) to the field's decimal precision (unless ROUNDED)
 *   - Discard high-order integer digits beyond the field width (modulo)
 *   - Unsigned fields: negative results lose their sign (absolute value)
 */
public class Interest {

    // -----------------------------------------------------------------------
    // COBOL PICTURE storage helpers
    // -----------------------------------------------------------------------

    /**
     * Unsigned PIC 9(intDigits)V(decDigits): truncate, abs (sign-loss), modulo.
     */
    static BigDecimal storeUnsigned(BigDecimal v, int intDigits, int decDigits) {
        v = v.setScale(decDigits, RoundingMode.DOWN);
        if (v.signum() < 0) v = v.negate();
        long mod = pow10(intDigits);
        BigDecimal intPart  = v.divideToIntegralValue(BigDecimal.ONE);
        BigDecimal fracPart = v.subtract(intPart);
        long truncInt = intPart.longValue() % mod;
        return BigDecimal.valueOf(truncInt).add(fracPart).setScale(decDigits);
    }

    /**
     * Signed PIC S9(intDigits)V(decDigits): truncate (DOWN), modulo preserving sign.
     */
    static BigDecimal storeSigned(BigDecimal v, int intDigits, int decDigits) {
        v = v.setScale(decDigits, RoundingMode.DOWN);
        long mod = pow10(intDigits);
        BigDecimal intPart  = v.divideToIntegralValue(BigDecimal.ONE);
        BigDecimal fracPart = v.subtract(intPart);
        long truncInt = intPart.longValue() % mod;          // Java % preserves sign
        return BigDecimal.valueOf(truncInt).add(fracPart).setScale(decDigits);
    }

    /**
     * Signed PIC S9(intDigits)V(decDigits) WITH ROUNDED (HALF_UP away from zero).
     */
    static BigDecimal storeSignedRounded(BigDecimal v, int intDigits, int decDigits) {
        v = v.setScale(decDigits, RoundingMode.HALF_UP);
        long mod = pow10(intDigits);
        BigDecimal intPart  = v.divideToIntegralValue(BigDecimal.ONE);
        BigDecimal fracPart = v.subtract(intPart);
        long truncInt = intPart.longValue() % mod;
        return BigDecimal.valueOf(truncInt).add(fracPart).setScale(decDigits);
    }

    static long pow10(int n) {
        long r = 1;
        for (int i = 0; i < n; i++) r *= 10;
        return r;
    }

    // -----------------------------------------------------------------------
    // Input field truncation (COBOL stores incoming data into its PICTURE field)
    // -----------------------------------------------------------------------

    /** PIC S9(7)V99 */
    static BigDecimal inputBalance(BigDecimal v) { return storeSigned(v, 7, 2); }

    /** PIC 9V9999 – 1 integer digit, 4 decimal places, unsigned */
    static BigDecimal inputRate(BigDecimal v)    { return storeUnsigned(v, 1, 4); }

    // -----------------------------------------------------------------------
    // Main
    // -----------------------------------------------------------------------

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextLine()) {
            String line = sc.nextLine().trim();
            if (line.isEmpty()) continue;

            String[]   parts   = line.split(",", -1);
            String     fType   = parts[0].trim();
            BigDecimal balance = inputBalance(new BigDecimal(parts[1].trim()));
            BigDecimal rate    = inputRate(new BigDecimal(parts[2].trim()));
            BigDecimal days    = new BigDecimal(parts[3].trim()); // PIC 9(3)

            BigDecimal interest;
            BigDecimal fee;
            BigDecimal newBal;

            // ---------------------------------------------------------------
            // COMPUTE INTEREST ROUNDED = BALANCE * RATE * DAYS / 365
            // PIC S9(5)V99 WITH ROUNDED
            // ---------------------------------------------------------------
            BigDecimal rawInterest = balance
                    .multiply(rate)
                    .multiply(days)
                    .divide(new BigDecimal("365"), 20, RoundingMode.HALF_UP);
            interest = storeSignedRounded(rawInterest, 5, 2);

            // ---------------------------------------------------------------
            // Fee paragraph  (no ROUNDED → truncate into PIC 9(3)V99)
            //
            // COBOL logic (source lines 47–52):
            //   MOVE 0 TO FEE
            //   IF BALANCE < 1000
            //     COMPUTE FEE = 12.50 + BALANCE * 0.001
            //   ELSE
            //     MOVE 5.00 TO FEE
            //   IF F-TYPE = 'P'
            //     MOVE 0 TO FEE
            // i.e. P overrides to zero; all others: variable fee < 1000, flat 5.00 >= 1000.
            // ---------------------------------------------------------------
            if (balance.compareTo(new BigDecimal("1000")) < 0) {
                // COMPUTE FEE = 12.50 + BALANCE * 0.001
                // COBOL intermediate precision for the product: 4 decimal places
                // (BALANCE has 2dp, literal 0.001 has 3dp → IBM COBOL carries 2+3-1=4dp
                // in the intermediate, truncating toward zero before the addition).
                // e.g. -0.01*0.001=-0.00001 → 4dp toward-zero → 0.0000 → 12.5000 → 12.50
                //      -0.10*0.001=-0.0001  → 4dp toward-zero → -0.0001 → 12.4999 → 12.49
                //      -4.00*0.001=-0.004   → 4dp toward-zero → -0.0040 → 12.4960 → 12.49
                BigDecimal term = balance.multiply(new BigDecimal("0.001"))
                        .setScale(4, RoundingMode.DOWN);
                BigDecimal rawFee = new BigDecimal("12.50").add(term);
                fee = storeUnsigned(rawFee, 3, 2);
            } else {
                fee = storeUnsigned(new BigDecimal("5.00"), 3, 2);
            }
            // P-type overrides fee to zero regardless of balance
            if ("P".equals(fType)) {
                fee = BigDecimal.ZERO.setScale(2);
            }

            // ---------------------------------------------------------------
            // COMPUTE NEW-BAL = BALANCE + INTEREST - FEE
            // PIC 9(7)V99 (unsigned, no ROUNDED → truncate)
            // ---------------------------------------------------------------
            BigDecimal rawNewBal = balance.add(interest).subtract(fee);
            newBal = storeUnsigned(rawNewBal, 7, 2);

            // Output: O-INT,O-FEE,O-NEW zero-padded to match COBOL PICTURE widths
            // O-INT  PIC S9(5)V99  → sign + 5 digits + dot + 2 = 9 chars e.g. -00000.01
            // O-FEE  PIC 9(3)V99   → 3 digits + dot + 2 = 6 chars         e.g. 012.50
            // O-NEW  PIC 9(7)V99   → 7 digits + dot + 2 = 10 chars         e.g. 0000012.50
            // For O-INT: format as signed 9-char field (%+09.2f gives +00000.00 / -00000.01)
            // then replace leading '+' with ' ' is not needed — COBOL suppresses the + sign.
            // Legacy output shows no sign for positive, '-' for negative → use %09.2f
            // but that doesn't print '-' for negatives with enough padding. Use manual format:
            String intStr;
            if (interest.signum() < 0) {
                intStr = String.format("-%08.2f", interest.negate());
            } else {
                intStr = String.format("%08.2f", interest);
            }
            System.out.printf("%s,%06.2f,%010.2f%n", intStr, fee, newBal);
        }
        sc.close();
    }
}
