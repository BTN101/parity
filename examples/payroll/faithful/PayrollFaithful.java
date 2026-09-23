import java.io.*;
import java.math.*;

// Payroll after the repair loop: ROUNDED mapped to half-away-from-zero, and
// every store through Pic so overflow truncates as the legacy fields do.
public class PayrollFaithful {
    static final Pic HOURS = Pic.of("9(3)V9"), RATE = Pic.of("9(3)V99"), OT_HOURS = Pic.of("9(3)V9");
    static final Pic BASE_PAY = Pic.of("9(5)V99"), OT_PAY = Pic.of("9(5)V99"), GROSS = Pic.of("9(5)V99");
    static final Pic TAX = Pic.of("9(5)V99"), NET = Pic.of("S9(5)V99");
    static final BigDecimal FORTY = new BigDecimal("40");

    public static void main(String[] a) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            String[] f = line.split(",");
            String code = f[0];
            BigDecimal hours = HOURS.store(new BigDecimal(f[1].trim()));
            BigDecimal rate = RATE.store(new BigDecimal(f[2].trim()));

            BigDecimal base, ot;
            if (hours.compareTo(FORTY) > 0) {
                BigDecimal otHours = OT_HOURS.store(hours.subtract(FORTY));
                base = BASE_PAY.storeRounded(FORTY.multiply(rate));
                ot = OT_PAY.storeRounded(otHours.multiply(rate).multiply(new BigDecimal("1.5")));
            } else {
                base = BASE_PAY.storeRounded(hours.multiply(rate));
                ot = OT_PAY.store(BigDecimal.ZERO);
            }
            BigDecimal gross = GROSS.store(base.add(ot));

            BigDecimal tax;
            if (code.equals("M")) {
                tax = gross.compareTo(new BigDecimal("2000")) > 0
                    ? TAX.storeRounded(gross.subtract(new BigDecimal("2000")).multiply(new BigDecimal("0.22")).add(new BigDecimal("150")))
                    : TAX.storeRounded(gross.multiply(new BigDecimal("0.075")));
            } else {
                tax = gross.compareTo(new BigDecimal("1000")) > 0
                    ? TAX.storeRounded(gross.subtract(new BigDecimal("1000")).multiply(new BigDecimal("0.24")).add(new BigDecimal("100")))
                    : TAX.storeRounded(gross.multiply(new BigDecimal("0.10")));
            }
            BigDecimal net = NET.store(gross.subtract(tax));

            out.append(Pic.edited(gross, 5, 2, false)).append(',')
               .append(Pic.edited(tax, 5, 2, false)).append(',')
               .append(Pic.edited(net, 5, 2, true)).append('\n');
        }
        System.out.print(out);
    }
}
