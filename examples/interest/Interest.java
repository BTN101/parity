import java.io.*;
import java.math.*;

// A careful modern translation: BigDecimal throughout, HALF_UP where COBOL says
// ROUNDED, truncation (DOWN) where it doesn't. This is the translation a strong
// engineer or model would write -- deliberately not a strawman.
public class Interest {
    static final BigDecimal DAYS_PER_YEAR = new BigDecimal("365");

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

            BigDecimal interest = balance.multiply(rate).multiply(BigDecimal.valueOf(days))
                    .divide(DAYS_PER_YEAR, 10, RoundingMode.HALF_UP)
                    .setScale(2, RoundingMode.HALF_UP);

            BigDecimal fee;
            if (type.equals("P")) fee = BigDecimal.ZERO.setScale(2);
            else if (balance.compareTo(new BigDecimal("1000")) < 0)
                fee = new BigDecimal("12.50").add(balance.multiply(new BigDecimal("0.001")))
                        .setScale(2, RoundingMode.DOWN);
            else fee = new BigDecimal("5.00");

            BigDecimal newBal = balance.add(interest).subtract(fee).setScale(2, RoundingMode.DOWN);

            out.append(fmtSigned(interest, 5)).append(',')
               .append(fmtNum(fee, 3)).append(',')
               .append(fmtNum(newBal, 7)).append('\n');
        }
        System.out.print(out);
    }
    static String fmtSigned(BigDecimal v, int intDigits) {
        String s = fmt(v.abs(), intDigits);
        return (v.signum() < 0 ? "-" : " ") + s;
    }
    // Unsigned output columns: a negative still prints its sign, ahead of the
    // zero padding — the modern system has no reason to hide a negative.
    static String fmtNum(BigDecimal v, int intDigits) {
        return (v.signum() < 0 ? "-" : "") + fmt(v.abs(), intDigits);
    }
    static String fmt(BigDecimal v, int intDigits) {
        String p = v.setScale(2, RoundingMode.DOWN).toPlainString();
        String[] parts = p.split("\\.");
        StringBuilder ip = new StringBuilder(parts[0]);
        while (ip.length() < intDigits) ip.insert(0, '0');
        return ip + "." + parts[1];
    }
}
