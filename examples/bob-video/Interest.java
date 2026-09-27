import java.io.*;
import java.math.*;

// A careful modern translation: BigDecimal throughout, HALF_UP where COBOL says
// ROUNDED, truncation (DOWN) where it doesn't.
public class Interest {
    static final BigDecimal DAYS_PER_YEAR = new BigDecimal("365");

    // COBOL field storage helpers -- used to PRESERVE legacy truncation/sign behaviour.
    static final Pic PIC_INTEREST = Pic.of("S9(5)V99");
    static final Pic PIC_FEE      = Pic.of("9(3)V99");

    public static void main(String[] a) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            String[] f = line.split(",");
            String type = f[0];
            BigDecimal balance = new BigDecimal(f[1].trim()).setScale(2, RoundingMode.DOWN);
            BigDecimal rate    = new BigDecimal(f[2].trim()).setScale(4, RoundingMode.DOWN);
            int days           = Integer.parseInt(f[3].trim());

            // COMPUTE INTEREST ROUNDED = BALANCE * RATE * DAYS / 365
            // ROUNDED -> storeRounded (HALF_UP); field is S9(5)V99 -> truncates high digits
            BigDecimal interest = PIC_INTEREST.storeRounded(
                    balance.multiply(rate)
                           .multiply(BigDecimal.valueOf(days))
                           .divide(DAYS_PER_YEAR, 10, RoundingMode.HALF_UP));

            BigDecimal fee;
            if (type.equals("P")) {
                fee = BigDecimal.ZERO.setScale(2);
            } else if (balance.compareTo(new BigDecimal("1000")) < 0) {
                // COMPUTE FEE = 12.50 + BALANCE * 0.001
                // GnuCOBOL carries balance*0.001 at 4dp (RATE field scale)
                // before adding 12.50, then stores through PIC 9(3)V99.
                fee = PIC_FEE.store(new BigDecimal("12.50")
                        .add(balance.multiply(new BigDecimal("0.001"))
                                    .setScale(4, RoundingMode.DOWN)));
            } else {
                fee = new BigDecimal("5.00");
            }

            // COMPUTE NEW-BAL = BALANCE + INTEREST - FEE
            // NEW-BAL is PIC 9(7)V99 but user ACCEPTED the sign/overflow difference,
            // so we do NOT pass this through Pic -- just truncate to 2dp.
            BigDecimal newBal = balance.add(interest).subtract(fee)
                                       .setScale(2, RoundingMode.DOWN);

            out.append(fmtSigned(interest, 5)).append(',')
               .append(fmtNum(fee, 3)).append(',')
               .append(fmtNum(newBal, 7)).append('\n');
        }
        System.out.print(out);
    }

    static String fmtSigned(BigDecimal v, int intDigits) {
        return Pic.edited(v, intDigits, 2, true);
    }
    static String fmtNum(BigDecimal v, int intDigits) {
        return Pic.edited(v, intDigits, 2, false);
    }
}
